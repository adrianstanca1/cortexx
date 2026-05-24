/**
 * Billing webhook tests
 * Tests signature verification, idempotency, and database upserts
 * Now properly testable via dependency injection factory pattern.
 */

const express = require("express");
const request = require("supertest");
const createWebhookRouter = require("../routes/billing-webhook");

describe("Billing Webhook Handler", () => {
  let app;
  let mockDb;
  let mockStripe;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database
    mockDb = {
      query: vi.fn(),
      end: vi.fn(),
    };

    // Mock Stripe client
    mockStripe = {
      webhooks: {
        constructEvent: vi.fn(),
      },
      subscriptions: {
        retrieve: vi.fn(),
      },
    };

    // Setup Express app
    app = express();

    // Middleware to capture raw body for Stripe signature verification
    app.use(express.raw({ type: "application/json" }), (req, res, next) => {
      req.rawBody = req.body;
      next();
    });

    // Create router with mocked dependencies. Mount path matches production
    // (server/index.js mounts the router AT "/api/billing/webhook"), and the
    // route inside the router is "/" — so the public URL is "/api/billing/webhook".
    const router = createWebhookRouter({
      db: mockDb,
      stripe: mockStripe,
    });
    app.use("/api/billing/webhook", router);

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("should reject webhook with invalid signature", async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const event = { type: "test", data: {} };
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "invalid")
      .send(event);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Signature verification failed");
  });

  it("should process checkout.session.completed event", async () => {
    const orgId = "org-test-001";
    const customerId = "cus_123";
    const stripeSubId = "sub_456";
    const eventId = "evt_123";

    const stripeEvent = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          customer: customerId,
          subscription: stripeSubId,
          metadata: { organizationId: orgId, planId: "starter" },
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(stripeEvent);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: stripeSubId,
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
    });

    // Mock DB queries in order
    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // isEventProcessed (line 82)
      .mockResolvedValueOnce({ rowCount: 1 }) // INSERT subscription_events (line 94)
      .mockResolvedValueOnce({ rows: [] }) // SELECT FROM subscriptions WHERE organization_id (line 166)
      .mockResolvedValueOnce({ rowCount: 1 }) // INSERT/UPDATE subscriptions (line 180)
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE subscription_events set subscription_id (line 136)
      .mockResolvedValueOnce({ rowCount: 1 }); // markEventProcessed (line 142)

    const eventPayload = JSON.stringify(stripeEvent);
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "valid-sig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(eventPayload));

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it("should handle duplicate stripe_event_id (23505 unique violation)", async () => {
    const eventId = "evt_duplicate";
    const stripeEvent = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_789",
          subscription: "sub_999",
          metadata: { organizationId: "org-test-002" },
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(stripeEvent);

    // Mock DB: event not yet processed, but INSERT will trigger unique violation
    const dupError = new Error("duplicate key");
    dupError.code = "23505";

    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // isEventProcessed
      .mockRejectedValueOnce(dupError); // INSERT raises 23505

    const eventPayload = JSON.stringify(stripeEvent);
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "valid-sig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(eventPayload));

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it("should reject when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const stripeEvent = {
      id: "evt_test",
      type: "test.event",
      data: { object: {} },
    };

    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    });

    const eventPayload = JSON.stringify(stripeEvent);
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "sig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(eventPayload));

    expect(response.status).toBe(400);
  });

  it("should silently ignore unknown event types", async () => {
    const eventId = "evt_unknown";
    const stripeEvent = {
      id: eventId,
      type: "unknown.event.type",
      data: { object: {} },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(stripeEvent);

    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // isEventProcessed
      .mockResolvedValueOnce({ rowCount: 1 }) // INSERT subscription_events
      .mockResolvedValueOnce({ rowCount: 1 }); // markEventProcessed

    const eventPayload = JSON.stringify(stripeEvent);
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "valid-sig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(eventPayload));

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });

  it("should upsert subscription on customer.subscription.updated", async () => {
    const subId = "sub_789";
    const customerId = "cus_456";
    const eventId = "evt_sub_updated";

    const stripeEvent = {
      id: eventId,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subId,
          customer: customerId,
          status: "active",
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(stripeEvent);

    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // isEventProcessed
      .mockResolvedValueOnce({ rowCount: 1 }) // INSERT subscription_events
      .mockResolvedValueOnce({ rows: [{ id: "sub-uuid-001", organization_id: "org-1" }] }) // find by customer
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE subscriptions
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE subscription_events
      .mockResolvedValueOnce({ rowCount: 1 }); // markEventProcessed

    const eventPayload = JSON.stringify(stripeEvent);
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "valid-sig")
      .set("Content-Type", "application/json")
      .send(Buffer.from(eventPayload));

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });
});

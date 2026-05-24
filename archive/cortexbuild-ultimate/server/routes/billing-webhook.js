/**
 * Stripe webhook handler for subscription events
 * Uses raw body parsing for signature verification.
 * Handles: checkout.session.completed, customer.subscription.*, invoice.payment_failed
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");

/**
 * Factory function to create the webhook router with dependency injection
 * @param {Object} options Configuration object
 * @param {Object} options.db PostgreSQL pool (defaults to require('../db'))
 * @param {Object} options.stripe Stripe client or wrapper (defaults to lazy-load via getStripe())
 * @returns {express.Router} Configured router
 */
function createWebhookRouter(options = {}) {
  const db = options.db || require("../db");

  // Lazy-resolve Stripe so the server can still boot without STRIPE_SECRET_KEY.
  // Routes that need Stripe will return 503 at request time if the key is missing.
  let stripeOverride = options.stripe || null;
  function getStripeOrError() {
    if (stripeOverride) return stripeOverride;
    return require("../lib/stripe-client").getStripe();
  }

  const router = express.Router();

  /**
   * Helper: verify Stripe webhook signature
   * @throws Error if signature is invalid or STRIPE_WEBHOOK_SECRET not set
   */
  function verifySignature(req) {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    const stripe = getStripeOrError();
    const event = stripe.webhooks.constructEvent(
      req.rawBody, // Raw body is passed by express.raw() middleware
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    return event;
  }

  /**
   * Helper: check if event has already been processed.
   *
   * Uses the dedicated stripe_event_id column (migration 074) — the previous
   * implementation queried payload->>'id', but the payload column stores
   * event.data (the data envelope), not the top-level event, so payload->>'id'
   * is NULL for most Stripe events and idempotency was effectively disabled.
   */
  async function isEventProcessed(stripeEventId) {
    const result = await db.query(
      `SELECT id FROM subscription_events
       WHERE stripe_event_id = $1
       LIMIT 1`,
      [stripeEventId]
    );
    return result.rows.length > 0;
  }

  /**
   * Helper: mark event as processed
   */
  async function markEventProcessed(eventId) {
    await db.query(
      `UPDATE subscription_events SET processed_at = NOW() WHERE id = $1`,
      [eventId]
    );
  }

  /**
   * POST /api/billing/webhook
   * Receives and processes Stripe events.
   *
   * The router is mounted at "/api/billing/webhook" in server/index.js, so
   * the route path here is "/" — NOT "/webhook" (which would expose the
   * endpoint as "/api/billing/webhook/webhook" and 404 on real deliveries).
   */
  router.post("/", async (req, res) => {
    let event;

    try {
      event = verifySignature(req);
    } catch (err) {
      console.error("[webhook] Signature verification failed:", err.message);
      return res.status(400).json({ message: "Signature verification failed" });
    }

    try {
      // Check for duplicate processing
      if (await isEventProcessed(event.id)) {
        console.log(`[webhook] Event ${event.id} already processed, skipping`);
        return res.json({ received: true });
      }

      const { type, data } = event;

      // Store event in audit table. The unique constraint on stripe_event_id
      // (migration 074) provides race-safe idempotency: if two webhook deliveries
      // arrive concurrently, the second INSERT fails and we treat it as duplicate.
      const eventId = uuidv4();
      try {
        await db.query(
          `INSERT INTO subscription_events (id, event_type, payload, stripe_event_id)
           VALUES ($1, $2, $3, $4)`,
          [eventId, type, JSON.stringify(data), event.id]
        );
      } catch (err) {
        // 23505 = unique_violation — concurrent duplicate delivery
        if (err && err.code === "23505") {
          console.log(`[webhook] Event ${event.id} already inserted (race), skipping`);
          return res.json({ received: true });
        }
        throw err;
      }

      let subscriptionId = null;

      // Route event handling
      switch (type) {
        case "checkout.session.completed":
          subscriptionId = await handleCheckoutSessionCompleted(data.object);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          subscriptionId = await handleSubscriptionEvent(data.object);
          break;

        case "customer.subscription.deleted":
          subscriptionId = await handleSubscriptionDeleted(data.object);
          break;

        case "invoice.payment_failed":
          subscriptionId = await handleInvoicePaymentFailed(data.object);
          break;

        default:
          // Silently ignore unknown event types
          console.log(`[webhook] Ignoring event type: ${type}`);
      }

      // Link event to subscription and mark processed
      if (subscriptionId) {
        await db.query(
          `UPDATE subscription_events SET subscription_id = $1 WHERE id = $2`,
          [subscriptionId, eventId]
        );
      }

      await markEventProcessed(eventId);

      res.json({ received: true });
    } catch (err) {
      console.error("[webhook] Event processing failed:", err.message);
      // Return 400 to tell Stripe to retry, but we've logged it
      res.status(400).json({ message: "Event processing failed" });
    }
  });

  /**
   * Handle checkout.session.completed event
   * This fires when payment is confirmed; subscription is already created by Stripe.
   */
  async function handleCheckoutSessionCompleted(session) {
    const { customer, subscription, metadata } = session;
    const { organizationId } = metadata || {};

    if (!organizationId || !subscription) {
      console.warn("[webhook/checkout] Missing organizationId or subscription ID");
      return null;
    }

    const result = await db.query(
      `SELECT id FROM subscriptions WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );

    let subscriptionId = result.rows[0]?.id;

    if (!subscriptionId) {
      subscriptionId = uuidv4();
    }

    // Fetch subscription details from Stripe (lazy-resolves the client)
    const stripe = getStripeOrError();
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription);

    await db.query(
      `INSERT INTO subscriptions (id, organization_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (stripe_subscription_id) DO UPDATE
       SET status = $6, current_period_end = $7, updated_at = NOW()`,
      [
        subscriptionId,
        organizationId,
        customer,
        subscription,
        metadata?.planId || "unknown",
        stripeSubscription.status,
        new Date(stripeSubscription.current_period_end * 1000),
      ]
    );

    return subscriptionId;
  }

  /**
   * Handle customer.subscription.created/updated events
   */
  async function handleSubscriptionEvent(stripeSubscription) {
    const { id, customer, status, current_period_end, metadata } = stripeSubscription;

    // Find organization by customer ID or metadata
    let result = await db.query(
      `SELECT id, organization_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
      [customer]
    );

    if (!result.rows[0]) {
      console.warn(`[webhook] Subscription ${id} has no matching organization`);
      return null;
    }

    const { id: subscriptionId, organization_id: organizationId } = result.rows[0];

    await db.query(
      `UPDATE subscriptions
       SET stripe_subscription_id = $1, status = $2, current_period_end = $3, updated_at = NOW()
       WHERE id = $4`,
      [id, status, new Date(current_period_end * 1000), subscriptionId]
    );

    return subscriptionId;
  }

  /**
   * Handle customer.subscription.deleted events
   */
  async function handleSubscriptionDeleted(stripeSubscription) {
    const { id } = stripeSubscription;

    const result = await db.query(
      `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [id]
    );

    if (!result.rows[0]) {
      return null;
    }

    const subscriptionId = result.rows[0].id;

    await db.query(
      `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2`,
      ["canceled", subscriptionId]
    );

    return subscriptionId;
  }

  /**
   * Handle invoice.payment_failed events
   */
  async function handleInvoicePaymentFailed(invoice) {
    const { subscription } = invoice;

    if (!subscription) {
      return null;
    }

    const result = await db.query(
      `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subscription]
    );

    if (!result.rows[0]) {
      return null;
    }

    const subscriptionId = result.rows[0].id;

    await db.query(
      `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2`,
      ["past_due", subscriptionId]
    );

    return subscriptionId;
  }

  return router;
}

module.exports = createWebhookRouter;

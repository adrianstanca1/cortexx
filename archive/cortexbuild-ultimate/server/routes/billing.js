/**
 * Billing routes: subscription management, portal access, plan info
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const authMiddleware = require("../middleware/auth");
const { getStripe } = require("../lib/stripe-client");
const { getPlan, getAllPlans } = require("../lib/billing/plans");

const router = express.Router();

// GET /api/billing/plans is now a public endpoint mounted before authMiddleware in server/index.js
// All routes below this require authentication (mounted after authMiddleware in server/index.js)

/**
 * GET /api/billing/subscription
 * Auth required: fetch the current organization's subscription.
 */
router.get("/subscription", async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.company_id;
    if (!organizationId) {
      return res.status(400).json({ message: "No organization found for user" });
    }

    const result = await db.query(
      `SELECT id, organization_id, stripe_customer_id, stripe_subscription_id,
              plan_id, status, current_period_end, cancel_at_period_end,
              created_at, updated_at
       FROM subscriptions
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [organizationId]
    );

    const subscription = result.rows[0] || null;
    res.json({ subscription });
  } catch (err) {
    console.error("[billing/subscription]", err.message);
    res.status(500).json({ message: "Failed to fetch subscription" });
  }
});

/**
 * POST /api/billing/checkout
 * Auth required: initiate Stripe Checkout for a given plan.
 * Body: { planId, successUrl?, cancelUrl? }
 */
router.post("/checkout", async (req, res) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const organizationId = req.user.organization_id || req.user.company_id;

    if (!organizationId) {
      return res.status(400).json({ message: "No organization found for user" });
    }

    if (!planId) {
      return res.status(400).json({ message: "planId is required" });
    }

    const plan = getPlan(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    if (!plan.priceId) {
      return res.status(400).json({
        message: `Plan ${planId} does not have a Stripe price ID configured`,
      });
    }

    const stripe = getStripe();

    // Fetch or create Stripe customer keyed to organization_id
    let subscription = await db.query(
      `SELECT stripe_customer_id FROM subscriptions WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );

    let stripeCustomerId = subscription.rows[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create new Stripe customer. Race-safe persistence pattern:
      //  1. Create the customer in Stripe.
      //  2. INSERT … ON CONFLICT (organization_id) DO NOTHING. If two
      //     concurrent checkouts both got here, only the first row wins.
      //  3. Re-SELECT to get the canonical customer_id; if ours lost the
      //     race, the orphaned Stripe customer is harmless (no subscription
      //     attached) and gets garbage-collected by Stripe's housekeeping.
      const customer = await stripe.customers.create({
        metadata: {
          organizationId,
          createdAt: new Date().toISOString(),
        },
      });
      stripeCustomerId = customer.id;

      await db.query(
        `INSERT INTO subscriptions (id, organization_id, stripe_customer_id, plan_id, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id) DO NOTHING`,
        [uuidv4(), organizationId, stripeCustomerId, planId, "incomplete"],
      );
      const reread = await db.query(
        `SELECT stripe_customer_id FROM subscriptions WHERE organization_id = $1 LIMIT 1`,
        [organizationId],
      );
      stripeCustomerId = reread.rows[0]?.stripe_customer_id || stripeCustomerId;
    }

    // Create Checkout Session
    const finalSuccessUrl =
      successUrl || `${process.env.APP_BASE_URL || "http://localhost:3000"}/billing/success`;
    const finalCancelUrl =
      cancelUrl || `${process.env.APP_BASE_URL || "http://localhost:3000"}/billing/cancel`;

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        organizationId,
        planId,
      },
    });

    // If the row already existed (from a prior checkout), refresh plan_id only.
    // The customer_id is intentionally NOT overwritten — we resolved it above
    // and any change would orphan the existing Stripe customer link.
    await db.query(
      `INSERT INTO subscriptions (id, organization_id, stripe_customer_id, plan_id, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id) DO UPDATE
         SET plan_id = EXCLUDED.plan_id
       WHERE subscriptions.stripe_customer_id = EXCLUDED.stripe_customer_id`,
      [uuidv4(), organizationId, stripeCustomerId, planId, "incomplete"],
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error("[billing/checkout]", err.message);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});

/**
 * POST /api/billing/portal
 * Auth required: return Stripe Billing Portal URL for subscription management.
 */
router.post("/portal", async (req, res) => {
  try {
    const organizationId = req.user.organization_id || req.user.company_id;
    if (!organizationId) {
      return res.status(400).json({ message: "No organization found for user" });
    }

    const result = await db.query(
      `SELECT stripe_customer_id FROM subscriptions WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    );

    const stripeCustomerId = result.rows[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      return res.status(404).json({ message: "No Stripe customer found for organization" });
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: process.env.APP_BASE_URL || "http://localhost:3000",
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error("[billing/portal]", err.message);
    res.status(500).json({ message: "Failed to create billing portal session" });
  }
});

module.exports = router;

/**
 * Billing plans configuration
 * Maps plan IDs to Stripe price IDs and feature set.
 * All environment variables are optional; pricing details appear in responses only when set.
 */

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for individuals and small teams",
    priceId: process.env.STRIPE_PRICE_STARTER || null,
    features: [
      "Up to 5 team members",
      "Basic AI capabilities",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Professional",
    description: "For growing teams and organizations",
    priceId: process.env.STRIPE_PRICE_PRO || null,
    features: [
      "Up to 50 team members",
      "Advanced AI features",
      "Priority email support",
      "Custom workflows",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large-scale deployments",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
    features: [
      "Unlimited team members",
      "Full AI suite with custom models",
      "24/7 phone & email support",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom integrations",
    ],
  },
];

/**
 * Get plan by ID
 * @param {string} planId
 * @returns {Object|null} Plan object or null if not found
 */
function getPlan(planId) {
  return plans.find((p) => p.id === planId) || null;
}

/**
 * Get all plans
 * @returns {Array<Object>} Array of plan objects
 */
function getAllPlans() {
  return plans;
}

module.exports = {
  plans,
  getPlan,
  getAllPlans,
};

/**
 * Stripe singleton client
 * Lazy-loads only when STRIPE_SECRET_KEY is set.
 * Throws clear error if used without configuration.
 */

let stripeInstance = null;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Stripe functionality is unavailable. " +
      "Set STRIPE_SECRET_KEY in your environment to enable billing."
    );
  }

  if (!stripeInstance) {
    const Stripe = require("stripe");
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-15.acacia", // Use stable API version
      typescript: false,
    });
  }

  return stripeInstance;
}

module.exports = {
  getStripe,
};

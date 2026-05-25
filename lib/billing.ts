/**
 * Stripe billing helpers. Mirrors push/email — configured when
 * STRIPE_SECRET_KEY is present, no-ops gracefully otherwise so the
 * rest of the app works with billing disabled.
 *
 * Plans are defined inline (single source of truth — same shape rendered
 * by the pricing page + enforced by the limits guard). Prices are managed
 * in the Stripe dashboard and referenced by `priceId` env vars.
 */
import Stripe from 'stripe'

const SECRET = process.env.STRIPE_SECRET_KEY

let stripeClient: Stripe | null = null
export function getStripe(): Stripe | null {
  if (!SECRET) return null
  if (!stripeClient) {
    // Use the SDK's pinned API version (omit the option to follow the
    // installed stripe package version, avoiding version-drift errors).
    stripeClient = new Stripe(SECRET)
  }
  return stripeClient
}

export function isBillingConfigured(): boolean {
  return !!SECRET
}

export type PlanKey = 'starter' | 'pro' | 'enterprise'

export interface Plan {
  key: PlanKey
  name: string
  priceMonthlyGbp: number
  priceId?: string                // Stripe price id; set via env per plan
  limits: { users: number; projects: number; uploadGb: number }
  features: string[]
}

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    priceMonthlyGbp: 29,
    priceId: process.env.STRIPE_PRICE_STARTER,
    limits: { users: 5, projects: 10, uploadGb: 5 },
    features: [
      'Up to 5 team members',
      'Up to 10 active projects',
      '5 GB document storage',
      'Email + push notifications',
      'CSV exports',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    priceMonthlyGbp: 79,
    priceId: process.env.STRIPE_PRICE_PRO,
    limits: { users: 20, projects: 50, uploadGb: 50 },
    features: [
      'Up to 20 team members',
      'Up to 50 active projects',
      '50 GB document storage',
      'AI snag analysis + vision tools',
      'Whisper voice transcription',
      'Priority email support',
    ],
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    priceMonthlyGbp: 0, // contact sales
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    limits: { users: 999, projects: 999, uploadGb: 500 },
    features: [
      'Unlimited team members',
      'Unlimited projects',
      '500 GB document storage',
      'SAML SSO',
      'Audit log retention',
      'Dedicated onboarding + SLA',
    ],
  },
}

export function planByKey(key: string | null | undefined): Plan {
  if (key && key in PLANS) return PLANS[key as PlanKey]
  return PLANS.starter
}

/**
 * Startup validation. Called from instrumentation.ts. When the operator has
 * wired up STRIPE_SECRET_KEY (i.e. billing is meant to be live), the per-plan
 * price ids must ALL be set — otherwise the /pricing page renders a "Choose"
 * button that points at an undefined price and the Stripe checkout call
 * silently 503s with PRICE_NOT_SET. That failure mode is invisible to the
 * operator until a customer tries to subscribe and complains.
 *
 * Returns null on OK, or a human-readable error string for the instrumentation
 * hook to log loudly. Does NOT throw — startup validation should warn, not
 * brick the process (a missing Pro price id shouldn't kill the whole app).
 *
 * Enterprise has no Stripe price (contact-sales flow), so it's not required.
 */
export function validateBillingConfig(): string | null {
  if (!SECRET) return null  // Billing intentionally disabled — nothing to check.

  const required: { key: PlanKey; envVar: string }[] = [
    { key: 'starter', envVar: 'STRIPE_PRICE_STARTER' },
    { key: 'pro', envVar: 'STRIPE_PRICE_PRO' },
  ]
  const missing = required.filter(r => !PLANS[r.key].priceId)
  if (missing.length === 0) return null

  return `[billing] STRIPE_SECRET_KEY is set but ${missing.length} price id(s) missing: ${missing
    .map(m => m.envVar)
    .join(', ')}. /pricing checkout will fail with PRICE_NOT_SET for these plans until they're configured.`
}

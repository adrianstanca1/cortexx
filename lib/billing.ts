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

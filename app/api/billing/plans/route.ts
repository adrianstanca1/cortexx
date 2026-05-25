import { NextResponse } from 'next/server'
import { PLANS, isBillingConfigured } from '@/lib/billing'

export const dynamic = 'force-dynamic'

/**
 * Public plan catalogue. Single source of truth — read by /pricing
 * (server component imports PLANS directly) and /settings/organization
 * (client component fetches this endpoint). Previously these surfaces
 * hard-coded £29 / £79 and the values drifted from lib/billing.ts when
 * pricing changed.
 *
 * Returns only fields safe for client consumption (no Stripe priceId,
 * no internal secrets). isBillingConfigured tells the UI whether
 * self-serve checkout is available or to fall back to contact-sales.
 */
export async function GET() {
  return NextResponse.json({
    configured: isBillingConfigured(),
    plans: Object.values(PLANS).map(p => ({
      key: p.key,
      name: p.name,
      priceMonthlyGbp: p.priceMonthlyGbp,
      limits: p.limits,
      features: p.features,
    })),
  })
}

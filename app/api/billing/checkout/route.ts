import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { getStripe, PLANS, isBillingConfigured } from '@/lib/billing'

export const dynamic = 'force-dynamic'

/**
 * Start a Stripe Checkout session for upgrading / starting a paid plan.
 * Returns the checkout URL — the client redirects to it.
 *
 * Body: { organizationId, plan }
 */
export async function POST(req: NextRequest) {
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: 'Billing not configured', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 })
  }
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Stripe init failed' }, { status: 503 })

  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id' }, { status: 401 })

  let body: { organizationId?: unknown; plan?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
  const planKey = typeof body.plan === 'string' && body.plan in PLANS ? body.plan as keyof typeof PLANS : null
  if (!organizationId || !planKey) return NextResponse.json({ error: 'organizationId + plan required' }, { status: 400 })

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this org' }, { status: 403 })
  if (!canManage(membership.role)) return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 })

  const plan = PLANS[planKey]
  if (!plan.priceId) {
    return NextResponse.json({ error: `Stripe price not configured for ${planKey}`, code: 'PRICE_NOT_SET' }, { status: 503 })
  }

  // Reuse the org's Stripe customer if it already exists; otherwise create
  // one and persist back so future checkouts attach to the same customer.
  let customerId = membership.organization.stripeCustomerId
  if (!customerId) {
    const userEmail = (session.user as { email?: string }).email
    const customer = await stripe.customers.create({
      email: userEmail || undefined,
      name: membership.organization.name,
      metadata: { organizationId },
    })
    customerId = customer.id
    await prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customerId },
    })
  }

  const appUrl = process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/organization?checkout=success`,
    cancel_url: `${appUrl}/settings/organization?checkout=cancel`,
    subscription_data: { metadata: { organizationId, plan: planKey } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkout.url })
}

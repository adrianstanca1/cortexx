import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canManage } from '@/lib/rbac'
import { getStripe, isBillingConfigured } from '@/lib/billing'

export const dynamic = 'force-dynamic'

/**
 * Issue a Stripe Customer Portal session for the org to manage their
 * existing subscription (upgrade / downgrade / cancel / update card).
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

  let body: { organizationId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
  if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

  const membership = await prisma.userOrganization.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!canManage(membership.role)) return NextResponse.json({ error: 'Only admins can manage billing' }, { status: 403 })

  const customerId = membership.organization.stripeCustomerId
  if (!customerId) return NextResponse.json({ error: 'No Stripe customer for this workspace yet' }, { status: 404 })

  const appUrl = process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings/organization`,
  })

  return NextResponse.json({ url: portal.url })
}

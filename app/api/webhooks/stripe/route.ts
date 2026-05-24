import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStripe, isBillingConfigured } from '@/lib/billing'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

/**
 * Stripe webhook receiver. The shared-secret signature header
 * (`Stripe-Signature`) is verified using STRIPE_WEBHOOK_SECRET; rejected
 * requests return 400 without inspecting the body.
 *
 * Handled events update Organization.plan + subscriptionStatus so the
 * app's plan-limit guards see the latest state without polling Stripe.
 */
export async function POST(req: NextRequest) {
  if (!isBillingConfigured() || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Stripe init failed' }, { status: 503 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const raw = await req.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const orgId = session.metadata?.organizationId
        const plan = session.metadata?.plan
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
        // Subscription metadata can also be set at subscription creation time;
        // we fall back to the live subscription if needed.
        let resolvedOrgId = orgId
        let resolvedPlan = plan
        if ((!resolvedOrgId || !resolvedPlan) && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          resolvedOrgId = resolvedOrgId || sub.metadata?.organizationId
          resolvedPlan = resolvedPlan || sub.metadata?.plan
        }
        if (resolvedOrgId) {
          await prisma.organization.update({
            where: { id: resolvedOrgId },
            data: {
              plan: resolvedPlan || 'starter',
              subscriptionStatus: 'active',
              stripeSubscriptionId: subscriptionId,
              trialEndsAt: null,
            },
          })
          auditLog({
            organizationId: resolvedOrgId,
            action: 'billing.subscribe',
            resourceType: 'Organization',
            resourceId: resolvedOrgId,
            metadata: { plan: resolvedPlan, subscriptionId },
          })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const orgId = sub.metadata?.organizationId
        if (orgId) {
          const isActive = sub.status === 'active' || sub.status === 'trialing'
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              subscriptionStatus: sub.status,
              ...(event.type === 'customer.subscription.deleted' ? { plan: 'trial', stripeSubscriptionId: null } : {}),
            },
          })
          auditLog({
            organizationId: orgId,
            action: event.type === 'customer.subscription.deleted' ? 'billing.cancel' : 'billing.update',
            resourceType: 'Organization',
            resourceId: orgId,
            metadata: { status: sub.status, isActive },
          })
        }
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object
        const customerId = typeof inv.customer === 'string' ? inv.customer : null
        if (customerId) {
          const org = await prisma.organization.findFirst({
            where: { stripeCustomerId: customerId },
            select: { id: true },
          })
          if (org) {
            await prisma.organization.update({
              where: { id: org.id },
              data: { subscriptionStatus: 'past_due' },
            })
            auditLog({
              organizationId: org.id,
              action: 'billing.payment-failed',
              resourceType: 'Organization',
              resourceId: org.id,
              metadata: { customerId },
            })
          }
        }
        break
      }
      // Acknowledge but no-op for events we don't act on yet.
      default:
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe webhook] handler failed', event.type, err)
    return NextResponse.json({ error: 'Handler failed', type: event.type }, { status: 500 })
  }
}

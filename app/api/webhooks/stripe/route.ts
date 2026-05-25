import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { getStripe, isBillingConfigured } from '@/lib/billing'
import { auditLog } from '@/lib/audit'
import { bypassTenancy } from '@/lib/tenancy'

// Stripe sends webhook payloads as raw bytes that must be byte-identical
// for signature verification. The Edge runtime can alter / re-encode the
// body, so pin the handler to the Node runtime.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  // Webhook receiver operates outside any signed-in session — the only
  // authoritative tenant identifier is the Stripe customer id, resolved
  // per-event below. Bypass the tenancy extension so writes against the
  // resolved org go through cleanly.
  return bypassTenancy(() => handleEvent(event, stripe))
}

async function handleEvent(event: Stripe.Event, stripe: Stripe): Promise<NextResponse> {
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const claimedOrgId = session.metadata?.organizationId
        const plan = session.metadata?.plan
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
        const customerId = typeof session.customer === 'string' ? session.customer : null

        // SECURITY: never trust metadata.organizationId in isolation —
        // resolve the org from the Stripe customer id, then assert the
        // claim matches. This prevents a webhook sender from supplying a
        // victim's organizationId and having us flip their plan.
        if (!customerId) break
        const ownerOrg = await prisma.organization.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        })
        if (!ownerOrg) {
          console.warn('[stripe webhook] checkout.session.completed for unknown customer', customerId)
          break
        }
        if (claimedOrgId && claimedOrgId !== ownerOrg.id) {
          console.warn('[stripe webhook] org mismatch — claimed', claimedOrgId, 'owner', ownerOrg.id)
          break
        }

        // Pull plan from the live subscription if not in checkout metadata.
        let resolvedPlan = plan
        if (!resolvedPlan && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          resolvedPlan = sub.metadata?.organizationId === ownerOrg.id ? sub.metadata?.plan : undefined
        }

        await prisma.organization.update({
          where: { id: ownerOrg.id },
          data: {
            plan: resolvedPlan || 'starter',
            subscriptionStatus: 'active',
            stripeSubscriptionId: subscriptionId,
            trialEndsAt: null,
          },
        })
        auditLog({
          organizationId: ownerOrg.id,
          action: 'billing.subscribe',
          resourceType: 'Organization',
          resourceId: ownerOrg.id,
          metadata: { plan: resolvedPlan, subscriptionId },
        })
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const customerId = typeof sub.customer === 'string' ? sub.customer : null
        // SECURITY: resolve org from the customer id, NOT from metadata.
        if (!customerId) break
        const ownerOrg = await prisma.organization.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        })
        if (!ownerOrg) {
          console.warn('[stripe webhook] subscription event for unknown customer', customerId)
          break
        }
        const isActive = sub.status === 'active' || sub.status === 'trialing'
        await prisma.organization.update({
          where: { id: ownerOrg.id },
          data: {
            subscriptionStatus: sub.status,
            ...(event.type === 'customer.subscription.deleted' ? { plan: 'trial', stripeSubscriptionId: null } : {}),
          },
        })
        auditLog({
          organizationId: ownerOrg.id,
          action: event.type === 'customer.subscription.deleted' ? 'billing.cancel' : 'billing.update',
          resourceType: 'Organization',
          resourceId: ownerOrg.id,
          metadata: { status: sub.status, isActive },
        })
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

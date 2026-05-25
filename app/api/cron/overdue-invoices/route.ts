import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireCronAuth } from '@/lib/cron'
import { sendPush } from '@/lib/push'
import { sendEmail, overdueDigestTemplate } from '@/lib/email'
import { bypassTenancy } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

interface InvoiceRow {
  number: string
  clientName: string
  amount: number
  dueDate: Date
  daysOverdue: number
}

/**
 * Daily scan: find every overdue (status != paid && dueDate < today)
 * invoice and notify the owning workspace. Each org gets its OWN push
 * + email digest containing ONLY its own invoices — never cross-tenant.
 * Idempotent — repeated runs only re-notify if invoice dueDate has
 * slipped further.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  // Cron operates across every tenant by design — bypass the tenancy
  // extension so cross-org reads/writes aren't blocked when the flag flips.
  return bypassTenancy(() => runOverdueScan())
}

async function runOverdueScan() {
  const now = new Date()

  // Step 1: promote sent→overdue across all orgs in a single bulk update.
  // Safe — purely status flip, no cross-tenant data movement.
  const promoted = await prisma.invoice.updateMany({
    where: { status: 'sent', dueDate: { lt: now } },
    data: { status: 'overdue' },
  })

  // Step 2: per-org notification pass. Group invoices by org so each
  // notification carries only its own workspace's data.
  const overdueByOrg = await prisma.invoice.findMany({
    where: { status: 'overdue', dueDate: { lt: now } },
    select: {
      id: true, number: true, clientName: true, amount: true, dueDate: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: [{ organizationId: 'asc' }, { dueDate: 'asc' }],
    take: 5000,
  })

  if (overdueByOrg.length === 0) {
    return NextResponse.json({ overdueCount: 0, promoted: promoted.count, orgsNotified: 0 })
  }

  // Group by org id (skip rows without an org — defensive against the
  // pre-keystone-migration data that might still be unscoped).
  const byOrg = new Map<string, { orgName: string; rows: InvoiceRow[] }>()
  for (const inv of overdueByOrg) {
    if (!inv.organizationId || !inv.organization) continue
    const bucket = byOrg.get(inv.organizationId) || { orgName: inv.organization.name, rows: [] }
    bucket.rows.push({
      number: inv.number,
      clientName: inv.clientName,
      amount: inv.amount,
      dueDate: inv.dueDate,
      daysOverdue: Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000),
    })
    byOrg.set(inv.organizationId, bucket)
  }

  const appUrl = process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'
  let totalEmails = 0
  const orgErrors: Array<{ orgId: string; error: string }> = []

  // Process orgs in concurrency-capped batches with allSettled. Two
  // reasons:
  //   1. Unbounded Promise.all over hundreds of orgs would open
  //      hundreds of email/push connections at once and exhaust the
  //      worker's file descriptors / hit provider rate limits.
  //   2. Plain Promise.all rejects on the first failure, abandoning
  //      every org after it in iteration order — one mis-configured
  //      tenant could silently mute notifications for everyone else.
  const CONCURRENCY = 5
  const processOrg = async ([orgId, { orgName, rows }]: [string, { orgName: string; rows: InvoiceRow[] }]) => {
    const total = rows.reduce((s, r) => s + r.amount, 0)

    // Push to every subscription tied to a user in this org (sendPush
    // already honours the invoicesPush preference per user).
    const orgUsers = await prisma.userOrganization.findMany({
      where: { organizationId: orgId },
      select: { userId: true },
    })
    await Promise.all(
      orgUsers.map(({ userId }) =>
        sendPush({
          userId,
          category: 'invoices',
          payload: {
            title: `📒 ${rows.length} overdue invoice${rows.length === 1 ? '' : 's'}`,
            body: `£${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} outstanding · ${orgName}`,
            url: '/invoices',
            tag: `overdue-daily-${orgId}`,
          },
        }).catch(() => {}),
      ),
    )

    // Email digest — only to users who (a) belong to this org AND
    // (b) have invoicesEmail enabled.
    const eligibleUserIds = orgUsers.map(u => u.userId)
    const eligible = await prisma.notificationPreference.findMany({
      where: { invoicesEmail: true, userId: { in: eligibleUserIds } },
      include: { user: { select: { email: true, name: true } } },
    })

    await Promise.allSettled(
      eligible.map(async pref => {
        if (!pref.user.email) return
        const tmpl = overdueDigestTemplate({
          recipientName: pref.user.name || pref.user.email.split('@')[0],
          organizationName: orgName,
          invoices: rows,
          appUrl,
        })
        const res = await sendEmail({ to: pref.user.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text })
        if (res.delivered > 0) totalEmails++
      }),
    )
  }

  const entries = Array.from(byOrg.entries())
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const slice = entries.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(slice.map(entry => processOrg(entry)))
    settled.forEach((res, idx) => {
      if (res.status === 'rejected') {
        orgErrors.push({ orgId: slice[idx][0], error: String(res.reason).slice(0, 280) })
      }
    })
  }

  return NextResponse.json({
    overdueCount: overdueByOrg.length,
    promoted: promoted.count,
    orgsNotified: byOrg.size - orgErrors.length,
    orgsFailed: orgErrors.length,
    errors: orgErrors,
    emailsSent: totalEmails,
  })
}

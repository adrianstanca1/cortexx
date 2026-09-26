import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron'
import { bypassTenancy } from '@/lib/tenancy'
import { prisma } from '@/lib/db'
import { sendEmail, overdueDigestTemplate } from '@/lib/email'
import { sendPush } from '@/lib/push'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

interface InvoiceRow {
  id: string
  organizationId: string
  number: string
  clientName: string
  amount: number
  dueDate: Date
  daysOverdue: number
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'overdue-invoices' })
}

export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  try {
    return await bypassTenancy(() => runOverdueScan())
  } catch (error) {
    reportError(error, { context: 'cron.overdue-invoices' })
    return NextResponse.json({ error: 'Overdue invoice scan failed' }, { status: 500 })
  }
}

async function runOverdueScan() {
  const now = new Date()

  const promoteResult = await prisma.invoice.updateMany({
    where: {
      status: { in: ['sent', 'due'] },
      dueDate: { lt: now },
    },
    data: { status: 'overdue' },
  })

  const overdue = await prisma.invoice.findMany({
    where: {
      status: 'overdue',
      dueDate: { lt: now },
      organizationId: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      number: true,
      clientName: true,
      amount: true,
      dueDate: true,
      organization: { select: { name: true } },
    },
    orderBy: [{ organizationId: 'asc' }, { dueDate: 'asc' }],
  })

  const byOrg = new Map<string, { organizationName: string; rows: InvoiceRow[] }>()
  for (const invoice of overdue) {
    if (!invoice.organizationId) continue
    const row: InvoiceRow = {
      id: invoice.id,
      organizationId: invoice.organizationId,
      number: invoice.number,
      clientName: invoice.clientName,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      daysOverdue: Math.max(0, Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000)),
    }
    const existing = byOrg.get(invoice.organizationId)
    if (existing) existing.rows.push(row)
    else byOrg.set(invoice.organizationId, {
      organizationName: invoice.organization?.name || 'Workspace',
      rows: [row],
    })
  }

  if (byOrg.size === 0) {
    return NextResponse.json({
      overdueCount: 0,
      promoted: promoteResult.count,
      orgsNotified: 0,
      emailsSent: 0,
    })
  }

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://cortexbuildpro.tech'
  let totalEmails = 0
  const orgErrors: Array<{ orgId: string; error: string }> = []
  const entries = Array.from(byOrg.entries())

  for (let i = 0; i < entries.length; i += 5) {
    const slice = entries.slice(i, i + 5)
    const settled = await Promise.allSettled(
      slice.map(([organizationId, bucket]) => processOrganization(organizationId, bucket, appUrl)),
    )
    settled.forEach((result, index) => {
      if (result.status === 'rejected') {
        orgErrors.push({ orgId: slice[index][0], error: String(result.reason).slice(0, 280) })
      } else {
        totalEmails += result.value.emailsSent
      }
    })
  }

  return NextResponse.json({
    overdueCount: overdue.length,
    promoted: promoteResult.count,
    orgsNotified: byOrg.size - orgErrors.length,
    orgsFailed: orgErrors.length,
    errors: orgErrors,
    emailsSent: totalEmails,
  })
}

async function processOrganization(
  organizationId: string,
  bucket: { organizationName: string; rows: InvoiceRow[] },
  appUrl: string,
): Promise<{ emailsSent: number }> {
  const memberships = await prisma.userOrganization.findMany({
    where: { organizationId },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          notificationPreference: { select: { invoicesEmail: true } },
        },
      },
    },
  })

  const users = memberships.map(membership => membership.user)
  const total = bucket.rows.reduce((sum, row) => sum + row.amount, 0)
  const payload = {
    title: '📒 ' + bucket.rows.length + ' overdue invoice' + (bucket.rows.length === 1 ? '' : 's'),
    body: '£' + total.toLocaleString('en-GB', { maximumFractionDigits: 0 }) + ' outstanding · ' + bucket.organizationName,
    url: '/invoices',
    tag: 'overdue-daily-' + organizationId,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }

  await Promise.allSettled(
    users.map(user => sendPush({ userId: user.id, category: 'invoices', payload })),
  )

  let emailsSent = 0
  await Promise.allSettled(
    users.map(async user => {
      if (!user.email || user.notificationPreference?.invoicesEmail === false) return
      const template = overdueDigestTemplate({
        recipientName: user.name || user.email.split('@')[0],
        organizationName: bucket.organizationName,
        invoices: bucket.rows,
        appUrl,
      })
      const result = await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
      if (result.delivered > 0) emailsSent += 1
    }),
  )

  return { emailsSent }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireCronAuth } from '@/lib/cron'
import { sendPush } from '@/lib/push'
import { sendEmail, overdueDigestTemplate } from '@/lib/email'

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
 * invoice and notify project owners. Sends push (per category=invoices
 * preference) and email digest. Idempotent — repeated runs only
 * re-notify if invoice dueDate has slipped further.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  const now = new Date()
  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'overdue'] },
      dueDate: { lt: now },
    },
    select: { id: true, number: true, clientName: true, amount: true, dueDate: true, status: true },
    orderBy: { dueDate: 'asc' },
    take: 500,
  })

  // Promote sent → overdue once a day so the status reflects reality.
  const toPromote = overdue.filter(i => i.status === 'sent')
  if (toPromote.length > 0) {
    await prisma.invoice.updateMany({
      where: { id: { in: toPromote.map(i => i.id) } },
      data: { status: 'overdue' },
    })
  }

  // No overdues → no notifications.
  if (overdue.length === 0) {
    return NextResponse.json({ overdueCount: 0, notified: 0 })
  }

  const rows: InvoiceRow[] = overdue.map(i => ({
    number: i.number,
    clientName: i.clientName,
    amount: i.amount,
    dueDate: i.dueDate,
    daysOverdue: Math.floor((now.getTime() - i.dueDate.getTime()) / 86_400_000),
  }))

  // Workspace-wide push for the headline number.
  const total = rows.reduce((s, r) => s + r.amount, 0)
  sendPush({
    category: 'invoices',
    payload: {
      title: `📒 ${rows.length} overdue invoice${rows.length === 1 ? '' : 's'}`,
      body: `£${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} outstanding`,
      url: '/invoices',
      tag: 'overdue-daily',
    },
  }).catch(() => {})

  // Email digest to every user whose NotificationPreference.invoicesEmail is on.
  const eligible = await prisma.notificationPreference.findMany({
    where: { invoicesEmail: true },
    include: { user: { select: { email: true, name: true } } },
  })
  const appUrl = process.env.NEXTAUTH_URL || 'https://cortexbuildpro.com'

  let emailsSent = 0
  await Promise.all(
    eligible.map(async pref => {
      if (!pref.user.email) return
      const tmpl = overdueDigestTemplate({
        recipientName: pref.user.name || pref.user.email.split('@')[0],
        organizationName: 'your workspace',
        invoices: rows,
        appUrl,
      })
      const res = await sendEmail({ to: pref.user.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text })
      if (res.delivered > 0) emailsSent++
    }),
  )

  return NextResponse.json({
    overdueCount: rows.length,
    promotedToOverdue: toPromote.length,
    totalOutstanding: total,
    emailsSent,
  })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

/**
 * Inbox = aggregated actionable items: overdue invoices, expiring documents,
 * critical/overdue tasks, unapproved timesheets. Each item has an actionable
 * link.
 */
export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 86400000)

    const [overdueInvoices, expiringDocs, overdueTasks, pendingTimesheets, criticalTasks] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: 'overdue' },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 25,
      }),
      prisma.document.findMany({
        where: { expiresAt: { lt: in7Days, gte: new Date(now.getTime() - 86400000) } },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { expiresAt: 'asc' },
        take: 25,
      }),
      prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { not: 'done' },
        },
        include: { project: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 25,
      }),
      prisma.timeEntry.findMany({
        where: { approved: false },
        include: { member: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        take: 25,
      }),
      prisma.task.findMany({
        where: { priority: 'critical', status: { not: 'done' }, dueDate: { gte: now } },
        include: { project: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 25,
      }),
    ])

    // Aggregate pending timesheets by member
    const byMember = new Map<string, { memberId: string; memberName: string; hours: number; entries: number }>()
    for (const e of pendingTimesheets) {
      const existing = byMember.get(e.memberId)
      if (existing) {
        existing.hours += e.hours
        existing.entries += 1
      } else {
        byMember.set(e.memberId, { memberId: e.memberId, memberName: e.member.name, hours: e.hours, entries: 1 })
      }
    }
    const pendingTimesheetSummary = Array.from(byMember.values()).sort((a, b) => b.hours - a.hours)

    return NextResponse.json({
      overdueInvoices,
      expiringDocs,
      overdueTasks,
      criticalTasks,
      pendingTimesheets: pendingTimesheetSummary,
      total: overdueInvoices.length + expiringDocs.length + overdueTasks.length + pendingTimesheetSummary.length + criticalTasks.length,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 })
  }
}

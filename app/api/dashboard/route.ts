import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    // Run all queries in parallel. Use groupBy / aggregate for sums instead of
    // fetching full rows just to reduce.
    const [
      projects,
      tasks,
      team,
      recentInvoices,
      activities,
      hoursThisWeekAgg,
      hoursPerMember,
      invoiceTotalsByStatus,
    ] = await Promise.all([
      prisma.project.findMany({
        // Cap at 200 — the dashboard heat-grid renders fine up to that;
        // tenants with more need a paginated /projects view, not a
        // single-shot dashboard fetch.
        take: 200,
        where: { archivedAt: null },
        include: {
          _count: { select: { tasks: true, assignments: true } },
          assignments: { include: { member: true }, where: { onSite: true }, take: 4 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.task.findMany({
        where: { status: { not: 'done' } },
        include: { project: true, assignee: true },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 10,
      }),
      prisma.teamMember.findMany({
        take: 200,
        include: {
          assignments: { include: { project: true } },
          _count: { select: { timeEntries: true } },
        },
      }),
      // Only fetch the 5 most-recent invoices we actually display
      prisma.invoice.findMany({
        include: { project: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.activity.findMany({
        include: { project: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Sum hours this week without fetching every row (was iterating all
      // timeEntries just to reduce on .hours)
      prisma.timeEntry.aggregate({
        where: { date: { gte: weekStart } },
        _sum: { hours: true },
      }),
      prisma.timeEntry.groupBy({
        by: ['memberId'],
        where: { date: { gte: weekStart } },
        _sum: { hours: true },
      }),
      // Compute owed / cashflow across ALL invoices, not just the 5 displayed
      // (previously these sums only ran on recentInvoices — a correctness bug)
      prisma.invoice.groupBy({
        by: ['status'],
        _sum: { amount: true },
      }),
    ])

    const activeSites = projects.filter((p) => p.status === 'active').length
    const owed = invoiceTotalsByStatus
      .filter((r) => r.status === 'sent' || r.status === 'overdue')
      .reduce((sum, r) => sum + (r._sum.amount ?? 0), 0)
    const cashflow = invoiceTotalsByStatus
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + (r._sum.amount ?? 0), 0)
    const hoursThisWeek = hoursThisWeekAgg._sum.hours ?? 0

    const hoursMap = Object.fromEntries(hoursPerMember.map((h) => [h.memberId, h._sum.hours || 0]))
    const teamWithHours = team.map((member) => ({ ...member, hoursThisWeek: hoursMap[member.id] || 0 }))

    return NextResponse.json({
      projects,
      tasks,
      team: teamWithHours,
      invoices: recentInvoices,
      activities,
      stats: { cashflow, owed, hoursThisWeek, activeSites },
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}

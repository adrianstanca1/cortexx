import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30 = new Date(now.getTime() - 30 * 86400000)

    const [
      allProjects,
      allInvoices,
      taskStatusCounts,
      tasksByPriority,
      hoursThisWeek,
      hoursThisMonth,
      activityLast30,
    ] = await Promise.all([
      prisma.project.findMany({
        select: { id: true, name: true, status: true, progress: true, budget: true, spent: true, onSiteCount: true },
      }),
      prisma.invoice.findMany({
        select: { status: true, amount: true, projectId: true, paidDate: true, dueDate: true, project: { select: { name: true } } },
      }),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.task.groupBy({ by: ['priority'], _count: { _all: true } }),
      prisma.timeEntry.aggregate({ _sum: { hours: true }, where: { date: { gte: weekStart } } }),
      prisma.timeEntry.aggregate({ _sum: { hours: true }, where: { date: { gte: monthStart } } }),
      prisma.activity.count({ where: { createdAt: { gte: last30 } } }),
    ])

    const totalBudget = allProjects.reduce((s, p) => s + p.budget, 0)
    const totalSpent = allProjects.reduce((s, p) => s + p.spent, 0)
    const margin = totalBudget > 0 ? Math.round(((totalBudget - totalSpent) / totalBudget) * 100) : 0

    const totalInvoiced = allInvoices.reduce((s, i) => s + i.amount, 0)
    const paid = allInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const owed = allInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
    const overdue = allInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
    const collected = totalInvoiced > 0 ? Math.round((paid / totalInvoiced) * 100) : 0

    // Per-project margin & spend
    const projectMargins = allProjects
      .filter(p => p.budget > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        budget: p.budget,
        spent: p.spent,
        progress: p.progress,
        marginPct: Math.round(((p.budget - p.spent) / p.budget) * 100),
        spentPct: Math.round((p.spent / p.budget) * 100),
        overBudget: p.spent > p.budget,
      }))
      .sort((a, b) => a.marginPct - b.marginPct)

    const statusBreakdown = {
      active: allProjects.filter(p => p.status === 'active').length,
      snagging: allProjects.filter(p => p.status === 'snagging').length,
      quoting: allProjects.filter(p => p.status === 'quoting').length,
      complete: allProjects.filter(p => p.status === 'complete').length,
    }

    return NextResponse.json({
      finance: {
        totalBudget,
        totalSpent,
        marginPct: margin,
        totalInvoiced,
        paid,
        owed,
        overdue,
        collectedPct: collected,
      },
      projects: {
        total: allProjects.length,
        ...statusBreakdown,
        onSiteCount: allProjects.reduce((s, p) => s + p.onSiteCount, 0),
        margins: projectMargins,
      },
      tasks: {
        byStatus: Object.fromEntries(taskStatusCounts.map(t => [t.status, t._count._all])),
        byPriority: Object.fromEntries(tasksByPriority.map(t => [t.priority, t._count._all])),
        total: taskStatusCounts.reduce((s, t) => s + t._count._all, 0),
      },
      activity: {
        last30Days: activityLast30,
      },
      hours: {
        thisWeek: hoursThisWeek._sum.hours || 0,
        thisMonth: hoursThisMonth._sum.hours || 0,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Reports failed' }, { status: 500 })
  }
}

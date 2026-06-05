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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30 = new Date(now.getTime() - 30 * 86400000)
    // 6-month cost-forecasting window: include the current month + the 5
    // prior ones. Pull invoices, sub-invoices, and purchase orders in
    // that range; aggregate client-side by month so the SQL stays simple.
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [
      allProjects,
      allInvoices,
      taskStatusCounts,
      tasksByPriority,
      hoursThisWeek,
      hoursThisMonth,
      activityLast30,
      monthlySubInvoices,
      monthlyPOs,
      monthlyInvoices,
    ] = await Promise.all([
      // All find* queries here are capped at 5000 — for a tenant with
      // 100k+ rows, an uncapped query would OOM the pm2 worker (each row
      // is small but loaded into memory + serialised through Prisma).
      // Tenants needing larger reports should hit /api/export/* which
      // streams via a worker, not this dashboard rollup.
      prisma.project.findMany({
        take: 5000,
        select: { id: true, name: true, status: true, progress: true, budget: true, spent: true, onSiteCount: true },
      }),
      prisma.invoice.findMany({
        take: 5000,
        select: { status: true, amount: true, projectId: true, paidDate: true, dueDate: true, project: { select: { name: true } } },
      }),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.task.groupBy({ by: ['priority'], _count: { _all: true } }),
      prisma.timeEntry.aggregate({ _sum: { hours: true }, where: { date: { gte: weekStart } } }),
      prisma.timeEntry.aggregate({ _sum: { hours: true }, where: { date: { gte: monthStart } } }),
      prisma.activity.count({ where: { createdAt: { gte: last30 } } }),
      prisma.subInvoice.findMany({
        take: 5000,
        where: { invoiceDate: { gte: sixMonthsAgo } },
        select: { invoiceDate: true, grossAmount: true },
      }),
      prisma.purchaseOrder.findMany({
        take: 5000,
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, total: true },
      }),
      prisma.invoice.findMany({
        take: 5000,
        where: { issuedDate: { gte: sixMonthsAgo } },
        select: { issuedDate: true, amount: true },
      }),
    ])

    // Build the 6 monthly buckets in chronological order
    const monthBuckets: Array<{ ym: string; label: string; outflow: number; inflow: number; net: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthBuckets.push({
        ym,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        outflow: 0,
        inflow: 0,
        net: 0,
      })
    }
    const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    for (const s of monthlySubInvoices) {
      const b = monthBuckets.find(x => x.ym === ymOf(s.invoiceDate))
      if (b) b.outflow += s.grossAmount
    }
    for (const p of monthlyPOs) {
      const b = monthBuckets.find(x => x.ym === ymOf(p.createdAt))
      if (b) b.outflow += p.total
    }
    for (const i of monthlyInvoices) {
      const b = monthBuckets.find(x => x.ym === ymOf(i.issuedDate))
      if (b) b.inflow += i.amount
    }
    for (const b of monthBuckets) b.net = b.inflow - b.outflow

    // Naive forecast for next month: 3-month rolling average of the last
    // three buckets. Better than nothing, simple enough to explain.
    const recent3 = monthBuckets.slice(-3)
    const forecast = {
      outflow: recent3.reduce((s, b) => s + b.outflow, 0) / 3,
      inflow: recent3.reduce((s, b) => s + b.inflow, 0) / 3,
    }
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

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
      cashflow: {
        // 6 monthly buckets, oldest first; consumed by the cost-forecasting
        // chart on /reports.
        months: monthBuckets,
        forecast: {
          ym: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
          label: nextMonth.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          outflow: Math.round(forecast.outflow),
          inflow: Math.round(forecast.inflow),
          net: Math.round(forecast.inflow - forecast.outflow),
          basis: '3-month rolling average',
        },
      },
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Reports failed' }, { status: 500 })
  }
}

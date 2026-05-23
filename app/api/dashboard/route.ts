import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    const [projects, tasks, team, invoices, activities, timeEntries] = await Promise.all([
      prisma.project.findMany({
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
        include: {
          assignments: { include: { project: true } },
          _count: { select: { timeEntries: true } },
        },
      }),
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
      prisma.timeEntry.findMany({
        where: { date: { gte: weekStart } },
      }),
    ])

    const activeSites = projects.filter((p) => p.status === 'active').length
    const owed = invoices
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.amount, 0)
    const cashflow = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0)
    const hoursThisWeek = timeEntries.reduce((sum, e) => sum + e.hours, 0)

    const hoursPerMember = await prisma.timeEntry.groupBy({
      by: ['memberId'],
      where: { date: { gte: weekStart } },
      _sum: { hours: true },
    })
    const hoursMap = Object.fromEntries(hoursPerMember.map(h => [h.memberId, h._sum.hours || 0]))
    const teamWithHours = team.map(member => ({ ...member, hoursThisWeek: hoursMap[member.id] || 0 }))

    return NextResponse.json({
      projects,
      tasks,
      team: teamWithHours,
      invoices,
      activities,
      stats: { cashflow, owed, hoursThisWeek, activeSites },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}

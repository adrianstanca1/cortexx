import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'
import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

type DashboardActor = { orgRole: string | null; appRole: string; email: string }

function projectScope(actor: DashboardActor): Prisma.ProjectWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (['project_manager', 'foreman', 'operative'].includes(actor.appRole)) {
    return actor.email
      ? { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } }
      : { id: '__no_project_access__' }
  }
  return {}
}

function taskScope(actor: DashboardActor): Prisma.TaskWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (actor.appRole === 'operative') {
    return actor.email ? { assignee: { email: { equals: actor.email, mode: 'insensitive' } } } : { id: '__no_task_access__' }
  }
  if (actor.appRole === 'project_manager' || actor.appRole === 'foreman') {
    return actor.email
      ? { project: { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } } }
      : { id: '__no_task_access__' }
  }
  return {}
}

function teamScope(actor: DashboardActor): Prisma.TeamMemberWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (actor.appRole === 'operative') {
    return actor.email ? { email: { equals: actor.email, mode: 'insensitive' } } : { id: '__no_team_access__' }
  }
  if (actor.appRole === 'project_manager' || actor.appRole === 'foreman') {
    return actor.email
      ? { assignments: { some: { project: { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } } } } }
      : { id: '__no_team_access__' }
  }
  return {}
}

function timeScope(actor: DashboardActor): Prisma.TimeEntryWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (actor.appRole === 'operative') {
    return actor.email ? { member: { email: { equals: actor.email, mode: 'insensitive' } } } : { id: '__no_time_access__' }
  }
  if (actor.appRole === 'project_manager' || actor.appRole === 'foreman') {
    return actor.email
      ? { project: { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } } }
      : { id: '__no_time_access__' }
  }
  return {}
}

function activityScope(actor: DashboardActor): Prisma.ActivityWhereInput {
  if (canManage(actor.orgRole || '')) return {}
  if (['project_manager', 'foreman', 'operative'].includes(actor.appRole)) {
    return actor.email
      ? { project: { assignments: { some: { member: { email: { equals: actor.email, mode: 'insensitive' } } } } } }
      : { id: '__no_activity_access__' }
  }
  return {}
}

async function GET_impl(actor: DashboardActor) {
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    const financeAdmin = canManage(actor.orgRole || '')
    const projectWhere: Prisma.ProjectWhereInput = { archivedAt: null, ...projectScope(actor) }
    const taskWhere: Prisma.TaskWhereInput = { status: { not: 'done' }, ...taskScope(actor) }
    const teamWhere = teamScope(actor)
    const timeWhere: Prisma.TimeEntryWhereInput = { date: { gte: weekStart }, ...timeScope(actor) }
    const activityWhere = activityScope(actor)

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
        take: 200,
        where: projectWhere,
        include: {
          _count: { select: { tasks: true, assignments: true } },
          assignments: { include: { member: true }, where: { onSite: true }, take: 4 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.task.findMany({
        where: taskWhere,
        include: { project: true, assignee: true },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 10,
      }),
      prisma.teamMember.findMany({
        where: teamWhere,
        take: 200,
        include: {
          assignments: { include: { project: true } },
          _count: { select: { timeEntries: true } },
        },
      }),
      financeAdmin
        ? prisma.invoice.findMany({ include: { project: true }, orderBy: { createdAt: 'desc' }, take: 5 })
        : Promise.resolve([]),
      prisma.activity.findMany({
        where: activityWhere,
        include: { project: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.timeEntry.aggregate({ where: timeWhere, _sum: { hours: true } }),
      prisma.timeEntry.groupBy({ by: ['memberId'], where: timeWhere, _sum: { hours: true } }),
      financeAdmin
        ? prisma.invoice.groupBy({ by: ['status'], _sum: { amount: true } })
        : Promise.resolve([]),
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

export const GET = withRoute(
  ({ session, role }) => GET_impl({ orgRole: role, appRole: session.user?.role || '', email: session.user?.email?.trim() || '' }),
  { permission: 'read' },
)

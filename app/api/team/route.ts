import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute } from '@/lib/withRoute'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export const GET = withRoute(
  async () => {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)

  const members = await prisma.teamMember.findMany({
    // Cap at 500 — protects against runaway responses on big tenants.
    // A workspace with >500 members would need a paginated view
    // anyway; for now the cap is a backstop, not a UX requirement.
    take: 500,
    include: {
      assignments: { include: { project: true } },
      timeEntries: { where: { date: { gte: weekStart } } },
      certifications: {
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
        include: { course: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = members.map((m) => ({
    ...m,
    hoursThisWeek: m.timeEntries.reduce((s, e) => s + e.hours, 0),
  }))

  return NextResponse.json({ team: result })
  },
  { requireOrg: false }
)

export const POST = withRoute(
  async ({ req, userId }) => {
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!body.role?.trim()) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }
    if (body.dailyRate !== undefined && body.dailyRate !== null && body.dailyRate !== '' && (!Number.isFinite(Number(body.dailyRate)) || Number(body.dailyRate) < 0)) {
      return NextResponse.json({ error: 'Daily rate must be a non-negative number' }, { status: 400 })
    }

    try {
      const member = await prisma.teamMember.create({
        data: {
          name: body.name.trim(),
          role: body.role.trim(),
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          avatarColor: body.avatarColor || '#2563eb',
          dailyRate: body.dailyRate ? Number(body.dailyRate) : 0,
          onSite: body.onSite || false,
        },
      })
      auditLog({
        action: 'teamMember.create',
        resourceType: 'TeamMember',
        resourceId: member.id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json(member, { status: 201 })
    } catch (error) {
      reportError(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Team member already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'write' }
)

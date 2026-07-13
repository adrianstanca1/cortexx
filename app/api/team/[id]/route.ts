import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute } from '@/lib/withRoute'
import { actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function extractId(req: NextRequest): string | null {
  return req.nextUrl.pathname.split('/').pop() || null
}

export const GET = withRoute(
  async ({ req }) => {
  const id = extractId(req)
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  try {
    const member = await prisma.teamMember.findUnique({
      where: { id },
      include: {
        assignments: { include: { project: true } },
        timeEntries: { orderBy: { date: 'desc' }, take: 20 },
        certifications: {
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
          include: { course: { select: { id: true, name: true } } },
        },
      },
    })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ member })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch team member' }, { status: 500 })
  }
  },
  { requireOrg: false }
)

export const PUT = withRoute(
  async ({ req, userId }) => {
    const id = extractId(req)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    const body = await req.json()
    if (body.dailyRate !== undefined && (!Number.isFinite(Number(body.dailyRate)) || Number(body.dailyRate) < 0)) {
      return NextResponse.json({ error: 'Daily rate must be a non-negative number' }, { status: 400 })
    }
    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    if (body.role !== undefined && !body.role?.trim()) {
      return NextResponse.json({ error: 'Role cannot be empty' }, { status: 400 })
    }

    try {
      const member = await prisma.teamMember.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name.trim() }),
          ...(body.role !== undefined && { role: body.role.trim() }),
          ...(body.email !== undefined && { email: body.email?.trim() || null }),
          ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
          ...(body.avatarColor !== undefined && { avatarColor: body.avatarColor }),
          ...(body.dailyRate !== undefined && { dailyRate: Number(body.dailyRate) }),
          ...(body.onSite !== undefined && { onSite: body.onSite }),
        },
      })
      auditLog({
        action: 'teamMember.update',
        resourceType: 'TeamMember',
        resourceId: id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json(member)
    } catch (error) {
      reportError(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'write' }
)

export const DELETE = withRoute(
  async ({ req, userId, session }) => {
    const id = extractId(req)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    try {
      const member = await prisma.teamMember.findUnique({ where: { id }, select: { name: true } })
      await prisma.teamMember.delete({ where: { id } })
      auditLog({
        action: 'teamMember.delete',
        resourceType: 'TeamMember',
        resourceId: id,
        userId,
        ...requestMeta(req),
      })
      if (member) {
        prisma.activity.create({
          data: {
            projectId: null,
            actorName: actorName(session),
            actorType: 'human',
            action: `removed ${member.name} from team`,
            iconType: 'hardhat',
          },
        }).catch(() => {})
      }
      return NextResponse.json({ success: true })
    } catch (error) {
      reportError(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'write' }
)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const member = await prisma.teamMember.findUnique({
      where: { id: params.id },
      include: {
        assignments: { include: { project: true } },
        timeEntries: { orderBy: { date: 'desc' }, take: 20 },
      },
    })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ member })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch team member' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const body = await req.json()
    if (body.dailyRate !== undefined && (isNaN(Number(body.dailyRate)) || Number(body.dailyRate) < 0)) {
      return NextResponse.json({ error: 'Daily rate must be a non-negative number' }, { status: 400 })
    }
    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    if (body.role !== undefined && !body.role?.trim()) {
      return NextResponse.json({ error: 'Role cannot be empty' }, { status: 400 })
    }
    const member = await prisma.teamMember.update({
      where: { id: params.id },
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
    return NextResponse.json(member)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const member = await prisma.teamMember.findUnique({ where: { id: params.id }, select: { name: true } })
    await prisma.teamMember.delete({ where: { id: params.id } })
    auditLog({
      action: 'teamMember.delete',
      resourceType: 'TeamMember',
      resourceId: params.id,
      ...requestMeta(req),
    })
    if (member) {
      prisma.activity.create({
        data: {
          projectId: null,
          actorName: actorName(auth),
          actorType: 'human',
          action: `removed ${member.name} from team`,
          iconType: 'hardhat',
        },
      }).catch(() => {})
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
  }
}

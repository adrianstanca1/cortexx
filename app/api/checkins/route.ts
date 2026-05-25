import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const memberId = searchParams.get('memberId')
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(projectId && { projectId }),
      ...(memberId && { memberId }),
      ...(activeOnly && { checkedOutAt: null }),
    }
    const [checkins, activeCount] = await Promise.all([
      prisma.siteCheckIn.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, role: true, avatarColor: true } },
          project: { select: { id: true, name: true, address: true } },
        },
        orderBy: { checkedInAt: 'desc' },
        take,
      }),
      prisma.siteCheckIn.count({ where: { ...where, checkedOutAt: null } }),
    ])
    return NextResponse.json({ checkins, activeCount })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const memberId = String(body.memberId || '').trim()
    if (!memberId) return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const [member, project] = await Promise.all([
      prisma.teamMember.findUnique({ where: { id: memberId }, select: { id: true, name: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    ])
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 400 })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const active = await prisma.siteCheckIn.findFirst({
      where: { memberId, checkedOutAt: null },
      select: { id: true },
    })
    if (active) return NextResponse.json({ error: 'Already checked in — check out first' }, { status: 409 })

    const lat = body.latitude !== undefined && body.latitude !== null ? Number(body.latitude) : null
    const lng = body.longitude !== undefined && body.longitude !== null ? Number(body.longitude) : null

    const checkin = await prisma.$transaction(async tx => {
      const created = await tx.siteCheckIn.create({
        data: {
          memberId,
          projectId,
          latitudeIn: lat !== null && !isNaN(lat) ? lat : null,
          longitudeIn: lng !== null && !isNaN(lng) ? lng : null,
          notes: body.notes?.toString().trim() || null,
        },
        include: {
          member: { select: { id: true, name: true, role: true, avatarColor: true } },
          project: { select: { id: true, name: true } },
        },
      })
      await tx.teamMember.update({ where: { id: memberId }, data: { onSite: true } })
      await tx.project.update({
        where: { id: projectId },
        data: { onSiteCount: { increment: 1 } },
      })
      return created
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `checked in: ${member.name}`,
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json(checkin, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 })
  }
}

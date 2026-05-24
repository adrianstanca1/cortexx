import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const entry = await prisma.timeEntry.findUnique({
      where: { id: params.id },
      include: { member: true, project: true },
    })
    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch time entry' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.hours !== undefined) {
      const h = Number(body.hours)
      if (isNaN(h) || h <= 0 || h > 24) {
        return NextResponse.json({ error: 'Hours must be > 0 and ≤ 24' }, { status: 400 })
      }
    }
    const entry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: {
        ...(body.hours !== undefined && { hours: Number(body.hours) }),
        ...(body.approved !== undefined && { approved: body.approved }),
        ...(body.projectId !== undefined && { projectId: body.projectId }),
      },
      include: { member: true, project: true },
    })
    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const entry = await prisma.timeEntry.findUnique({
      where: { id: params.id },
      select: { hours: true, projectId: true, member: { select: { name: true } } },
    })
    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    await prisma.timeEntry.delete({ where: { id: params.id } })
    prisma.activity.create({
      data: {
        projectId: entry.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted ${entry.hours}h time entry for ${entry.member?.name || 'member'}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPE = new Set(['positive', 'improvement', 'unsafe', 'near_miss'])
const ALLOWED_STATUS = new Set(['open', 'resolved'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.observation.findUnique({ where: { id: params.id }, select: { status: true, projectId: true, title: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextStatus = body.status !== undefined
      ? (ALLOWED_STATUS.has(body.status) ? body.status : existing.status)
      : existing.status
    const justResolved = existing.status === 'open' && nextStatus === 'resolved'
    const reopened = existing.status === 'resolved' && nextStatus === 'open'

    if (body.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.description !== undefined) data.description = body.description?.toString().trim() || null
    if (body.location !== undefined) data.location = body.location?.toString().trim() || null
    if (body.type !== undefined && ALLOWED_TYPE.has(body.type)) data.type = body.type
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null
    if (body.status !== undefined) data.status = nextStatus
    if (justResolved) data.resolvedAt = new Date()
    if (reopened) data.resolvedAt = null

    const observation = await prisma.observation.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (justResolved || reopened) {
      prisma.activity.create({
        data: {
          projectId: observation.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: justResolved ? `resolved observation: ${observation.title}` : `reopened observation: ${observation.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(observation)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update observation' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.observation.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete observation' }, { status: 500 })
  }
}

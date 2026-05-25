import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['open', 'in_progress', 'closed'])
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high', 'critical'])

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const snag = await prisma.snag.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } } },
  })
  if (!snag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ snag })
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.snag.findUnique({ where: { id: params.id }, select: { status: true, projectId: true, title: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextStatus = body.status !== undefined
      ? (ALLOWED_STATUS.has(body.status) ? body.status : existing.status)
      : existing.status
    const justClosed = existing.status !== 'closed' && nextStatus === 'closed'
    const reopened = existing.status === 'closed' && nextStatus !== 'closed'

    let dueDateUpdate: { dueDate: Date | null } | Record<string, never> = {}
    if (body.dueDate !== undefined) {
      if (body.dueDate) {
        const d = new Date(body.dueDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
        dueDateUpdate = { dueDate: d }
      } else {
        dueDateUpdate = { dueDate: null }
      }
    }

    if (body.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

    const snag = await prisma.snag.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined && { title: String(body.title).trim() }),
        ...(body.description !== undefined && { description: body.description?.toString().trim() || null }),
        ...(body.location !== undefined && { location: body.location?.toString().trim() || null }),
        ...(body.priority !== undefined && ALLOWED_PRIORITY.has(body.priority) && { priority: body.priority }),
        ...(body.status !== undefined && { status: nextStatus }),
        ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl || null }),
        ...dueDateUpdate,
        closedAt: justClosed ? new Date() : reopened ? null : undefined,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    if (justClosed || reopened) {
      prisma.activity.create({
        data: {
          projectId: snag.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: justClosed ? `closed snag: ${snag.title}` : `reopened snag: ${snag.title}`,
          iconType: 'alert',
        },
      }).catch(() => {})
    }

    return NextResponse.json(snag)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update snag' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const snag = await prisma.snag.findUnique({ where: { id: params.id }, select: { projectId: true, title: true } })
    if (!snag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.snag.delete({ where: { id: params.id } })
    auditLog({
      action: 'snag.delete',
      resourceType: 'Snag',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: snag.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted snag: ${snag.title}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete snag' }, { status: 500 })
  }
}

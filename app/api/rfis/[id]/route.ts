import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['open', 'answered', 'closed'])
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high'])

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const rfi = await prisma.rfi.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } } },
  })
  if (!rfi) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ rfi })
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.rfi.findUnique({
      where: { id: params.id },
      select: { status: true, projectId: true, number: true, subject: true, response: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextStatus = body.status !== undefined
      ? (ALLOWED_STATUS.has(body.status) ? body.status : existing.status)
      : existing.status
    const justAnswered = existing.status === 'open' && nextStatus === 'answered'
    const justClosed = existing.status !== 'closed' && nextStatus === 'closed'
    const reopened = existing.status !== 'open' && nextStatus === 'open'

    if (body.subject !== undefined && !String(body.subject).trim()) {
      return NextResponse.json({ error: 'Subject cannot be empty' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (body.subject !== undefined) data.subject = String(body.subject).trim()
    if (body.body !== undefined) data.body = String(body.body).trim()
    if (body.status !== undefined) data.status = nextStatus
    if (body.priority !== undefined && ALLOWED_PRIORITY.has(body.priority)) data.priority = body.priority
    if (body.assignee !== undefined) data.assignee = body.assignee?.toString().trim() || null
    if (body.response !== undefined) data.response = body.response?.toString().trim() || null
    if (body.dueDate !== undefined) {
      if (body.dueDate) {
        const d = new Date(body.dueDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
        data.dueDate = d
      } else data.dueDate = null
    }
    if (justAnswered || (body.response && !existing.response)) data.respondedAt = new Date()
    if (justClosed) data.closedAt = new Date()
    if (reopened) data.closedAt = null

    const rfi = await prisma.rfi.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (justAnswered || justClosed || reopened) {
      prisma.activity.create({
        data: {
          projectId: rfi.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: justAnswered
            ? `answered ${rfi.number}: ${rfi.subject}`
            : justClosed
              ? `closed ${rfi.number}: ${rfi.subject}`
              : `reopened ${rfi.number}: ${rfi.subject}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(rfi)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update RFI' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const rfi = await prisma.rfi.findUnique({ where: { id: params.id }, select: { projectId: true, number: true, subject: true } })
    if (!rfi) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.rfi.delete({ where: { id: params.id } })
    auditLog({
      action: 'rfi.delete',
      resourceType: 'Rfi',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: rfi.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted ${rfi.number}: ${rfi.subject}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete RFI' }, { status: 500 })
  }
}

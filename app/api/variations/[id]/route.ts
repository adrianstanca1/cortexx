import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['draft', 'submitted', 'approved', 'rejected'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.variation.findUnique({ where: { id: params.id }, select: { status: true, projectId: true, number: true, title: true, costImpact: true, daysImpact: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const nextStatus = body.status !== undefined
      ? (ALLOWED_STATUS.has(body.status) ? body.status : existing.status)
      : existing.status

    if (body.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.description !== undefined) data.description = body.description?.toString().trim() || null
    if (body.clientName !== undefined) data.clientName = body.clientName?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.costImpact !== undefined) {
      const v = Number(body.costImpact)
      if (isNaN(v)) return NextResponse.json({ error: 'Cost impact must be a number' }, { status: 400 })
      data.costImpact = v
    }
    if (body.daysImpact !== undefined) {
      const v = parseInt(body.daysImpact)
      if (isNaN(v)) return NextResponse.json({ error: 'Days impact must be a whole number' }, { status: 400 })
      data.daysImpact = v
    }
    if (body.status !== undefined) {
      data.status = nextStatus
      if (existing.status !== 'submitted' && nextStatus === 'submitted') data.submittedAt = new Date()
      if (existing.status !== 'approved' && nextStatus === 'approved') data.approvedAt = new Date()
      if (existing.status !== 'rejected' && nextStatus === 'rejected') data.rejectedAt = new Date()
    }

    const variation = await prisma.variation.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true, budget: true, clientName: true } } },
    })

    if (body.status !== undefined && existing.status !== nextStatus) {
      const verb = nextStatus === 'submitted' ? 'submitted'
        : nextStatus === 'approved' ? 'approved'
        : nextStatus === 'rejected' ? 'rejected'
        : 'reverted to draft'
      prisma.activity.create({
        data: {
          projectId: variation.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `${verb} ${variation.number}: ${variation.title}`,
          iconType: 'wrench',
        },
      }).catch(() => {})
    }

    return NextResponse.json(variation)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update variation' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const v = await prisma.variation.findUnique({ where: { id: params.id }, select: { projectId: true, number: true, title: true } })
    if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.variation.delete({ where: { id: params.id } })
    prisma.activity.create({
      data: {
        projectId: v.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted ${v.number}: ${v.title}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete variation' }, { status: 500 })
  }
}

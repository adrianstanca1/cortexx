import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['planned', 'in_progress', 'complete', 'slipped'])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.milestone.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (body.plannedStart) {
      const d = new Date(body.plannedStart)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid plannedStart' }, { status: 400 })
      data.plannedStart = d
    }
    if (body.plannedEnd) {
      const d = new Date(body.plannedEnd)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid plannedEnd' }, { status: 400 })
      data.plannedEnd = d
    }
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) {
      data.status = body.status
      if (body.status === 'complete') data.actualEnd = data.actualEnd || new Date()
      if (body.status !== 'complete') data.actualEnd = null
    }
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 1000) || null

    const startCheck = (data.plannedStart || existing.plannedStart) as Date
    const endCheck = (data.plannedEnd || existing.plannedEnd) as Date
    if (endCheck < startCheck) {
      return NextResponse.json({ error: 'plannedEnd must be on or after plannedStart' }, { status: 400 })
    }

    const milestone = await prisma.milestone.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true, status: true } } },
    })

    if (data.status === 'complete' && existing.status !== 'complete') {
      prisma.activity.create({
        data: {
          projectId: milestone.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `completed milestone: ${milestone.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(milestone)
  } catch (error) {
    console.error('[milestones/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const m = await prisma.milestone.findUnique({ where: { id: params.id } })
    if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.milestone.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[milestones/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['planned', 'in_progress', 'complete', 'slipped'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = {
      ...(projectId && { projectId }),
    }
    if (from || to) {
      const range: { gte?: Date; lte?: Date } = {}
      if (from) {
        const d = new Date(from)
        if (!isNaN(d.getTime())) range.gte = d
      }
      if (to) {
        const d = new Date(to)
        if (!isNaN(d.getTime())) range.lte = d
      }
      where.plannedStart = range
    }

    const milestones = await prisma.milestone.findMany({
      where,
      include: { project: { select: { id: true, name: true, status: true } } },
      orderBy: [{ plannedStart: 'asc' }],
      take: 500,
    })
    return NextResponse.json({ milestones })
  } catch (error) {
    console.error('[milestones] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const plannedStart = body.plannedStart ? new Date(body.plannedStart) : null
    const plannedEnd = body.plannedEnd ? new Date(body.plannedEnd) : null
    if (!plannedStart || isNaN(plannedStart.getTime())) return NextResponse.json({ error: 'Invalid plannedStart' }, { status: 400 })
    if (!plannedEnd || isNaN(plannedEnd.getTime())) return NextResponse.json({ error: 'Invalid plannedEnd' }, { status: 400 })
    if (plannedEnd < plannedStart) return NextResponse.json({ error: 'plannedEnd must be on or after plannedStart' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'planned'

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        plannedStart,
        plannedEnd,
        status,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 1000) : null,
      },
      include: { project: { select: { id: true, name: true, status: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `added milestone: ${milestone.title}`,
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json(milestone, { status: 201 })
  } catch (error) {
    console.error('[milestones] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    const where: Record<string, unknown> = {
      ...(projectId && { projectId }),
    }
    if (fromParam || toParam) {
      const range: { gte?: Date; lte?: Date } = {}
      if (fromParam) { const d = new Date(fromParam); if (!isNaN(d.getTime())) range.gte = d }
      if (toParam) { const d = new Date(toParam); if (!isNaN(d.getTime())) range.lte = d }
      where.date = range
    }

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const [talks, monthCount] = await Promise.all([
      prisma.toolboxTalk.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }],
        take: 200,
      }),
      prisma.toolboxTalk.count({ where: { ...where, date: { gte: startOfMonth } } }),
    ])
    return NextResponse.json({ talks, monthCount })
  } catch (error) {
    console.error('[toolbox-talks] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch toolbox talks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const topic = String(body.topic || '').trim()
    if (!topic) return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
    if (body.date === undefined || body.date === null || body.date === '') {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }
    const date = parseDate(body.date)
    if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

    let projectId: string | null = null
    if (body.projectId) {
      projectId = String(body.projectId).trim() || null
      if (projectId) {
        const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
        if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
      }
    }

    const attendees = typeof body.attendees === 'string' && body.attendees ? body.attendees.slice(0, 4000) : null
    // Derive attendee count from non-empty lines when not provided explicitly.
    const explicitCount = Number(body.attendeeCount)
    const attendeeCount = isFinite(explicitCount) && explicitCount >= 0
      ? Math.min(500, Math.floor(explicitCount))
      : (attendees ? attendees.split(/\n/).map((l: string) => l.trim()).filter(Boolean).length : 0)

    const talk = await prisma.toolboxTalk.create({
      data: {
        projectId,
        date,
        topic: topic.slice(0, 200),
        location: typeof body.location === 'string' && body.location ? body.location.slice(0, 200) : null,
        deliveredBy: typeof body.deliveredBy === 'string' && body.deliveredBy ? body.deliveredBy.slice(0, 100) : actorName(auth),
        attendees,
        attendeeCount,
        hazardsCovered: typeof body.hazardsCovered === 'string' && body.hazardsCovered ? body.hazardsCovered.slice(0, 2000) : null,
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 2000) : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    if (projectId) {
      prisma.activity.create({
        data: {
          projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `logged toolbox talk: ${talk.topic} (${attendeeCount} attendees)`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(talk, { status: 201 })
  } catch (error) {
    console.error('[toolbox-talks] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create toolbox talk' }, { status: 500 })
  }
}

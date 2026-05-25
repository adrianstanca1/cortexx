import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['scheduled', 'completed', 'cancelled'])

interface ActionItem { id: string; title: string; assignee?: string; dueDate?: string; done?: boolean }

function sanitizeActions(raw: unknown): ActionItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((i): i is ActionItem => !!i && typeof i === 'object'
      && typeof (i as ActionItem).title === 'string'
      && (i as ActionItem).title.trim().length > 0)
    .slice(0, 50)
    .map((i, idx) => ({
      id: typeof i.id === 'string' && i.id ? i.id.slice(0, 40) : `act-${idx}`,
      title: i.title.trim().slice(0, 300),
      assignee: typeof i.assignee === 'string' && i.assignee ? i.assignee.slice(0, 100) : undefined,
      dueDate: typeof i.dueDate === 'string' && i.dueDate ? i.dueDate.slice(0, 30) : undefined,
      done: !!i.done,
    }))
}

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(v as string); return isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [meetings, upcomingCount] = await Promise.all([
      prisma.meeting.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ scheduledAt: 'desc' }],
        take: 200,
      }),
      prisma.meeting.count({
        where: { ...where, status: 'scheduled', scheduledAt: { gte: new Date() } },
      }),
    ])
    return NextResponse.json({ meetings, upcomingCount })
  } catch (error) {
    console.error('[meetings] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (body.scheduledAt === undefined || body.scheduledAt === null || body.scheduledAt === '') {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
    }
    const scheduledAt = parseDate(body.scheduledAt)
    if (!scheduledAt) return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 })

    let projectId: string | null = null
    if (body.projectId) {
      projectId = String(body.projectId).trim() || null
      if (projectId) {
        const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
        if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
      }
    }

    const duration = Math.max(5, Math.min(480, Number(body.durationMin) || 60))

    const meeting = await prisma.meeting.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        location: typeof body.location === 'string' && body.location ? body.location.slice(0, 200) : null,
        scheduledAt,
        durationMin: duration,
        attendees: typeof body.attendees === 'string' && body.attendees ? body.attendees.slice(0, 2000) : null,
        minutes: typeof body.minutes === 'string' && body.minutes ? body.minutes.slice(0, 10000) : null,
        actionItems: sanitizeActions(body.actionItems) as unknown as object,
        status: ALLOWED_STATUS.has(body.status) ? body.status : 'scheduled',
      },
      include: { project: { select: { id: true, name: true } } },
    })

    if (projectId) {
      prisma.activity.create({
        data: {
          projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `scheduled meeting: ${meeting.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }

    return NextResponse.json(meeting, { status: 201 })
  } catch (error) {
    console.error('[meetings] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
}

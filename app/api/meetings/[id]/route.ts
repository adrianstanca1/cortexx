import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

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

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.meeting.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.location === 'string') data.location = body.location.slice(0, 200) || null
    if (typeof body.attendees === 'string') data.attendees = body.attendees.slice(0, 2000) || null
    if (typeof body.minutes === 'string') data.minutes = body.minutes.slice(0, 10000) || null
    if (Array.isArray(body.actionItems)) data.actionItems = sanitizeActions(body.actionItems) as unknown as object
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (typeof body.durationMin !== 'undefined') {
      const d = Number(body.durationMin)
      if (!isFinite(d) || d < 5 || d > 480) return NextResponse.json({ error: 'durationMin must be 5-480' }, { status: 400 })
      data.durationMin = d
    }
    if ('scheduledAt' in body) {
      const d = parseDate(body.scheduledAt)
      if (d === undefined && body.scheduledAt) return NextResponse.json({ error: 'Invalid scheduledAt' }, { status: 400 })
      if (d === null) return NextResponse.json({ error: 'scheduledAt cannot be null' }, { status: 400 })
      data.scheduledAt = d
    }

    const meeting = await prisma.meeting.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.status === 'completed' && existing.status !== 'completed' && meeting.projectId) {
      prisma.activity.create({
        data: {
          projectId: meeting.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `completed meeting: ${meeting.title}`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(meeting)
  } catch (error) {
    console.error('[meetings/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const m = await prisma.meeting.findUnique({ where: { id: params.id } })
    if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.meeting.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[meetings/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}

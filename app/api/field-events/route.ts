import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { actorName } from '@/lib/requireAuth'
import { createActivity } from '@/lib/activity'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

const TYPES = new Set(['delivery', 'delay', 'instruction', 'access', 'labour', 'quality', 'safety', 'progress', 'weather', 'other'])
const SEVERITIES = new Set(['info', 'attention', 'urgent'])
const ICONS: Record<string, string> = {
  delivery: 'truck',
  delay: 'alert',
  instruction: 'doc',
  access: 'pin',
  labour: 'team',
  quality: 'check',
  safety: 'hardhat',
  progress: 'check',
  weather: 'alert',
  other: 'doc',
}

type FieldEventDetail = {
  v: 1
  type: string
  title: string
  detail?: string
  location?: string
  severity: string
  occurredAt: string
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function parseDate(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function decode(activity: { id: string; projectId: string | null; actorName: string; action: string; detail: string | null; iconType: string; createdAt: Date }) {
  try {
    const parsed = activity.detail ? JSON.parse(activity.detail) as Partial<FieldEventDetail> : {}
    return {
      id: activity.id,
      projectId: activity.projectId,
      actorName: activity.actorName,
      type: TYPES.has(String(parsed.type)) ? String(parsed.type) : 'other',
      title: clean(parsed.title || activity.action.replace(/^field event:\s*[^—-]+[—-]\s*/i, ''), 220),
      detail: clean(parsed.detail, 1000) || null,
      location: clean(parsed.location, 160) || null,
      severity: SEVERITIES.has(String(parsed.severity)) ? String(parsed.severity) : 'info',
      occurredAt: parseDate(String(parsed.occurredAt || ''))?.toISOString() || activity.createdAt.toISOString(),
      createdAt: activity.createdAt.toISOString(),
      iconType: activity.iconType,
    }
  } catch {
    return {
      id: activity.id,
      projectId: activity.projectId,
      actorName: activity.actorName,
      type: 'other',
      title: clean(activity.action, 220),
      detail: activity.detail,
      location: null,
      severity: 'info',
      occurredAt: activity.createdAt.toISOString(),
      createdAt: activity.createdAt.toISOString(),
      iconType: activity.iconType,
    }
  }
}

async function GET_impl(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = clean(searchParams.get('projectId'), 100)
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    const take = Math.min(Math.max(Number(searchParams.get('take')) || 40, 1), 100)
    const type = clean(searchParams.get('type'), 40)
    const date = clean(searchParams.get('date'), 20)

    const day = date ? parseDate(date) : null
    const next = day ? new Date(day) : null
    if (day) day.setHours(0, 0, 0, 0)
    if (next) { next.setHours(0, 0, 0, 0); next.setDate(next.getDate() + 1) }

    const rows = await prisma.activity.findMany({
      where: {
        projectId,
        action: { startsWith: 'field event:' },
        ...(day && next ? { createdAt: { gte: day, lt: next } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take * 3, 300),
      select: { id: true, projectId: true, actorName: true, action: true, detail: true, iconType: true, createdAt: true },
    })
    const events = rows.map(decode).filter(event => !type || event.type === type).slice(0, take)
    return NextResponse.json({ events, count: events.length })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load field events' }, { status: 500 })
  }
}

async function POST_impl(req: NextRequest, userId: string, session: { user?: { name?: string | null; email?: string | null } }) {
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const projectId = clean(body.projectId, 100)
    const type = TYPES.has(String(body.type)) ? String(body.type) : 'other'
    const severity = SEVERITIES.has(String(body.severity)) ? String(body.severity) : 'info'
    const title = clean(body.title, 220)
    const detail = clean(body.detail, 1000)
    const location = clean(body.location, 160)
    const occurredAt = parseDate(body.occurredAt ? String(body.occurredAt) : null) || new Date()

    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const payload: FieldEventDetail = {
      v: 1,
      type,
      title,
      ...(detail ? { detail } : {}),
      ...(location ? { location } : {}),
      severity,
      occurredAt: occurredAt.toISOString(),
    }

    const activity = await createActivity({
      projectId,
      actorName: clean(actorName(session), 100),
      actorType: 'human',
      action: `field event: ${type} — ${title}`,
      detail: JSON.stringify(payload),
      iconType: ICONS[type] || 'doc',
    })

    return NextResponse.json({ event: decode(activity) }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create field event' }, { status: 500 })
  }
}

export const GET = withRoute(({ req }) => GET_impl(req), { permission: 'read' })
export const POST = withRoute(({ req, userId, session }) => POST_impl(req, userId, session), { permission: 'write' })

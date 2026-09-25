import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { createActivity } from '@/lib/activity'

import { withRoute } from '@/lib/withRoute'

export const dynamic = 'force-dynamic'

/**
 * Site diary — aggregates a single day's activity for a project from
 * existing data: TimeEntry (hours on site), Activity (audit feed),
 * Snag (raised that day), Document (photos / RAMS uploaded that day).
 * No new model — pure aggregation over what /capture / /check-in /
 * /snags / /photos already write.
 */
async function GET_impl(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const dateParam = searchParams.get('date') // YYYY-MM-DD
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const day = dateParam ? new Date(dateParam) : new Date()
    if (isNaN(day.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, address: true, postcode: true, onSiteCount: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const [timeEntries, activities, snagsRaised, snagsClosed, documents] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { projectId, date: { gte: day, lt: next } },
        include: { member: { select: { id: true, name: true, role: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.activity.findMany({
        where: { projectId, createdAt: { gte: day, lt: next } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.snag.findMany({
        where: { projectId, createdAt: { gte: day, lt: next } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.snag.findMany({
        where: { projectId, closedAt: { gte: day, lt: next } },
        orderBy: { closedAt: 'asc' },
      }),
      prisma.document.findMany({
        where: { projectId, createdAt: { gte: day, lt: next } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
    ])

    const hoursTotal = timeEntries.reduce((s, e) => s + e.hours, 0)
    const peopleOnSite = new Set(timeEntries.map(e => e.memberId)).size
    const photos = documents.filter(d => d.type === 'photo')
    const otherDocs = documents.filter(d => d.type !== 'photo')

    return NextResponse.json({
      project,
      date: day.toISOString().slice(0, 10),
      summary: {
        hoursTotal,
        peopleOnSite,
        snagsRaised: snagsRaised.length,
        snagsClosed: snagsClosed.length,
        photosTaken: photos.length,
        documentsFiled: otherDocs.length,
        activityEvents: activities.length,
      },
      timeEntries,
      activities: activities.map(presentActivity),
      snagsRaised,
      snagsClosed,
      photos,
      documents: otherDocs,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch site diary' }, { status: 500 })
  }
}

function sanitize(s: string, maxLen = 500): string {
  return String(s).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen)
}

function presentActivity<T extends { action: string; detail: string | null }>(activity: T): T {
  if (!activity.action.startsWith('field event:') || !activity.detail) return activity
  try {
    const parsed = JSON.parse(activity.detail) as { type?: string; title?: string; detail?: string; location?: string; severity?: string }
    const type = sanitize(parsed.type || 'field event', 40).replaceAll('_', ' ')
    const title = sanitize(parsed.title || activity.action, 220)
    const detail = [
      parsed.detail ? sanitize(parsed.detail, 1000) : '',
      parsed.location ? `Location: ${sanitize(parsed.location, 160)}` : '',
      parsed.severity && parsed.severity !== 'info' ? `Priority: ${sanitize(parsed.severity, 40)}` : '',
    ].filter(Boolean).join(' · ')
    return { ...activity, action: `${type}: ${title}`, detail: detail || null }
  } catch {
    return activity
  }
}

/**
 * Create a site diary note. The diary itself is an aggregation over other
 * records, so a new entry is stored as an activity record and immediately
 * appears in today's diary feed.
 */
async function POST_impl(req: NextRequest, userId: string, session: { user?: { name?: string | null; email?: string | null } }) {
  const __limited = await enforceRateLimit(req, 'write', userId)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const note = String(body.note || '').trim()
    if (!note) return NextResponse.json({ error: 'note is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const activity = await createActivity({
      projectId,
      actorName: sanitize(actorName(session), 100),
      actorType: 'human',
      action: `site diary note: ${sanitize(note, 200)}`,
      detail: sanitize(note),
      iconType: 'doc',
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create site diary entry' }, { status: 500 })
  }
}

export const GET = withRoute(({ req }) => GET_impl(req), { permission: 'read' })
export const POST = withRoute(({ req, userId, session }) => POST_impl(req, userId, session), { permission: 'write' })

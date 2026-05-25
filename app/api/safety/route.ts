import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

const INCIDENT_TYPES = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security'] as const
const SEVERITIES = ['near_miss', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'investigating', 'closed'] as const

const MAX_TAKE = 100

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const status = sp.get('status')
    const projectId = sp.get('projectId')
    const where: { status?: string; projectId?: string | null } = {}
    if (status && (STATUSES as readonly string[]).includes(status)) where.status = status
    if (projectId) where.projectId = projectId

    const [incidents, total, openCount, ridorCount, mostRecent] = await Promise.all([
      prisma.safetyIncident.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: { occurredAt: 'desc' },
        take,
        skip,
      }),
      prisma.safetyIncident.count({ where }),
      prisma.safetyIncident.count({ where: { status: { not: 'closed' } } }),
      prisma.safetyIncident.count({ where: { riddorReportable: true, status: { not: 'closed' } } }),
      prisma.safetyIncident.findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
    ])

    // Days-without-incident — counted from the most recent occurredAt of any
    // incident, regardless of status. A closed incident still happened.
    let daysWithoutIncident = 0
    if (mostRecent?.occurredAt) {
      const ms = Date.now() - new Date(mostRecent.occurredAt).getTime()
      daysWithoutIncident = Math.max(0, Math.floor(ms / 86400000))
    }

    return NextResponse.json({
      incidents,
      total,
      hasMore: skip + incidents.length < total,
      openCount,
      ridorCount,
      daysWithoutIncident,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch safety incidents' }, { status: 500 })
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
    if (title.length > 200) return NextResponse.json({ error: 'Title too long (max 200)' }, { status: 400 })

    const type = (INCIDENT_TYPES as readonly string[]).includes(body.type) ? body.type : 'near_miss'
    const severity = (SEVERITIES as readonly string[]).includes(body.severity) ? body.severity : 'low'

    // RIDDOR reportable auto-flag for the obviously-reportable types so the
    // user doesn't forget. They can override before save.
    const autoRiddor = type === 'accident' || type === 'dangerous_occurrence' || severity === 'critical'
    const riddorReportable = typeof body.riddorReportable === 'boolean' ? body.riddorReportable : autoRiddor

    let occurredAt = new Date()
    if (body.occurredAt) {
      const parsed = new Date(body.occurredAt)
      if (!Number.isNaN(parsed.getTime())) occurredAt = parsed
    }

    const incident = await prisma.safetyIncident.create({
      data: {
        projectId: body.projectId || null,
        title,
        description: body.description?.trim() || null,
        type,
        severity,
        status: 'open',
        location: body.location?.trim() || null,
        reportedBy: body.reportedBy?.trim() || actorName(auth),
        injuredParty: body.injuredParty?.trim() || null,
        photoUrl: body.photoUrl?.trim() || null,
        riddorReportable,
        occurredAt,
        notes: body.notes?.trim() || null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId: incident.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `logged a safety incident: ${incident.title}`,
        detail: `${severity} · ${type.replace('_', ' ')}${riddorReportable ? ' · RIDDOR' : ''}`,
        iconType: 'alert',
      },
    }).catch(() => {})

    // Site-wide push for serious incidents — best effort, never blocks the
    // response. Lower-severity near-misses are captured by the activity feed.
    if (severity === 'critical' || severity === 'high' || riddorReportable) {
      sendPush({
        category: 'safety',
        payload: {
          title: `⚠️ ${riddorReportable ? 'RIDDOR · ' : ''}Safety incident`,
          body: `${incident.title} (${severity})`,
          url: '/safety',
          tag: `safety-${incident.id}`,
        },
      }).catch(() => {})
    }

    return NextResponse.json(incident, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create safety incident' }, { status: 500 })
  }
}

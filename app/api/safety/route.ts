import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { sendPush } from '@/lib/push'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import safetyWorkflow from '@/lib/safety-workflow'

export const dynamic = 'force-dynamic'

const { riddorReviewRequired, initialRiddorStatus } = safetyWorkflow
const INCIDENT_TYPES = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security'] as const
const SEVERITIES = ['near_miss', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'investigating', 'closed'] as const
const MAX_TAKE = 100

function jsonArray(value: unknown, max = 30): Prisma.InputJsonValue {
  return (Array.isArray(value) ? value.slice(0, max) : []) as Prisma.InputJsonValue
}

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

    const [incidents, total, openCount, riddorCount, mostRecent] = await Promise.all([
      prisma.safetyIncident.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          correctiveActions: { select: { id: true, status: true, dueDate: true } },
        },
        orderBy: { occurredAt: 'desc' },
        take,
        skip,
      }),
      prisma.safetyIncident.count({ where }),
      prisma.safetyIncident.count({ where: { status: { not: 'closed' } } }),
      prisma.safetyIncident.count({ where: { riddorStatus: { in: ['reportable', 'submitted'] }, status: { not: 'closed' } } }),
      prisma.safetyIncident.findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
    ])

    let daysWithoutIncident = 0
    if (mostRecent?.occurredAt) {
      const ms = Date.now() - new Date(mostRecent.occurredAt).getTime()
      daysWithoutIncident = Math.max(0, Math.floor(ms / 86400000))
    }

    return NextResponse.json({ incidents, total, hasMore: skip + incidents.length < total, openCount, riddorCount, daysWithoutIncident })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch safety incidents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    if (title.length > 200) return NextResponse.json({ error: 'Title too long (max 200)' }, { status: 400 })

    const type = (INCIDENT_TYPES as readonly string[]).includes(body.type) ? body.type : 'near_miss'
    const severity = (SEVERITIES as readonly string[]).includes(body.severity) ? body.severity : 'low'
    const riddorStatus = initialRiddorStatus(type, severity, body.riddorReportable === true)
    const riddorReportable = riddorStatus === 'reportable' || riddorStatus === 'submitted'
    const needsRiddorReview = riddorReviewRequired(type, severity)

    let occurredAt = new Date()
    if (body.occurredAt) {
      const parsed = new Date(body.occurredAt)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid occurredAt date' }, { status: 400 })
      occurredAt = parsed
    }

    const incident = await prisma.safetyIncident.create({
      data: {
        projectId: body.projectId || null,
        title,
        description: String(body.description || '').trim().slice(0, 5000) || null,
        type,
        severity,
        status: 'open',
        location: String(body.location || '').trim().slice(0, 300) || null,
        reportedBy: String(body.reportedBy || actorName(auth)).trim().slice(0, 160) || actorName(auth),
        injuredParty: String(body.injuredParty || '').trim().slice(0, 160) || null,
        photoUrl: typeof body.photoUrl === 'string' && body.photoUrl.trim() ? body.photoUrl.trim().slice(0, 1000) : null,
        riddorReportable,
        riddorStatus,
        occurredAt,
        notes: String(body.notes || '').trim().slice(0, 5000) || null,
        immediateActions: String(body.immediateActions || '').trim().slice(0, 5000) || null,
        investigatorName: String(body.investigatorName || '').trim().slice(0, 160) || null,
        witnesses: jsonArray(body.witnesses),
        evidence: jsonArray(body.evidence),
      },
      include: { project: { select: { id: true, name: true } }, correctiveActions: true },
    })

    prisma.activity.create({
      data: {
        projectId: incident.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `logged a safety incident: ${incident.title}`,
        detail: `${severity} · ${type.replace('_', ' ')}${needsRiddorReview || riddorReportable ? ' · RIDDOR assessment required' : ''}`,
        iconType: 'alert',
      },
    }).catch(() => {})
    auditLog({ action: 'safetyIncident.create', resourceType: 'SafetyIncident', resourceId: incident.id, metadata: { severity, type, riddorStatus }, ...requestMeta(req) })

    if (severity === 'critical' || severity === 'high' || needsRiddorReview || riddorReportable) {
      sendPush({
        category: 'safety',
        payload: {
          title: `⚠️ ${riddorReportable ? 'RIDDOR review · ' : ''}Safety incident`,
          body: `${incident.title} (${severity})`,
          url: '/safety',
          tag: `safety-${incident.id}`,
        },
      }).catch(() => {})
    }

    return NextResponse.json(incident, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create safety incident' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canWrite } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'
import safetyWorkflow from '@/lib/safety-workflow'

export const dynamic = 'force-dynamic'

const { RIDDOR_STATUSES, closeoutReadiness, riddorReviewRequired } = safetyWorkflow
const INCIDENT_TYPES = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security'] as const
const SEVERITIES = ['near_miss', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'investigating', 'closed'] as const

function clean(value: unknown, max = 5000): string | null {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, max) : null
}

function jsonArray(value: unknown, max = 30): Prisma.InputJsonValue {
  return (Array.isArray(value) ? value.slice(0, max) : []) as Prisma.InputJsonValue
}

function guardWrite() {
  const role = getCurrentOrg()?.role
  return role && !canWrite(role)
    ? NextResponse.json({ error: 'Write permission required' }, { status: 403 })
    : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const incident = await prisma.safetyIncident.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        correctiveActions: { orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    return NextResponse.json({
      ...incident,
      riddorReviewRequired: riddorReviewRequired(incident.type, incident.severity),
      closeout: closeoutReadiness(incident as unknown as Record<string, unknown>, incident.correctiveActions as unknown as Array<Record<string, unknown>>),
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch incident' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const forbidden = guardWrite()
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited

  try {
    const { id } = await params
    const existing = await prisma.safetyIncident.findUnique({
      where: { id },
      include: { correctiveActions: true },
    })
    if (!existing) return NextResponse.json({ error: 'Incident not found' }, { status: 404 })

    const body = await req.json()
    const data: Prisma.SafetyIncidentUncheckedUpdateInput = {}

    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      if (title.length > 200) return NextResponse.json({ error: 'Title too long (max 200)' }, { status: 400 })
      data.title = title
    }
    if (body.description !== undefined) data.description = clean(body.description)
    if (body.type !== undefined) {
      if (!(INCIDENT_TYPES as readonly string[]).includes(String(body.type))) return NextResponse.json({ error: 'Invalid incident type' }, { status: 400 })
      data.type = String(body.type)
    }
    if (body.severity !== undefined) {
      if (!(SEVERITIES as readonly string[]).includes(String(body.severity))) return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
      data.severity = String(body.severity)
    }
    if (body.location !== undefined) data.location = clean(body.location, 300)
    if (body.reportedBy !== undefined) data.reportedBy = clean(body.reportedBy, 160)
    if (body.injuredParty !== undefined) data.injuredParty = clean(body.injuredParty, 160)
    if (body.photoUrl !== undefined) data.photoUrl = clean(body.photoUrl, 1000)
    if (body.notes !== undefined) data.notes = clean(body.notes)
    if (body.projectId !== undefined) data.projectId = clean(body.projectId, 200)
    if (body.investigatorName !== undefined) data.investigatorName = clean(body.investigatorName, 160)
    if (body.immediateActions !== undefined) data.immediateActions = clean(body.immediateActions)
    if (body.investigationSummary !== undefined) data.investigationSummary = clean(body.investigationSummary)
    if (body.rootCause !== undefined) data.rootCause = clean(body.rootCause)
    if (body.lessonsLearned !== undefined) data.lessonsLearned = clean(body.lessonsLearned)
    if (body.witnesses !== undefined) data.witnesses = jsonArray(body.witnesses)
    if (body.evidence !== undefined) data.evidence = jsonArray(body.evidence)

    const investigationTouched = [
      'investigatorName', 'immediateActions', 'investigationSummary', 'rootCause', 'lessonsLearned', 'witnesses', 'evidence',
    ].some(key => body[key] !== undefined)
    if (investigationTouched && existing.status === 'open') {
      data.status = 'investigating'
      data.investigationStartedAt = existing.investigationStartedAt || new Date()
    }

    if (body.riddorStatus !== undefined) {
      const nextRiddor = String(body.riddorStatus)
      if (!RIDDOR_STATUSES.has(nextRiddor)) return NextResponse.json({ error: 'Invalid RIDDOR status' }, { status: 400 })
      if (existing.riddorStatus === 'submitted' && nextRiddor !== 'submitted') {
        return NextResponse.json({ error: 'Submitted RIDDOR records cannot be downgraded; record a note/correction instead' }, { status: 409 })
      }
      const reason = body.riddorDecisionReason !== undefined ? clean(body.riddorDecisionReason, 2000) : existing.riddorDecisionReason
      if (nextRiddor !== 'not_assessed' && !reason) {
        return NextResponse.json({ error: 'Record the reason for the RIDDOR decision' }, { status: 400 })
      }
      data.riddorStatus = nextRiddor
      data.riddorDecisionReason = reason
      data.riddorReportable = nextRiddor === 'reportable' || nextRiddor === 'submitted'
      if (nextRiddor === 'submitted') {
        const reference = body.riddorReference !== undefined ? clean(body.riddorReference, 160) : existing.riddorReference
        if (!reference) return NextResponse.json({ error: 'RIDDOR submission reference is required' }, { status: 400 })
        data.riddorReference = reference
        data.riddorSubmittedAt = existing.riddorSubmittedAt || new Date()
      } else if (existing.riddorStatus !== 'submitted') {
        data.riddorReference = null
        data.riddorSubmittedAt = null
      }
    } else {
      if (body.riddorDecisionReason !== undefined) data.riddorDecisionReason = clean(body.riddorDecisionReason, 2000)
      if (body.riddorReference !== undefined && existing.riddorStatus === 'submitted') data.riddorReference = clean(body.riddorReference, 160)
    }

    const requestedStatus = body.status === undefined ? undefined : String(body.status)
    if (requestedStatus !== undefined && !(STATUSES as readonly string[]).includes(requestedStatus)) {
      return NextResponse.json({ error: 'Invalid incident status' }, { status: 400 })
    }
    if (requestedStatus === 'investigating' && existing.status !== 'investigating') {
      data.status = 'investigating'
      data.investigationStartedAt = existing.investigationStartedAt || new Date()
      data.closedAt = null
      data.closeoutVerifiedBy = null
      data.closeoutVerifiedAt = null
    }
    if (requestedStatus === 'open') {
      data.status = 'open'
      data.closedAt = null
      data.closeoutVerifiedBy = null
      data.closeoutVerifiedAt = null
      data.investigationCompletedAt = null
    }
    if (requestedStatus === 'closed' && existing.status !== 'closed') {
      const candidate = { ...existing, ...data }
      const readiness = closeoutReadiness(candidate as unknown as Record<string, unknown>, existing.correctiveActions as unknown as Array<Record<string, unknown>>)
      if (!readiness.ready) {
        return NextResponse.json({ error: 'Incident is not ready for closeout', missing: readiness.missing }, { status: 409 })
      }
      const now = new Date()
      data.status = 'closed'
      data.closedAt = now
      data.investigationStartedAt = existing.investigationStartedAt || now
      data.investigationCompletedAt = now
      data.closeoutVerifiedBy = actorName(auth)
      data.closeoutVerifiedAt = now
    }

    const incident = await prisma.safetyIncident.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        correctiveActions: { orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    const closeout = closeoutReadiness(incident as unknown as Record<string, unknown>, incident.correctiveActions as unknown as Array<Record<string, unknown>>)

    if (requestedStatus && requestedStatus !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: incident.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `${requestedStatus === 'closed' ? 'closed' : requestedStatus === 'investigating' ? 'started investigation for' : 'reopened'} safety incident: ${incident.title}`,
          iconType: requestedStatus === 'closed' ? 'check' : 'alert',
        },
      }).catch(() => {})
    }
    if (body.riddorStatus === 'submitted' && existing.riddorStatus !== 'submitted') {
      prisma.activity.create({
        data: {
          projectId: incident.projectId,
          actorName: actorName(auth), actorType: 'human',
          action: `recorded RIDDOR submission: ${incident.title}`,
          detail: incident.riddorReference || undefined, iconType: 'alert',
        },
      }).catch(() => {})
    }
    auditLog({
      action: 'safetyIncident.update',
      resourceType: 'SafetyIncident',
      resourceId: id,
      metadata: { status: incident.status, riddorStatus: incident.riddorStatus, closeoutReady: closeout.ready },
      ...requestMeta(req),
    })

    return NextResponse.json({ ...incident, riddorReviewRequired: riddorReviewRequired(incident.type, incident.severity), closeout })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const forbidden = guardWrite()
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const { id } = await params
    const existing = await prisma.safetyIncident.findUnique({
      where: { id },
      include: { correctiveActions: { select: { id: true, status: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    if (existing.status === 'closed' || existing.riddorStatus === 'submitted' || existing.correctiveActions.some(a => a.status === 'complete')) {
      return NextResponse.json({ error: 'This incident contains auditable closeout/RIDDOR records and cannot be deleted' }, { status: 409 })
    }
    await prisma.safetyIncident.delete({ where: { id } })
    auditLog({ action: 'safetyIncident.delete', resourceType: 'SafetyIncident', resourceId: id, ...requestMeta(req) })
    prisma.activity.create({
      data: { projectId: existing.projectId, actorName: actorName(auth), actorType: 'human', action: `deleted safety incident: ${existing.title}`, iconType: 'trash' },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete incident' }, { status: 500 })
  }
}

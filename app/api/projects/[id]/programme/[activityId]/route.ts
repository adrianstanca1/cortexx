import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { getCurrentOrg } from '@/lib/tenancy'
import { canPlanProgramme, canUpdateProgrammeProgress, programmeProjectWhere } from '@/lib/programme-access'
import { syncProjectProgrammeProgress } from '@/lib/programme-server'
import { lockProgrammeProject } from '@/lib/programme-change-control-server'

export const dynamic = 'force-dynamic'
const STATUSES = new Set(['not_started', 'in_progress', 'complete', 'blocked'])
const FOREMAN_FIELDS = new Set(['progress', 'status', 'actualStart', 'actualEnd', 'notes'])

function parsedDate(value: unknown) {
  if (value === null || value === '') return null
  if (value === undefined) return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? 'invalid' : date
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id, activityId } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canUpdateProgrammeProgress(auth)) return NextResponse.json({ error: 'Programme update permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const existing = await prisma.programmeActivity.findFirst({ where: { id: activityId, projectId: id } })
    if (!existing) return NextResponse.json({ error: 'Programme activity not found' }, { status: 404 })
    const body = await req.json()
    const planner = canPlanProgramme(auth)
    if (!planner) {
      const forbidden = Object.keys(body).some(key => !FOREMAN_FIELDS.has(key))
      if (forbidden) return NextResponse.json({ error: 'Foreman can update field progress only; programme dates and dependencies require Project Manager or Company Admin' }, { status: 403 })
    }

    const data: Record<string, unknown> = {}
    if (planner && body.title !== undefined) {
      const title = String(body.title || '').trim().slice(0, 220)
      if (!title) return NextResponse.json({ error: 'Activity title cannot be empty' }, { status: 400 })
      data.title = title
    }
    if (planner && body.code !== undefined) data.code = String(body.code || '').trim().slice(0, 40) || null
    if (planner && body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 2000) || null
    if (planner && body.location !== undefined) data.location = String(body.location || '').trim().slice(0, 160) || null
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim().slice(0, 2000) || null
    if (planner && body.sortOrder !== undefined) data.sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : existing.sortOrder

    const plannedStart = planner ? parsedDate(body.plannedStart) : undefined
    const plannedEnd = planner ? parsedDate(body.plannedEnd) : undefined
    const baselineStart = planner ? parsedDate(body.baselineStart) : undefined
    const baselineEnd = planner ? parsedDate(body.baselineEnd) : undefined
    const actualStart = parsedDate(body.actualStart)
    const actualEnd = parsedDate(body.actualEnd)
    for (const value of [plannedStart, plannedEnd, baselineStart, baselineEnd, actualStart, actualEnd]) {
      if (value === 'invalid') return NextResponse.json({ error: 'One or more dates are invalid' }, { status: 400 })
    }
    if (plannedStart !== undefined) data.plannedStart = plannedStart
    if (plannedEnd !== undefined) data.plannedEnd = plannedEnd
    if (baselineStart !== undefined) data.baselineStart = baselineStart
    if (baselineEnd !== undefined) data.baselineEnd = baselineEnd
    if (actualStart !== undefined) data.actualStart = actualStart
    if (actualEnd !== undefined) data.actualEnd = actualEnd

    if (planner && body.responsibleMemberId !== undefined) {
      const responsibleMemberId = body.responsibleMemberId ? String(body.responsibleMemberId) : null
      if (responsibleMemberId) {
        const member = await prisma.teamMember.findFirst({ where: { id: responsibleMemberId, assignments: { some: { projectId: id } } }, select: { id: true } })
        if (!member) return NextResponse.json({ error: 'Responsible person must be assigned to this project' }, { status: 400 })
      }
      data.responsibleMemberId = responsibleMemberId
    }

    let progress = existing.progress
    if (body.progress !== undefined) {
      const n = Number(body.progress)
      if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 })
      progress = Math.round(n)
      data.progress = progress
    }
    let status = existing.status
    if (body.status !== undefined) {
      if (!STATUSES.has(String(body.status))) return NextResponse.json({ error: 'Invalid programme status' }, { status: 400 })
      status = String(body.status)
      data.status = status
    } else if (body.progress !== undefined) {
      status = progress >= 100 ? 'complete' : progress > 0 ? 'in_progress' : 'not_started'
      data.status = status
    }
    if ((status === 'in_progress' || status === 'complete' || progress > 0) && !existing.actualStart && data.actualStart === undefined) data.actualStart = new Date()
    if (status === 'complete' || progress >= 100) {
      data.progress = 100
      data.status = 'complete'
      if (!existing.actualEnd && data.actualEnd === undefined) data.actualEnd = new Date()
    } else if (status !== 'complete' && body.status !== undefined && data.actualEnd === undefined) data.actualEnd = null

    const orgId = getCurrentOrg()?.organizationId
    if (!orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
    const updated = await prisma.$transaction(async tx => {
      await lockProgrammeProject(tx, id)
      const lockedExisting = await tx.programmeActivity.findFirst({ where: { id: activityId, projectId: id } })
      if (!lockedExisting) throw new Error('PROGRAMME_ACTIVITY_CHANGED')
      if (planner && (body.baselineStart !== undefined || body.baselineEnd !== undefined)) {
        const baselineLocked = await tx.programmeBaselineRevision.count({ where: { projectId: id } }).then(count => count > 0)
        if (baselineLocked) throw new Error('BASELINE_LOCKED')
      }
      const lockedPlannedStart = plannedStart instanceof Date ? plannedStart : lockedExisting.plannedStart
      const lockedPlannedEnd = plannedEnd instanceof Date ? plannedEnd : lockedExisting.plannedEnd
      const lockedBaselineStart = baselineStart instanceof Date ? baselineStart : lockedExisting.baselineStart
      const lockedBaselineEnd = baselineEnd instanceof Date ? baselineEnd : lockedExisting.baselineEnd
      if (lockedPlannedEnd < lockedPlannedStart) throw new Error('PLANNED_RANGE_INVALID')
      if (lockedBaselineEnd < lockedBaselineStart) throw new Error('BASELINE_RANGE_INVALID')
      const result = await tx.programmeActivity.update({ where: { id: activityId }, data })
      await syncProjectProgrammeProgress(tx, id, orgId)
      return result
    })
    auditLog({ action: 'programme.activity.update', resourceType: 'ProgrammeActivity', resourceId: activityId, metadata: { projectId: id, progress: updated.progress, status: updated.status }, ...requestMeta(req) })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === 'BASELINE_LOCKED') return NextResponse.json({ error: 'Baseline dates are revision-controlled. Update planned dates, then create a new programme baseline revision.' }, { status: 409 })
    if (error instanceof Error && error.message === 'PLANNED_RANGE_INVALID') return NextResponse.json({ error: 'Planned end must be on or after planned start' }, { status: 400 })
    if (error instanceof Error && error.message === 'BASELINE_RANGE_INVALID') return NextResponse.json({ error: 'Baseline end must be on or after baseline start' }, { status: 400 })
    if (error instanceof Error && error.message === 'PROGRAMME_ACTIVITY_CHANGED') return NextResponse.json({ error: 'Programme activity changed concurrently; reload and retry' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update programme activity' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id, activityId } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const existing = await prisma.programmeActivity.findFirst({ where: { id: activityId, projectId: id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Programme activity not found' }, { status: 404 })
    const orgId = getCurrentOrg()?.organizationId
    if (!orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
    await prisma.$transaction(async tx => {
      await lockProgrammeProject(tx, id)
      const deleted = await tx.programmeActivity.deleteMany({ where: { id: activityId, projectId: id } })
      if (deleted.count === 0) throw new Error('PROGRAMME_ACTIVITY_CHANGED')
      await syncProjectProgrammeProgress(tx, id, orgId)
    })
    auditLog({ action: 'programme.activity.delete', resourceType: 'ProgrammeActivity', resourceId: activityId, metadata: { projectId: id }, ...requestMeta(req) })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROGRAMME_ACTIVITY_CHANGED') return NextResponse.json({ error: 'Programme activity changed concurrently; reload and retry' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete programme activity' }, { status: 500 })
  }
}

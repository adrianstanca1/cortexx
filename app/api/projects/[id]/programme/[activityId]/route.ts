import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { getCurrentOrg } from '@/lib/tenancy'
import { canPlanProgramme, canUpdateProgrammeProgress, programmeProjectWhere } from '@/lib/programme-access'
import { syncProjectProgrammeProgress } from '@/lib/programme-server'

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
    const nextPlannedStart = plannedStart instanceof Date ? plannedStart : existing.plannedStart
    const nextPlannedEnd = plannedEnd instanceof Date ? plannedEnd : existing.plannedEnd
    const nextBaselineStart = baselineStart instanceof Date ? baselineStart : existing.baselineStart
    const nextBaselineEnd = baselineEnd instanceof Date ? baselineEnd : existing.baselineEnd
    if (nextPlannedEnd < nextPlannedStart) return NextResponse.json({ error: 'Planned end must be on or after planned start' }, { status: 400 })
    if (nextBaselineEnd < nextBaselineStart) return NextResponse.json({ error: 'Baseline end must be on or after baseline start' }, { status: 400 })
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
      const result = await tx.programmeActivity.update({ where: { id: activityId }, data })
      await syncProjectProgrammeProgress(tx, id, orgId)
      return result
    })
    auditLog({ action: 'programme.activity.update', resourceType: 'ProgrammeActivity', resourceId: activityId, metadata: { projectId: id, progress: updated.progress, status: updated.status }, ...requestMeta(req) })
    return NextResponse.json(updated)
  } catch (error) {
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
      await tx.programmeActivity.delete({ where: { id: activityId } })
      await syncProjectProgrammeProgress(tx, id, orgId)
    })
    auditLog({ action: 'programme.activity.delete', resourceType: 'ProgrammeActivity', resourceId: activityId, metadata: { projectId: id }, ...requestMeta(req) })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete programme activity' }, { status: 500 })
  }
}

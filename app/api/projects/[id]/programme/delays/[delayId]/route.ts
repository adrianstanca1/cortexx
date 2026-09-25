import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'
import changeControl from '@/lib/programme-change-control'

export const dynamic = 'force-dynamic'
const { canTransitionDelayStatus, normalizeDelayDays } = changeControl
const CATEGORIES = new Set(['weather', 'client', 'design', 'supply', 'labour', 'access', 'other'])
const STATUSES = new Set(['open', 'accepted', 'rejected', 'closed'])

function parsedDate(value: unknown) {
  if (value === null || value === '') return null
  if (value === undefined) return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? 'invalid' : date
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; delayId: string }> }) {
  const { id, delayId } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const userId = (auth.user as { id?: string }).id || ''
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const existing = await prisma.programmeDelayEvent.findFirst({ where: { id: delayId, projectId: id } })
    if (!existing) return NextResponse.json({ error: 'Delay event not found' }, { status: 404 })
    const body = await req.json()
    const targetStatus = body.status === undefined ? existing.status : String(body.status)
    if (!STATUSES.has(targetStatus)) return NextResponse.json({ error: 'Invalid delay status' }, { status: 400 })
    if (!canTransitionDelayStatus(existing.status, targetStatus)) return NextResponse.json({ error: `Cannot move delay from ${existing.status} to ${targetStatus}` }, { status: 409 })
    if (existing.status !== 'open') {
      const allowed = new Set(['status', 'decisionNotes'])
      if (Object.keys(body).some(key => !allowed.has(key))) return NextResponse.json({ error: 'Decided delay evidence is locked; only lifecycle status and decision notes can change' }, { status: 409 })
    }
    const data: Record<string, unknown> = {}
    if (existing.status === 'open') {
      if (body.title !== undefined) {
        const title = String(body.title || '').trim().slice(0, 220)
        if (!title) return NextResponse.json({ error: 'Delay title cannot be empty' }, { status: 400 })
        data.title = title
      }
      if (body.category !== undefined) {
        if (!CATEGORIES.has(String(body.category))) return NextResponse.json({ error: 'Invalid delay category' }, { status: 400 })
        data.category = String(body.category)
      }
      if (body.cause !== undefined) data.cause = String(body.cause || '').trim().slice(0, 2000) || null
      if (body.impact !== undefined) data.impact = String(body.impact || '').trim().slice(0, 2000) || null
      const startDate = parsedDate(body.startDate)
      const endDate = parsedDate(body.endDate)
      if (startDate === 'invalid' || endDate === 'invalid') return NextResponse.json({ error: 'One or more delay dates are invalid' }, { status: 400 })
      const nextStart = startDate instanceof Date ? startDate : existing.startDate
      const nextEnd = endDate === null ? null : endDate instanceof Date ? endDate : existing.endDate
      if (nextEnd && nextEnd < nextStart) return NextResponse.json({ error: 'Delay end must be on or after start' }, { status: 400 })
      if (startDate !== undefined) data.startDate = startDate
      if (endDate !== undefined) data.endDate = endDate
      if (body.delayDays !== undefined) {
        const delayDays = normalizeDelayDays(body.delayDays)
        if (delayDays === null) return NextResponse.json({ error: 'Delay days must be between 0 and 3650' }, { status: 400 })
        data.delayDays = delayDays
      }
      if (body.activityId !== undefined) {
        const activityId = body.activityId ? String(body.activityId) : null
        if (activityId) {
          const activity = await prisma.programmeActivity.findFirst({ where: { id: activityId, projectId: id }, select: { id: true } })
          if (!activity) return NextResponse.json({ error: 'Programme activity not found' }, { status: 400 })
        }
        data.activityId = activityId
      }
    }
    if (body.decisionNotes !== undefined) data.decisionNotes = String(body.decisionNotes || '').trim().slice(0, 2000) || null
    if (targetStatus !== existing.status) {
      data.status = targetStatus
      if (targetStatus === 'accepted' || targetStatus === 'rejected') {
        data.decidedAt = new Date()
        data.decidedByUserId = userId || null
      }
      if (targetStatus === 'closed') data.closedAt = new Date()
    }
    const updated = await prisma.programmeDelayEvent.update({ where: { id: delayId }, data })
    auditLog({ action: 'programme.delay.update', resourceType: 'ProgrammeDelayEvent', resourceId: delayId, metadata: { projectId: id, fromStatus: existing.status, toStatus: updated.status }, ...requestMeta(req) })
    return NextResponse.json(updated)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update delay event' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; delayId: string }> }) {
  const { id, delayId } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const existing = await prisma.programmeDelayEvent.findFirst({ where: { id: delayId, projectId: id } })
    if (!existing) return NextResponse.json({ error: 'Delay event not found' }, { status: 404 })
    if (existing.status !== 'open') return NextResponse.json({ error: 'Decided delay events are retained for audit and cannot be deleted' }, { status: 409 })
    await prisma.programmeDelayEvent.delete({ where: { id: delayId } })
    auditLog({ action: 'programme.delay.delete', resourceType: 'ProgrammeDelayEvent', resourceId: delayId, metadata: { projectId: id }, ...requestMeta(req) })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete delay event' }, { status: 500 })
  }
}

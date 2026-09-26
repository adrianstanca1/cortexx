import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'

export const dynamic = 'force-dynamic'

function positiveNumber(value: unknown, max = 100000) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= max ? n : null
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; resourceId: string }> }) {
  const { id, resourceId } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const session = auth.session
  if (!canPlanProgramme(session)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const existing = await prisma.programmeResourceAllocation.findFirst({ where: { id: resourceId, projectId: id, organizationId: auth.orgId } })
    if (!existing) return NextResponse.json({ error: 'Resource allocation not found' }, { status: 404 })
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.quantity !== undefined) {
      const quantity = positiveNumber(body.quantity)
      if (quantity === null) return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 })
      if ((existing.teamMemberId || existing.equipmentId) && quantity !== 1) return NextResponse.json({ error: 'Named people and equipment must have quantity 1' }, { status: 400 })
      data.quantity = quantity
    }
    if (body.hoursPerDay !== undefined) {
      if (existing.resourceType === 'material') return NextResponse.json({ error: 'Materials do not use hours per day' }, { status: 400 })
      if (body.hoursPerDay === '' && existing.resourceType === 'equipment') data.hoursPerDay = 0
      else {
        const hours = positiveNumber(body.hoursPerDay, 24)
        if (hours === null) return NextResponse.json({ error: 'Hours per day must be between 0 and 24' }, { status: 400 })
        data.hoursPerDay = hours
      }
    }
    if (body.needBy !== undefined) {
      if (existing.resourceType !== 'material') return NextResponse.json({ error: 'Need-by date is only valid for materials' }, { status: 400 })
      const needBy = body.needBy ? new Date(String(body.needBy)) : null
      if (needBy && Number.isNaN(needBy.getTime())) return NextResponse.json({ error: 'Need-by date is invalid' }, { status: 400 })
      data.needBy = needBy
    }
    if (body.label !== undefined && !existing.teamMemberId && !existing.equipmentId && !existing.materialId) {
      const label = String(body.label || '').trim().slice(0, 160)
      if (!label) return NextResponse.json({ error: 'Generic resource label cannot be empty' }, { status: 400 })
      data.label = label
    }
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim().slice(0, 1000) || null
    const updated = await prisma.programmeResourceAllocation.update({ where: { id: resourceId, organizationId: auth.orgId }, data, include: { teamMember: true, equipment: true, material: true, activity: { select: { id: true, title: true, plannedStart: true, plannedEnd: true } } } })
    auditLog({ action: 'programme.resource.update', resourceType: 'ProgrammeResourceAllocation', resourceId, metadata: { projectId: id, activityId: existing.activityId, fields: Object.keys(data) }, ...requestMeta(req) })
    return NextResponse.json(updated)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update programme resource' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string; resourceId: string }> }) {
  const { id, resourceId } = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const session = auth.session
  if (!canPlanProgramme(session)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const deleted = await prisma.programmeResourceAllocation.deleteMany({ where: { id: resourceId, projectId: id, organizationId: auth.orgId } })
    if (!deleted.count) return NextResponse.json({ error: 'Resource allocation not found' }, { status: 404 })
    auditLog({ action: 'programme.resource.delete', resourceType: 'ProgrammeResourceAllocation', resourceId, metadata: { projectId: id }, ...requestMeta(req) })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete programme resource' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canWrite } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'
const STATUSES = new Set(['open', 'in_progress', 'complete'])

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canWrite(role)) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const { id, actionId } = await params
    const existing = await prisma.safetyCorrectiveAction.findFirst({ where: { id: actionId, incidentId: id }, include: { incident: { select: { projectId: true, title: true, status: true } } } })
    if (!existing) return NextResponse.json({ error: 'Corrective action not found' }, { status: 404 })
    if (existing.incident.status === 'closed') return NextResponse.json({ error: 'Reopen the incident before changing corrective actions' }, { status: 409 })
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      data.title = title.slice(0, 200)
    }
    if (body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 2000) || null
    if (body.ownerName !== undefined) data.ownerName = String(body.ownerName || '').trim().slice(0, 160) || null
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim().slice(0, 2000) || null
    if (body.evidenceUrl !== undefined) data.evidenceUrl = String(body.evidenceUrl || '').trim().slice(0, 1000) || null
    if (body.dueDate !== undefined) {
      if (!body.dueDate) data.dueDate = null
      else {
        const due = new Date(body.dueDate)
        if (Number.isNaN(due.getTime())) return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
        data.dueDate = due
      }
    }
    if (body.status !== undefined) {
      const status = String(body.status)
      if (!STATUSES.has(status)) return NextResponse.json({ error: 'Invalid action status' }, { status: 400 })
      data.status = status
      if (status === 'complete' && existing.status !== 'complete') data.completedAt = new Date()
      if (status !== 'complete' && existing.status === 'complete') data.completedAt = null
    }
    const action = await prisma.safetyCorrectiveAction.update({ where: { id: actionId }, data })
    if (body.status === 'complete' && existing.status !== 'complete') {
      prisma.activity.create({ data: {
        projectId: existing.incident.projectId,
        actorName: actorName(auth), actorType: 'human', action: `completed corrective action: ${action.title}`,
        detail: `Safety incident · ${existing.incident.title}`, iconType: 'check',
      } }).catch(() => {})
    }
    auditLog({ action: 'safety.correctiveAction.update', resourceType: 'SafetyCorrectiveAction', resourceId: actionId, metadata: { incidentId: id, status: action.status }, ...requestMeta(req) })
    return NextResponse.json(action)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update corrective action' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canWrite(role)) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const { id, actionId } = await params
    const existing = await prisma.safetyCorrectiveAction.findFirst({ where: { id: actionId, incidentId: id }, select: { status: true } })
    if (!existing) return NextResponse.json({ error: 'Corrective action not found' }, { status: 404 })
    if (existing.status === 'complete') return NextResponse.json({ error: 'Completed corrective actions are retained for audit' }, { status: 409 })
    await prisma.safetyCorrectiveAction.delete({ where: { id: actionId } })
    auditLog({ action: 'safety.correctiveAction.delete', resourceType: 'SafetyCorrectiveAction', resourceId: actionId, metadata: { incidentId: id }, ...requestMeta(req) })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete corrective action' }, { status: 500 })
  }
}

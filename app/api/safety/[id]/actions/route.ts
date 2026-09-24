import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canWrite } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const incident = await prisma.safetyIncident.findUnique({ where: { id }, select: { id: true } })
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    const actions = await prisma.safetyCorrectiveAction.findMany({ where: { incidentId: id }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }] })
    return NextResponse.json({ actions })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch corrective actions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canWrite(role)) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const { id } = await params
    const incident = await prisma.safetyIncident.findUnique({ where: { id }, select: { id: true, title: true, projectId: true, status: true } })
    if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    if (incident.status === 'closed') return NextResponse.json({ error: 'Reopen the incident before adding corrective actions' }, { status: 409 })
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Action title is required' }, { status: 400 })
    if (title.length > 200) return NextResponse.json({ error: 'Action title too long' }, { status: 400 })
    let dueDate: Date | null = null
    if (body.dueDate) {
      dueDate = new Date(body.dueDate)
      if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
    }
    const action = await prisma.safetyCorrectiveAction.create({
      data: {
        incidentId: id,
        title,
        description: String(body.description || '').trim().slice(0, 2000) || null,
        ownerName: String(body.ownerName || '').trim().slice(0, 160) || null,
        dueDate,
        notes: String(body.notes || '').trim().slice(0, 2000) || null,
        evidenceUrl: typeof body.evidenceUrl === 'string' && body.evidenceUrl.trim() ? body.evidenceUrl.trim().slice(0, 1000) : null,
      },
    })
    if (incident.status === 'open') {
      await prisma.safetyIncident.update({ where: { id }, data: { status: 'investigating', investigationStartedAt: new Date() } }).catch(() => {})
    }
    prisma.activity.create({ data: {
      projectId: incident.projectId,
      actorName: actorName(auth), actorType: 'human',
      action: `added corrective action: ${action.title}`,
      detail: `Safety incident · ${incident.title}`, iconType: 'alert',
    } }).catch(() => {})
    auditLog({ action: 'safety.correctiveAction.create', resourceType: 'SafetyCorrectiveAction', resourceId: action.id, metadata: { incidentId: id }, ...requestMeta(req) })
    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create corrective action' }, { status: 500 })
  }
}

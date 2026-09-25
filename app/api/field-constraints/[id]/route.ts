import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

const CATEGORIES = new Set(['access', 'design', 'material', 'labour', 'plant', 'client', 'weather', 'quality', 'safety', 'other'])
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical'])
const STATUSES = new Set(['open', 'mitigating', 'resolved'])

function parseDate(value: unknown) {
  if (value === null || value === '') return null
  if (value === undefined) return undefined
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? undefined : d
}

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const { id } = await paramsP

  try {
    const existing = await prisma.fieldConstraint.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Constraint not found' }, { status: 404 })
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(existing.projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = controls.cleanText(body.title, 220)
    if (typeof body.detail === 'string') data.detail = controls.cleanText(body.detail, 2000) || null
    if (typeof body.location === 'string') data.location = controls.cleanText(body.location, 160) || null
    if (typeof body.ownerName === 'string') data.ownerName = controls.cleanText(body.ownerName, 120) || null
    if (typeof body.resolution === 'string') data.resolution = controls.cleanText(body.resolution, 2000) || null
    if (typeof body.category === 'string' && CATEGORIES.has(body.category)) data.category = body.category
    if (typeof body.priority === 'string' && PRIORITIES.has(body.priority)) data.priority = body.priority
    if ('dueDate' in body) {
      const dueDate = parseDate(body.dueDate)
      if (dueDate === undefined && body.dueDate) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      data.dueDate = dueDate ?? null
    }

    if (typeof body.status === 'string' && STATUSES.has(body.status)) {
      if (!controls.canTransitionConstraintStatus(existing.status, body.status)) {
        return NextResponse.json({ error: `Invalid constraint transition: ${existing.status} → ${body.status}` }, { status: 409 })
      }
      data.status = body.status
      data.resolvedAt = body.status === 'resolved' ? (existing.resolvedAt || new Date()) : null
    }

    const updated = await prisma.fieldConstraint.update({ where: { id }, data })
    if (data.status && data.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: existing.projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: `constraint ${updated.title}: ${existing.status} → ${String(data.status)}`,
          detail: updated.resolution || undefined,
          iconType: data.status === 'resolved' ? 'check' : 'alert',
        },
      }).catch(() => {})
    }

    return NextResponse.json(updated)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update field constraint' }, { status: 500 })
  }
}

export const PUT = PATCH

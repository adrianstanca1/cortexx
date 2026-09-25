import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

const CATEGORIES = new Set(['access', 'design', 'material', 'labour', 'plant', 'client', 'weather', 'quality', 'safety', 'other'])
const PRIORITIES = new Set(['low', 'medium', 'high', 'critical'])
const STATUSES = new Set(['open', 'mitigating', 'resolved'])

function parseDate(value: unknown) {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = controls.cleanText(searchParams.get('projectId'), 100)
    const status = controls.cleanText(searchParams.get('status'), 30)
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const where = { projectId, ...(status && STATUSES.has(status) ? { status } : {}) }
    const [constraints, openCount, criticalCount] = await Promise.all([
      prisma.fieldConstraint.findMany({ where, orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }], take: 200 }),
      prisma.fieldConstraint.count({ where: { projectId, status: { not: 'resolved' } } }),
      prisma.fieldConstraint.count({ where: { projectId, status: { not: 'resolved' }, priority: 'critical' } }),
    ])
    return NextResponse.json({ constraints, openCount, criticalCount })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load field constraints' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId || '')
  if (limited) return limited

  try {
    const body = await req.json()
    const projectId = controls.cleanText(body.projectId, 100)
    const title = controls.cleanText(body.title, 220)
    if (!projectId || !title) return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 })

    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const category = CATEGORIES.has(String(body.category)) ? String(body.category) : 'other'
    const priority = PRIORITIES.has(String(body.priority)) ? String(body.priority) : 'medium'
    const dueDate = body.dueDate ? parseDate(body.dueDate) : null
    if (body.dueDate && !dueDate) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })

    const constraint = await prisma.fieldConstraint.create({
      data: {
        projectId,
        category,
        title,
        detail: controls.cleanText(body.detail, 2000) || null,
        location: controls.cleanText(body.location, 160) || null,
        priority,
        status: 'open',
        ownerName: controls.cleanText(body.ownerName, 120) || null,
        dueDate,
      },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `field constraint raised: ${title}`,
        detail: category,
        iconType: 'alert',
      },
    }).catch(() => {})

    return NextResponse.json(constraint, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create field constraint' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { getCurrentOrg } from '@/lib/tenancy'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'
import changeControl from '@/lib/programme-change-control'

export const dynamic = 'force-dynamic'
const { normalizeDelayDays } = changeControl
const CATEGORIES = new Set(['weather', 'client', 'design', 'supply', 'labour', 'access', 'other'])

function parseDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const delays = await prisma.programmeDelayEvent.findMany({
      where: { projectId: id },
      include: { activity: { select: { id: true, code: true, title: true } } },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    })
    return NextResponse.json({ delays })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load delay events' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const userId = (auth.user as { id?: string }).id || ''
  const limited = await enforceRateLimit(req, 'write', userId)
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const body = await req.json()
    const title = String(body.title || '').trim().slice(0, 220)
    if (!title) return NextResponse.json({ error: 'Delay title is required' }, { status: 400 })
    const category = CATEGORIES.has(String(body.category)) ? String(body.category) : 'other'
    const startDate = parseDate(body.startDate)
    if (!startDate) return NextResponse.json({ error: 'Valid delay start date is required' }, { status: 400 })
    const endDate = body.endDate ? parseDate(body.endDate) : null
    if (body.endDate && !endDate) return NextResponse.json({ error: 'Invalid delay end date' }, { status: 400 })
    if (endDate && endDate < startDate) return NextResponse.json({ error: 'Delay end must be on or after start' }, { status: 400 })
    const delayDays = normalizeDelayDays(body.delayDays ?? 0)
    if (delayDays === null) return NextResponse.json({ error: 'Delay days must be between 0 and 3650' }, { status: 400 })
    const activityId = body.activityId ? String(body.activityId) : null
    if (activityId) {
      const activity = await prisma.programmeActivity.findFirst({ where: { id: activityId, projectId: id }, select: { id: true } })
      if (!activity) return NextResponse.json({ error: 'Programme activity not found' }, { status: 400 })
    }
    const orgId = getCurrentOrg()?.organizationId
    if (!orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
    const delay = await prisma.programmeDelayEvent.create({ data: {
      projectId: id,
      activityId,
      title,
      category,
      cause: String(body.cause || '').trim().slice(0, 2000) || null,
      impact: String(body.impact || '').trim().slice(0, 2000) || null,
      startDate,
      endDate,
      delayDays,
      status: 'open',
      createdByUserId: userId || null,
      organizationId: orgId,
    } })
    auditLog({ action: 'programme.delay.create', resourceType: 'ProgrammeDelayEvent', resourceId: delay.id, metadata: { projectId: id, title, category, delayDays }, ...requestMeta(req) })
    return NextResponse.json(delay, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create delay event' }, { status: 500 })
  }
}

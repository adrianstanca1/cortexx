import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'
import programme from '@/lib/programme'

export const dynamic = 'force-dynamic'
const TYPES = new Set(['FS', 'SS', 'FF', 'SF'])
const { wouldCreateCycle } = programme

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const body = await req.json()
    const predecessorId = String(body.predecessorId || '')
    const successorId = String(body.successorId || '')
    if (!predecessorId || !successorId || predecessorId === successorId) return NextResponse.json({ error: 'Choose two different programme activities' }, { status: 400 })
    const type = TYPES.has(String(body.type)) ? String(body.type) : 'FS'
    const lagDays = Math.max(-365, Math.min(365, Number(body.lagDays) || 0))
    const activities = await prisma.programmeActivity.findMany({ where: { projectId: id }, select: { id: true, plannedStart: true, plannedEnd: true, status: true, progress: true } })
    const ids = new Set(activities.map(a => a.id))
    if (!ids.has(predecessorId) || !ids.has(successorId)) return NextResponse.json({ error: 'Both activities must belong to this project' }, { status: 400 })
    const dependencies = await prisma.programmeDependency.findMany({ where: { projectId: id } })
    if (wouldCreateCycle(activities, dependencies, { predecessorId, successorId, type, lagDays })) {
      return NextResponse.json({ error: 'Dependency would create a programme cycle' }, { status: 409 })
    }
    const dependency = await prisma.programmeDependency.create({ data: { projectId: id, predecessorId, successorId, type, lagDays } })
    auditLog({ action: 'programme.dependency.create', resourceType: 'ProgrammeDependency', resourceId: dependency.id, metadata: { projectId: id, predecessorId, successorId, type, lagDays }, ...requestMeta(req) })
    return NextResponse.json(dependency, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to create programme dependency' }, { status: 500 })
  }
}

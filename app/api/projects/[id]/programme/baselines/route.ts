import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { getCurrentOrg } from '@/lib/tenancy'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'
import { commitProgrammeBaseline } from '@/lib/programme-change-control-server'

export const dynamic = 'force-dynamic'

function parseDate(value: unknown) {
  if (!value) return undefined
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
    const baselines = await prisma.programmeBaselineRevision.findMany({
      where: { projectId: id },
      select: { id: true, revision: true, label: true, reason: true, status: true, effectiveAt: true, createdAt: true, createdByUserId: true },
      orderBy: { revision: 'desc' },
      take: 100,
    })
    return NextResponse.json({ baselines })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load programme baselines' }, { status: 500 })
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
    const reason = String(body.reason || '').trim().slice(0, 1000)
    if (!reason) return NextResponse.json({ error: 'Baseline revision reason is required' }, { status: 400 })
    const label = String(body.label || '').trim().slice(0, 160) || null
    const effectiveAt = parseDate(body.effectiveAt)
    if (effectiveAt === null) return NextResponse.json({ error: 'Invalid effective date' }, { status: 400 })
    const orgId = getCurrentOrg()?.organizationId
    if (!orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
    const baseline = await prisma.$transaction(tx => commitProgrammeBaseline(tx, {
      projectId: id,
      organizationId: orgId,
      createdByUserId: userId || null,
      label,
      reason,
      effectiveAt,
    }))
    auditLog({ action: 'programme.baseline.create', resourceType: 'ProgrammeBaselineRevision', resourceId: baseline.id, metadata: { projectId: id, revision: baseline.revision, reason }, ...requestMeta(req) })
    return NextResponse.json(baseline, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROGRAMME_EMPTY') return NextResponse.json({ error: 'Add at least one programme activity before creating a baseline' }, { status: 409 })
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'Another baseline revision was created concurrently; reload and retry' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to create programme baseline' }, { status: 500 })
  }
}

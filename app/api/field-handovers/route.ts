import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'
const SHIFT_TYPES = new Set(['day', 'night', 'weekend', 'other'])

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
    const take = Math.min(Math.max(Number(searchParams.get('take')) || 30, 1), 100)
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const handovers = await prisma.fieldHandover.findMany({
      where: { projectId },
      orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
      take,
    })
    return NextResponse.json({
      handovers,
      pendingAcceptance: handovers.filter(h => !h.acceptedAt).length,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load handovers' }, { status: 500 })
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
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const shiftDate = body.shiftDate ? parseDate(body.shiftDate) : new Date()
    if (!shiftDate) return NextResponse.json({ error: 'Invalid shiftDate' }, { status: 400 })
    const shiftType = SHIFT_TYPES.has(String(body.shiftType)) ? String(body.shiftType) : 'day'
    const outgoingBy = controls.cleanText(body.outgoingBy, 120) || actorName(auth.session)

    const handover = await prisma.fieldHandover.create({
      data: {
        projectId,
        shiftDate,
        shiftType,
        outgoingBy,
        incomingBy: controls.cleanText(body.incomingBy, 120) || null,
        summary: controls.cleanText(body.summary, 2000) || null,
        completedWork: controls.cleanText(body.completedWork, 3000) || null,
        nextShiftPlan: controls.cleanText(body.nextShiftPlan, 3000) || null,
        safetyNotes: controls.cleanText(body.safetyNotes, 2000) || null,
        qualityNotes: controls.cleanText(body.qualityNotes, 2000) || null,
        materialsNotes: controls.cleanText(body.materialsNotes, 2000) || null,
        plantNotes: controls.cleanText(body.plantNotes, 2000) || null,
        openItems: controls.sanitizeOpenItems(body.openItems) as unknown as object,
      },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: outgoingBy,
        actorType: 'human',
        action: `${shiftType} shift handover created`,
        detail: handover.summary || undefined,
        iconType: 'doc',
      },
    }).catch(() => {})

    return NextResponse.json(handover, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create shift handover' }, { status: 500 })
  }
}

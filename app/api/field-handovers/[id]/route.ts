import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { canWrite } from '@/lib/rbac'
import { reportError } from '@/lib/errors'
import { programmeProjectWhere } from '@/lib/programme-access'
import controls from '@/lib/field-controls'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '')) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const { id } = await paramsP

  try {
    const existing = await prisma.fieldHandover.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Handover not found' }, { status: 404 })
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(existing.projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (typeof body.incomingBy === 'string') data.incomingBy = controls.cleanText(body.incomingBy, 120) || null
    if (typeof body.summary === 'string') data.summary = controls.cleanText(body.summary, 2000) || null
    if (typeof body.nextShiftPlan === 'string') data.nextShiftPlan = controls.cleanText(body.nextShiftPlan, 3000) || null
    if (Array.isArray(body.openItems)) data.openItems = controls.sanitizeOpenItems(body.openItems) as unknown as object
    if (body.accept === true && !existing.acceptedAt) {
      data.acceptedBy = controls.cleanText(body.acceptedBy, 120) || actorName(auth.session)
      data.acceptedAt = new Date()
    }

    const handover = await prisma.fieldHandover.update({ where: { id }, data })
    if (data.acceptedAt) {
      prisma.activity.create({
        data: {
          projectId: existing.projectId,
          actorName: String(data.acceptedBy || actorName(auth.session)),
          actorType: 'human',
          action: `${existing.shiftType} shift handover accepted`,
          iconType: 'check',
        },
      }).catch(() => {})
    }
    return NextResponse.json(handover)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update shift handover' }, { status: 500 })
  }
}

export const PUT = PATCH

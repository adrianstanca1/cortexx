import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { programmeProjectWhere } from '@/lib/programme-access'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import {
  canAnnotateDrawing,
  DrawingMarkupValidationError,
  parseMarkupColor,
  parseMarkupPage,
  parseMarkupStatus,
  parseMarkupText,
  parseNormalized,
  parseOptionalNormalized,
} from '@/lib/drawing-markup'

export const dynamic = 'force-dynamic'

async function accessibleMarkup(markupId: string, auth: Exclude<Awaited<ReturnType<typeof requireOrg>>, NextResponse>) {
  const markup = await prisma.drawingMarkup.findFirst({
    where: { id: markupId },
  })
  if (!markup) return null
  const project = await prisma.project.findFirst({
    where: programmeProjectWhere(markup.projectId, auth.session),
    select: { id: true },
  })
  return project ? markup : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ markupId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const { markupId } = await params
  try {
    const existing = await accessibleMarkup(markupId, auth)
    if (!existing) return NextResponse.json({ error: 'Drawing markup not found' }, { status: 404 })
    if (!canAnnotateDrawing(auth.role, auth.personaRole)) {
      return NextResponse.json({ error: 'Drawing annotation permission required' }, { status: 403 })
    }
    const limited = await enforceRateLimit(req, 'write', auth.userId)
    if (limited) return limited
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.text !== undefined) data.text = parseMarkupText(body.text)
    if (body.color !== undefined) data.color = parseMarkupColor(body.color)
    if (body.page !== undefined) data.page = parseMarkupPage(body.page)
    if (body.x !== undefined) data.x = parseNormalized(body.x, 'x')
    if (body.y !== undefined) data.y = parseNormalized(body.y, 'y')
    if (body.width !== undefined) data.width = parseOptionalNormalized(body.width, 'width')
    if (body.height !== undefined) data.height = parseOptionalNormalized(body.height, 'height')

    if (body.status !== undefined) {
      const status = parseMarkupStatus(body.status)
      data.status = status
      data.resolvedAt = status === 'resolved' ? new Date() : null
      data.resolvedBy = status === 'resolved' ? actorName(auth.session) : null
    }
    const nextWidth = body.width !== undefined ? data.width as number | null : existing.width
    const nextHeight = body.height !== undefined ? data.height as number | null : existing.height
    if (existing.kind === 'box' && ((!nextWidth || nextWidth <= 0) || (!nextHeight || nextHeight <= 0))) {
      throw new DrawingMarkupValidationError('Box markups require width and height')
    }
    const updated = await prisma.drawingMarkup.update({
      where: { id: existing.id },
      data,
    })
    auditLog({
      action: 'drawing.markup.update',
      resourceType: 'DrawingMarkup',
      resourceId: existing.id,
      metadata: {
        drawingId: existing.drawingId,
        revisionId: existing.revisionId,
        status: updated.status,
        fields: Object.keys(data),
      },
      ...requestMeta(req),
    })
    if (body.status !== undefined && updated.status !== existing.status) {
      prisma.activity.create({
        data: {
          projectId: existing.projectId,
          actorName: actorName(auth.session),
          actorType: 'human',
          action: (updated.status === 'resolved' ? 'resolved' : 'reopened') + ' drawing markup',
          iconType: updated.status === 'resolved' ? 'check' : 'doc',
        },
      }).catch(() => {})
    }
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof DrawingMarkupValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to update drawing markup' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ markupId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const { markupId } = await params
  try {
    const existing = await accessibleMarkup(markupId, auth)
    if (!existing) return NextResponse.json({ error: 'Drawing markup not found' }, { status: 404 })
    if (!canAnnotateDrawing(auth.role, auth.personaRole)) {
      return NextResponse.json({ error: 'Drawing annotation permission required' }, { status: 403 })
    }
    const limited = await enforceRateLimit(req, 'write', auth.userId)
    if (limited) return limited
    await prisma.drawingMarkup.delete({ where: { id: existing.id } })
    auditLog({
      action: 'drawing.markup.delete',
      resourceType: 'DrawingMarkup',
      resourceId: existing.id,
      metadata: {
        drawingId: existing.drawingId,
        revisionId: existing.revisionId,
        page: existing.page,
      },
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: existing.projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: 'deleted drawing markup',
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete drawing markup' }, { status: 500 })
  }
}

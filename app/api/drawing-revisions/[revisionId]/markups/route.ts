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
  parseMarkupKind,
  parseMarkupPage,
  parseMarkupText,
  parseNormalized,
  parseOptionalNormalized,
} from '@/lib/drawing-markup'

export const dynamic = 'force-dynamic'

async function accessibleRevision(revisionId: string, auth: Awaited<ReturnType<typeof requireOrg>>) {
  if (auth instanceof NextResponse) return null
  const revision = await prisma.drawingRevision.findFirst({
    where: { id: revisionId },
    include: { drawing: { select: { id: true, projectId: true, number: true, title: true } } },
  })
  if (!revision) return null
  const project = await prisma.project.findFirst({
    where: programmeProjectWhere(revision.drawing.projectId, auth.session),
    select: { id: true },
  })
  return project ? revision : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ revisionId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const { revisionId } = await params
  try {
    const revision = await accessibleRevision(revisionId, auth)
    if (!revision) return NextResponse.json({ error: 'Drawing revision not found' }, { status: 404 })
    const query = new URL(req.url).searchParams
    const pageRaw = query.get('page')
    const page = pageRaw ? parseMarkupPage(pageRaw) : null
    const status = query.get('status')
    if (status && status !== 'all' && status !== 'open' && status !== 'resolved') {
      return NextResponse.json({ error: 'Invalid markup status' }, { status: 400 })
    }
    const markups = await prisma.drawingMarkup.findMany({
      where: {
        revisionId,
        ...(page ? { page } : {}),
        ...(status && status !== 'all' ? { status } : {}),
      },
      orderBy: [{ page: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({
      markups,
      permissions: { annotate: canAnnotateDrawing(auth.role, auth.personaRole) },
    })
  } catch (error) {
    if (error instanceof DrawingMarkupValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to load drawing markups' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ revisionId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const { revisionId } = await params
  try {
    const revision = await accessibleRevision(revisionId, auth)
    if (!revision) return NextResponse.json({ error: 'Drawing revision not found' }, { status: 404 })
    if (!canAnnotateDrawing(auth.role, auth.personaRole)) {
      return NextResponse.json({ error: 'Drawing annotation permission required' }, { status: 403 })
    }
    const limited = await enforceRateLimit(req, 'write', auth.userId)
    if (limited) return limited

    const body = await req.json()
    const kind = parseMarkupKind(body.kind)
    const page = parseMarkupPage(body.page)
    const x = parseNormalized(body.x, 'x')
    const y = parseNormalized(body.y, 'y')
    const width = parseOptionalNormalized(body.width, 'width')
    const height = parseOptionalNormalized(body.height, 'height')
    if (kind === 'box' && ((!width || width <= 0) || (!height || height <= 0))) {
      throw new DrawingMarkupValidationError('Box markups require width and height')
    }
    const text = parseMarkupText(body.text)
    const color = parseMarkupColor(body.color)
    const who = actorName(auth.session)
    const markup = await prisma.drawingMarkup.create({
      data: {
        projectId: revision.drawing.projectId,
        drawingId: revision.drawing.id,
        revisionId,
        page,
        kind,
        x,
        y,
        width,
        height,
        text,
        color,
        createdByUserId: auth.userId || null,
        createdBy: who,
      },
    })

    auditLog({
      action: 'drawing.markup.create',
      resourceType: 'DrawingMarkup',
      resourceId: markup.id,
      metadata: { drawingId: revision.drawing.id, revisionId, page, kind },
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: revision.drawing.projectId,
        actorName: who,
        actorType: 'human',
        action: 'annotated ' + revision.drawing.number + ' rev ' + revision.revision,
        iconType: 'doc',
      },
    }).catch(() => {})
    return NextResponse.json(markup, { status: 201 })
  } catch (error) {
    if (error instanceof DrawingMarkupValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to create drawing markup' }, { status: 500 })
  }
}

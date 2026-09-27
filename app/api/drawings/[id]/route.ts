import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { programmeProjectScope } from '@/lib/programme-access'
import { canWrite } from '@/lib/rbac'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['draft', 'approved', 'superseded', 'archived'])

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const drawing = await prisma.drawing.findFirst({
    where: { id: params.id, project: { is: programmeProjectScope(auth.session) } },
    include: {
      project: { select: { id: true, name: true } },
      revisions: { orderBy: { uploadedAt: 'desc' }, include: { _count: { select: { markups: true } } } },
    },
  })
  if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ drawing })
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '') || !['company_admin', 'project_manager'].includes(auth.personaRole || '')) {
    return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  }
  try {
    const existing = await prisma.drawing.findFirst({ where: { id: params.id, project: { is: programmeProjectScope(auth.session) } }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    if (body.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.discipline !== undefined) data.discipline = body.discipline?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.status !== undefined && ALLOWED_STATUS.has(body.status)) data.status = body.status
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null

    const drawing = await prisma.drawing.update({
      where: { id: params.id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1, include: { _count: { select: { markups: true } } } },
      },
    })
    return NextResponse.json(drawing)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update drawing' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '') || !['company_admin', 'project_manager'].includes(auth.personaRole || '')) {
    return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  }
  try {
    const d = await prisma.drawing.findFirst({ where: { id: params.id, project: { is: programmeProjectScope(auth.session) } }, select: { projectId: true, number: true, title: true } })
    if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.drawing.delete({ where: { id: params.id } })
    auditLog({
      action: 'drawing.delete',
      resourceType: 'Drawing',
      resourceId: params.id,
      ...requestMeta(req),
    })
    prisma.activity.create({
      data: {
        projectId: d.projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `deleted drawing ${d.number}: ${d.title}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 })
  }
}

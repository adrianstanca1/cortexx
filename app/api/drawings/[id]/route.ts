import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['draft', 'approved', 'superseded', 'archived'])

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const drawing = await prisma.drawing.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      revisions: { orderBy: { uploadedAt: 'desc' } },
    },
  })
  if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ drawing })
}

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
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
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
      },
    })
    return NextResponse.json(drawing)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update drawing' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const d = await prisma.drawing.findUnique({ where: { id: params.id }, select: { projectId: true, number: true, title: true } })
    if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.drawing.delete({ where: { id: params.id } })
    prisma.activity.create({
      data: {
        projectId: d.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted drawing ${d.number}: ${d.title}`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 })
  }
}

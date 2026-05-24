import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_DISCIPLINE = new Set(['arch', 'struct', 'mep', 'civil', 'fire', 'other'])

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const drawing = await prisma.drawing.findUnique({
      where: { id: params.id },
      include: { project: { select: { id: true, name: true } } },
    })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(drawing)
  } catch (error) {
    console.error('[drawings/:id] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch drawing' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.drawing.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200)
    if (typeof body.number === 'string') data.number = body.number.trim().slice(0, 60) || null
    if (typeof body.revision === 'string' && body.revision.trim()) data.revision = body.revision.trim().slice(0, 20)
    if (typeof body.discipline === 'string' && ALLOWED_DISCIPLINE.has(body.discipline)) data.discipline = body.discipline
    if (typeof body.fileUrl === 'string') data.fileUrl = body.fileUrl.slice(0, 500) || null
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 1000) || null

    // Supersede action — toggling marks the drawing inactive so it falls out
    // of the default list. Useful when a new revision lands.
    if (typeof body.isSuperseded === 'boolean') {
      data.isSuperseded = body.isSuperseded
      data.supersededAt = body.isSuperseded ? new Date() : null
    }

    const drawing = await prisma.drawing.update({
      where: { id: params.id },
      data,
      include: { project: { select: { id: true, name: true } } },
    })

    if (data.isSuperseded === true && !existing.isSuperseded) {
      prisma.activity.create({
        data: {
          projectId: drawing.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `superseded drawing: ${drawing.number ? `${drawing.number} ` : ''}${drawing.title} (rev ${drawing.revision})`,
          iconType: 'doc',
        },
      }).catch(() => {})
    }
    return NextResponse.json(drawing)
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'A drawing with this number + revision already exists for this project' }, { status: 409 })
    }
    console.error('[drawings/:id] PATCH failed:', error)
    return NextResponse.json({ error: 'Failed to update drawing' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const drawing = await prisma.drawing.findUnique({ where: { id: params.id } })
    if (!drawing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.drawing.delete({ where: { id: params.id } })
    prisma.activity.create({
      data: {
        projectId: drawing.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `deleted drawing: ${drawing.title}`,
        iconType: 'doc',
      },
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[drawings/:id] DELETE failed:', error)
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 })
  }
}

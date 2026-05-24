import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const revision = String(body.revision || '').trim()
    if (!revision) return NextResponse.json({ error: 'Revision label is required (e.g. A, B, P01)' }, { status: 400 })
    if (revision.length > 10) return NextResponse.json({ error: 'Revision label too long' }, { status: 400 })

    const drawing = await prisma.drawing.findUnique({ where: { id: params.id }, select: { id: true, projectId: true, number: true, title: true } })
    if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

    const fileUrl = typeof body.fileUrl === 'string' && body.fileUrl ? body.fileUrl : null
    const fileName = typeof body.fileName === 'string' && body.fileName ? body.fileName : null
    const fileSize = typeof body.fileSize === 'number' && body.fileSize >= 0 ? body.fileSize : null
    const mimeType = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : null

    const rev = await prisma.drawingRevision.create({
      data: {
        drawingId: params.id,
        revision,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        notes: body.notes?.toString().trim() || null,
      },
    })

    prisma.activity.create({
      data: {
        projectId: drawing.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `${drawing.number} rev ${revision} uploaded: ${drawing.title}`,
        iconType: 'doc',
      },
    }).catch(() => {})

    return NextResponse.json(rev, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A revision with that label already exists' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to add revision' }, { status: 500 })
  }
}

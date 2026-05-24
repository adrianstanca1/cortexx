import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_DISCIPLINE = new Set(['arch', 'struct', 'mep', 'civil', 'fire', 'other'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const discipline = searchParams.get('discipline')
    const includeSuperseded = searchParams.get('includeSuperseded') === '1'
    const search = searchParams.get('q')?.trim()
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where = {
      ...(projectId && { projectId }),
      ...(discipline && ALLOWED_DISCIPLINE.has(discipline) && { discipline }),
      ...(!includeSuperseded && { isSuperseded: false }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { number: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }
    const [drawings, total] = await Promise.all([
      prisma.drawing.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ updatedAt: 'desc' }],
        take,
        skip,
      }),
      prisma.drawing.count({ where }),
    ])
    return NextResponse.json({ drawings, total, hasMore: skip + drawings.length < total })
  } catch (error) {
    console.error('[drawings] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch drawings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const discipline = ALLOWED_DISCIPLINE.has(body.discipline) ? body.discipline : 'arch'
    const revision = String(body.revision || 'C01').trim().slice(0, 20) || 'C01'
    const number = body.number ? String(body.number).trim().slice(0, 60) || null : null

    const drawing = await prisma.drawing.create({
      data: {
        projectId,
        title: title.slice(0, 200),
        discipline,
        revision,
        number,
        fileUrl: typeof body.fileUrl === 'string' && body.fileUrl ? body.fileUrl.slice(0, 500) : null,
        uploadedBy: actorName(auth),
        notes: typeof body.notes === 'string' && body.notes ? body.notes.slice(0, 1000) : null,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId: drawing.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `uploaded drawing: ${drawing.number ? `${drawing.number} ` : ''}${drawing.title} (rev ${drawing.revision})`,
        iconType: 'doc',
      },
    }).catch(() => {})

    return NextResponse.json(drawing, { status: 201 })
  } catch (error) {
    // Unique constraint on (projectId, number, revision) — surface a friendly message.
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'A drawing with this number + revision already exists for this project' }, { status: 409 })
    }
    console.error('[drawings] POST failed:', error)
    return NextResponse.json({ error: 'Failed to create drawing' }, { status: 500 })
  }
}

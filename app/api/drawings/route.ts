import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_STATUS = new Set(['draft', 'approved', 'superseded', 'archived'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const discipline = searchParams.get('discipline')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const where = {
      ...(projectId && { projectId }),
      ...(discipline && { discipline }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(status === undefined && { archivedAt: null }),
    }
    const drawings = await prisma.drawing.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        _count: { select: { revisions: true } },
      },
      orderBy: [{ status: 'asc' }, { number: 'asc' }],
      take,
    })
    const disciplines = await prisma.drawing.findMany({
      where: { archivedAt: null, discipline: { not: null } },
      distinct: ['discipline'],
      select: { discipline: true },
    })
    return NextResponse.json({
      drawings,
      disciplines: disciplines.map(d => d.discipline).filter(Boolean).sort(),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch drawings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    // Sequential DWG-NNN per project, unless body.number supplied
    let number = String(body.number || '').trim()
    if (!number) {
      const last = await prisma.drawing.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { number: true },
      })
      const parsed = last ? parseInt((last.number.match(/(\d+)$/)?.[1]) || '0', 10) : 0
      const lastNum = Number.isFinite(parsed) ? parsed : 0
      number = `DWG-${String(lastNum + 1).padStart(3, '0')}`
    }

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'

    const drawing = await prisma.drawing.create({
      data: {
        projectId,
        number,
        title,
        discipline: body.discipline?.toString().trim() || null,
        status,
        notes: body.notes?.toString().trim() || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        _count: { select: { revisions: true } },
      },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `added drawing ${drawing.number}: ${drawing.title}`,
        iconType: 'doc',
      },
    }).catch(() => {})

    return NextResponse.json(drawing, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Drawing number already used on this project' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create drawing' }, { status: 500 })
  }
}

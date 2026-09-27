import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { programmeProjectScope, programmeProjectWhere } from '@/lib/programme-access'
import { canWrite } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_STATUS = new Set(['draft', 'approved', 'superseded', 'archived'])

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const discipline = searchParams.get('discipline')
    const status = searchParams.get('status')
    const parsedTake = Number.parseInt(searchParams.get('take') || '100', 10)
    const take = Math.max(1, Math.min(Number.isNaN(parsedTake) ? 100 : parsedTake, MAX_TAKE))

    const where: Prisma.DrawingWhereInput = {
      ...(projectId && { projectId }),
      project: { is: programmeProjectScope(auth.session) },
      ...(discipline && { discipline }),
      ...(status === 'archived'
        ? { OR: [{ status: 'archived' }, { archivedAt: { not: null } }] }
        : { archivedAt: null, status: status && ALLOWED_STATUS.has(status) ? status : { not: 'archived' } }),
    }
    const drawings = await prisma.drawing.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1, include: { _count: { select: { markups: true } } } },
        _count: { select: { revisions: true } },
      },
      orderBy: [{ status: 'asc' }, { number: 'asc' }],
      take,
    })
    const disciplines = await prisma.drawing.findMany({
      where: { archivedAt: null, discipline: { not: null }, project: { is: programmeProjectScope(auth.session) } },
      distinct: ['discipline'],
      select: { discipline: true },
    })
    return NextResponse.json({
      drawings,
      disciplines: disciplines.map(d => d.discipline).filter(Boolean).sort(),
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch drawings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canWrite(auth.role || '') || !['company_admin', 'project_manager'].includes(auth.personaRole || '')) {
    return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  }
  const __limited = await enforceRateLimit(req, 'write', auth.userId)
  if (__limited) return __limited
  try {
    const body = await req.json()
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
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
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1, include: { _count: { select: { markups: true } } } },
        _count: { select: { revisions: true } },
      },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth.session),
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
    reportError(error)
    return NextResponse.json({ error: 'Failed to create drawing' }, { status: 500 })
  }
}

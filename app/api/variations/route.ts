import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['draft', 'submitted', 'approved', 'rejected'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
    }
    const [variations, pendingCount, approvedCostImpact] = await Promise.all([
      prisma.variation.findMany({
        where,
        include: { project: { select: { id: true, name: true, budget: true, clientName: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.variation.count({ where: { ...where, status: { in: ['draft', 'submitted'] } } }),
      prisma.variation.aggregate({
        where: { ...where, status: 'approved' },
        _sum: { costImpact: true, daysImpact: true },
      }),
    ])
    return NextResponse.json({
      variations,
      pendingCount,
      approvedTotals: {
        costImpact: approvedCostImpact._sum.costImpact || 0,
        daysImpact: approvedCostImpact._sum.daysImpact || 0,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch variations' }, { status: 500 })
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

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientName: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const costImpact = body.costImpact === undefined || body.costImpact === null || body.costImpact === ''
      ? 0
      : Number(body.costImpact)
    if (isNaN(costImpact)) return NextResponse.json({ error: 'Cost impact must be a number' }, { status: 400 })

    const daysImpact = body.daysImpact === undefined || body.daysImpact === null || body.daysImpact === ''
      ? 0
      : parseInt(body.daysImpact)
    if (isNaN(daysImpact)) return NextResponse.json({ error: 'Days impact must be a whole number' }, { status: 400 })

    // Per-project sequential VAR number: VAR-001
    const last = await prisma.variation.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })
    const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
    const lastNum = Number.isFinite(parsed) ? parsed : 0
    const number = `VAR-${String(lastNum + 1).padStart(3, '0')}`

    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'draft'

    const variation = await prisma.variation.create({
      data: {
        number,
        projectId,
        title,
        description: body.description?.toString().trim() || null,
        costImpact,
        daysImpact,
        status,
        clientName: body.clientName?.toString().trim() || project.clientName || null,
        notes: body.notes?.toString().trim() || null,
        submittedAt: status === 'submitted' ? new Date() : null,
      },
      include: { project: { select: { id: true, name: true, budget: true, clientName: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `raised ${variation.number}: ${variation.title} (£${costImpact.toLocaleString('en-GB')})`,
        iconType: 'wrench',
      },
    }).catch(() => {})

    return NextResponse.json(variation, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create variation' }, { status: 500 })
  }
}

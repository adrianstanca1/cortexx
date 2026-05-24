import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['open', 'answered', 'closed'])
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)

    const where = {
      ...(projectId && { projectId }),
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(priority && ALLOWED_PRIORITY.has(priority) && { priority }),
    }

    const [rfis, openCount, overdueCount] = await Promise.all([
      prisma.rfi.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.rfi.count({ where: { ...where, status: { not: 'closed' } } }),
      prisma.rfi.count({ where: { ...where, status: { not: 'closed' }, dueDate: { lt: new Date() } } }),
    ])
    return NextResponse.json({ rfis, openCount, overdueCount })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch RFIs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const subject = String(body.subject || '').trim()
    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    const bodyText = String(body.body || '').trim()
    if (!bodyText) return NextResponse.json({ error: 'Body is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    let dueDate: Date | null = null
    if (body.dueDate) {
      const d = new Date(body.dueDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      dueDate = d
    }

    // Per-project sequential RFI number: RFI-001
    const last = await prisma.rfi.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    })
    // Use Number.isFinite to guard against parseInt returning NaN on a
    // malformed RFI number (e.g. legacy import or hand-edited DB row).
    const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
    const lastNum = Number.isFinite(parsed) ? parsed : 0
    const number = `RFI-${String(lastNum + 1).padStart(3, '0')}`

    const rfi = await prisma.rfi.create({
      data: {
        number,
        subject,
        body: bodyText,
        projectId,
        status: ALLOWED_STATUS.has(body.status) ? body.status : 'open',
        priority: ALLOWED_PRIORITY.has(body.priority) ? body.priority : 'medium',
        raisedBy: body.raisedBy?.toString().trim() || actorName(auth),
        assignee: body.assignee?.toString().trim() || null,
        dueDate,
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId: rfi.projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: `raised ${rfi.number}: ${rfi.subject}`,
        iconType: 'alert',
      },
    }).catch(() => {})

    return NextResponse.json(rfi, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 })
  }
}

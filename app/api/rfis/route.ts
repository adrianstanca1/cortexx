import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

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
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch RFIs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
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

    // Per-project sequential RFI number: RFI-001. Two concurrent POSTs
    // on the same project would otherwise generate the same number and
    // the second would 500 on the unique constraint. Retry up to 5
    // times on P2002, refetching the latest number each time — bounded
    // and almost always succeeds on the second try in practice.
    let rfi: Awaited<ReturnType<typeof prisma.rfi.create>> | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await prisma.rfi.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { number: true },
      })
      const parsed = last ? parseInt(last.number.split('-').pop() || '0', 10) : 0
      const lastNum = Number.isFinite(parsed) ? parsed : 0
      const number = `RFI-${String(lastNum + 1 + attempt).padStart(3, '0')}`
      try {
        rfi = await prisma.rfi.create({
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
        break
      } catch (e) {
        lastError = e
        const code = (e as { code?: string })?.code
        if (code !== 'P2002') throw e   // not a uniqueness collision — re-raise
        // P2002 — racy peer also picked this number; retry with the next
      }
    }
    if (!rfi) {
      console.error('rfi create exhausted retries', lastError)
      return NextResponse.json({ error: 'Could not allocate a unique RFI number — try again', code: 'NUMBER_RACE' }, { status: 503 })
    }

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
    reportError(error)
    return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 })
  }
}

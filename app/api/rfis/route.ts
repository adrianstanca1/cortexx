import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canWrite } from '@/lib/rbac'
import { programmeProjectScope, programmeProjectWhere } from '@/lib/programme-access'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100
const ALLOWED_STATUS = new Set(['open', 'answered', 'closed'])
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high'])

function canManageRfi(auth: { role: string | null; personaRole?: string | null }) {
  return !!auth.role && canWrite(auth.role) && ['company_admin', 'project_manager', 'foreman'].includes(auth.personaRole || '')
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const where: Prisma.RfiWhereInput = {
      ...(projectId && { projectId }),
      project: { is: programmeProjectScope(auth.session) },
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(priority && ALLOWED_PRIORITY.has(priority) && { priority }),
    }

    const [rfis, openCount, overdueCount] = await Promise.all([
      prisma.rfi.findMany({
        where,
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      prisma.rfi.count({ where: { ...where, status: { not: 'closed' } } }),
      prisma.rfi.count({ where: { ...where, status: { not: 'closed' }, dueDate: { lt: new Date() } } }),
    ])
    const totalCount = await prisma.rfi.count({ where })
    return NextResponse.json({ rfis, openCount, overdueCount, totalCount, hasMore: skip + rfis.length < totalCount })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch RFIs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canManageRfi(auth)) return NextResponse.json({ error: 'Company Admin, Project Manager or Foreman permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const subject = String(body.subject || '').trim()
    if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    const bodyText = String(body.body || '').trim()
    if (!bodyText) return NextResponse.json({ error: 'Body is required' }, { status: 400 })
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findFirst({ where: programmeProjectWhere(projectId, auth.session), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })

    let dueDate: Date | null = null
    if (body.dueDate) {
      const d = new Date(body.dueDate)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      dueDate = d
    }

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
            raisedBy: body.raisedBy?.toString().trim() || actorName(auth.session),
            assignee: body.assignee?.toString().trim() || null,
            dueDate,
          },
          include: { project: { select: { id: true, name: true } } },
        })
        break
      } catch (error) {
        lastError = error
        if ((error as { code?: string })?.code !== 'P2002') throw error
      }
    }

    if (!rfi) {
      reportError(lastError, { context: 'rfi.number-allocation', projectId })
      return NextResponse.json({ error: 'Could not allocate a unique RFI number — try again', code: 'NUMBER_RACE' }, { status: 503 })
    }

    prisma.activity.create({
      data: {
        projectId: rfi.projectId,
        actorName: actorName(auth.session),
        actorType: 'human',
        action: `raised ${rfi.number}: ${rfi.subject}`,
        iconType: 'alert',
      },
    }).catch(() => undefined)

    return NextResponse.json(rfi, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 })
  }
}

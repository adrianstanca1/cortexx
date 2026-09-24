import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

function clampRetention(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(20, n)) : 3
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(Math.max(Number(sp.get('take')) || 50, 1), MAX_TAKE)
    const projectId = sp.get('projectId') || undefined
    const status = sp.get('status') || undefined
    const where = {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    }

    const [valuations, total] = await Promise.all([
      prisma.valuation.findMany({
        where,
        include: { project: { select: { id: true, name: true, clientName: true, budget: true, progress: true } } },
        orderBy: [{ periodEnd: 'desc' }, { applicationNumber: 'desc' }],
        take,
      }),
      prisma.valuation.count({ where }),
    ])

    const totals = valuations.reduce((acc, v) => {
      acc.grossToDate += v.grossToDate
      acc.retention += v.retentionAmount
      acc.netDue += v.netDue
      if (v.status === 'submitted' || v.status === 'certified') acc.outstanding += v.netDue
      if (v.status === 'certified' || v.status === 'paid') acc.certified += v.netDue
      return acc
    }, { grossToDate: 0, retention: 0, netDue: 0, outstanding: 0, certified: 0 })

    return NextResponse.json({ valuations, total, totals })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch valuations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canManage(role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited

  try {
    const body = await req.json()
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, budget: true, progress: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const suggestedGross = project.budget * project.progress / 100
    const grossToDate = body.grossToDate === undefined ? suggestedGross : Number(body.grossToDate)
    if (!Number.isFinite(grossToDate) || grossToDate < 0) {
      return NextResponse.json({ error: 'Gross value must be a non-negative number' }, { status: 400 })
    }

    const retentionPct = clampRetention(body.retentionPct)
    const retentionAmount = grossToDate * retentionPct / 100
    const previous = await prisma.valuation.aggregate({
      where: { projectId, status: { in: ['certified', 'paid'] } },
      _sum: { netDue: true },
    })
    const previousCertified = previous._sum.netDue || 0
    const netDue = Math.max(0, grossToDate - retentionAmount - previousCertified)

    let periodEnd = new Date()
    if (body.periodEnd) {
      const parsed = new Date(body.periodEnd)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid period end date' }, { status: 400 })
      periodEnd = parsed
    }

    let valuation = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const latest = await prisma.valuation.findFirst({
        where: { projectId },
        orderBy: { applicationNumber: 'desc' },
        select: { applicationNumber: true },
      })
      const applicationNumber = (latest?.applicationNumber || 0) + 1 + attempt
      try {
        valuation = await prisma.valuation.create({
          data: {
            projectId,
            applicationNumber,
            periodEnd,
            grossToDate,
            retentionPct,
            retentionAmount,
            previousCertified,
            netDue,
            status: 'draft',
            notes: body.notes?.toString().trim() || null,
          },
          include: { project: { select: { id: true, name: true, clientName: true, budget: true, progress: true } } },
        })
        break
      } catch (error) {
        lastError = error
        if ((error as { code?: string })?.code !== 'P2002') throw error
      }
    }

    if (!valuation) {
      reportError(lastError)
      return NextResponse.json({ error: 'Could not allocate a valuation number — try again' }, { status: 503 })
    }

    prisma.activity.create({
      data: {
        projectId,
        actorName: actorName(auth),
        actorType: 'human',
        action: 'created valuation VAL-' + String(valuation.applicationNumber).padStart(3, '0'),
        detail: 'Net due £' + valuation.netDue.toFixed(2),
        iconType: 'receipt',
      },
    }).catch(() => {})

    return NextResponse.json(valuation, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create valuation' }, { status: 500 })
  }
}

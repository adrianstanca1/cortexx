import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage } from '@/lib/rbac'
import { auditLog, requestMeta } from '@/lib/audit'
import commercialLedger from '@/lib/commercial-ledger'

export const dynamic = 'force-dynamic'
const { roundMoney, paymentSummary } = commercialLedger
const MAX_TAKE = 100
const DETAIL_INCLUDE = {
  project: { select: { id: true, name: true, clientName: true, budget: true, progress: true } },
  certificates: { orderBy: { revision: 'desc' as const }, include: { payments: { orderBy: { paidAt: 'desc' as const } } } },
  variationLinks: { include: { variation: { select: { id: true, number: true, title: true, costImpact: true, status: true } } } },
}

function clampRetention(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(20, n)) : 3
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(Math.max(Number(sp.get('take')) || 50, 1), MAX_TAKE)
    const projectId = sp.get('projectId') || undefined
    const status = sp.get('status') || undefined
    const where = { ...(projectId ? { projectId } : {}), ...(status ? { status } : {}) }
    const [valuations, total] = await Promise.all([
      prisma.valuation.findMany({ where, include: DETAIL_INCLUDE, orderBy: [{ periodEnd: 'desc' }, { applicationNumber: 'desc' }], take }),
      prisma.valuation.count({ where }),
    ])

    let certified = 0
    let paid = 0
    let outstanding = 0
    for (const valuation of valuations) {
      if (valuation.status === 'submitted') outstanding += valuation.netDue
      const current = valuation.certificates.find(c => c.status === 'issued')
      if (current) {
        const summary = paymentSummary(current.amountCertified, current.payments)
        certified += current.amountCertified
        paid += summary.paid
        outstanding += summary.outstanding
      }
    }
    const latestByProject = new Map<string, typeof valuations[number]>()
    for (const valuation of valuations) if (!latestByProject.has(valuation.projectId)) latestByProject.set(valuation.projectId, valuation)
    const latest = [...latestByProject.values()]
    const totals = {
      grossToDate: roundMoney(latest.reduce((sum, v) => sum + v.grossToDate, 0)),
      retention: roundMoney(latest.reduce((sum, v) => sum + v.retentionAmount, 0)),
      netDue: roundMoney(valuations.reduce((sum, v) => sum + v.netDue, 0)),
      outstanding: roundMoney(outstanding),
      certified: roundMoney(certified),
      paid: roundMoney(paid),
    }
    return NextResponse.json({ valuations, total, totals })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch valuations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const role = auth.role
  if (!role || !canManage(role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json()
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, budget: true, progress: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const suggestedGross = project.budget * project.progress / 100
    const grossToDate = body.grossToDate === undefined ? suggestedGross : Number(body.grossToDate)
    if (!Number.isFinite(grossToDate) || grossToDate < 0) return NextResponse.json({ error: 'Gross value must be a non-negative number' }, { status: 400 })
    const retentionPct = clampRetention(body.retentionPct)
    const retentionAmount = roundMoney(grossToDate * retentionPct / 100)
    const previous = await prisma.valuationCertificate.aggregate({
      where: { valuation: { projectId }, status: 'issued' }, _sum: { amountCertified: true },
    })
    const previousCertified = roundMoney(previous._sum.amountCertified || 0)
    const netDue = roundMoney(Math.max(0, grossToDate - retentionAmount - previousCertified))

    let periodEnd = new Date()
    if (body.periodEnd) {
      const parsed = new Date(body.periodEnd)
      if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid period end date' }, { status: 400 })
      periodEnd = parsed
    }

    const rawLinks = Array.isArray(body.variationLinks) ? body.variationLinks.slice(0, 100) : []
    const variationIds: string[] = Array.from(new Set<string>(rawLinks.map((x: { variationId?: unknown }) => String(x?.variationId || '')).filter((id: string) => id.length > 0)))
    const variations = variationIds.length ? await prisma.variation.findMany({
      where: { id: { in: variationIds }, projectId, status: { in: ['submitted', 'approved'] } },
      select: { id: true, costImpact: true },
    }) : []
    if (variationIds.length !== variations.length) return NextResponse.json({ error: 'Invalid variation selection for this project' }, { status: 400 })
    const variationById = new Map(variations.map(v => [v.id, v]))
    const links = variationIds.map(variationId => {
      const raw = rawLinks.find((x: { variationId?: unknown }) => String(x?.variationId || '') === variationId)
      const amountIncluded = raw?.amountIncluded === undefined ? variationById.get(variationId)!.costImpact : Number(raw.amountIncluded)
      if (!Number.isFinite(amountIncluded)) throw new Error('INVALID_VARIATION_AMOUNT')
      return { variationId, amountIncluded: roundMoney(amountIncluded) }
    })

    let valuation = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        valuation = await prisma.$transaction(async tx => {
          const latest = await tx.valuation.findFirst({ where: { projectId }, orderBy: { applicationNumber: 'desc' }, select: { applicationNumber: true } })
          const applicationNumber = (latest?.applicationNumber || 0) + 1
          const created = await tx.valuation.create({ data: {
            projectId, applicationNumber, periodEnd, grossToDate: roundMoney(grossToDate), retentionPct, retentionAmount,
            previousCertified, netDue, status: 'draft', notes: body.notes?.toString().trim() || null,
          } })
          if (links.length) await tx.valuationVariation.createMany({ data: links.map(link => ({ valuationId: created.id, ...link })) })
          return created
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

    const detailed = await prisma.valuation.findUnique({ where: { id: valuation.id }, include: DETAIL_INCLUDE })
    prisma.activity.create({ data: {
      projectId, actorName: actorName(auth.session), actorType: 'human',
      action: 'created valuation VAL-' + String(valuation.applicationNumber).padStart(3, '0'),
      detail: 'Net due £' + valuation.netDue.toFixed(2), iconType: 'receipt',
    } }).catch(() => {})
    auditLog({ action: 'valuation.create', resourceType: 'Valuation', resourceId: valuation.id, metadata: { applicationNumber: valuation.applicationNumber, variationCount: links.length }, ...requestMeta(req) })
    return NextResponse.json(detailed || valuation, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_VARIATION_AMOUNT') return NextResponse.json({ error: 'Variation included amount must be a number' }, { status: 400 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to create valuation' }, { status: 500 })
  }
}

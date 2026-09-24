import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import costLedger from '@/lib/cost-ledger'
import { postSourceCost } from '@/lib/cost-ledger-server'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const ALLOWED_STATUS = new Set(['received', 'approved', 'paid', 'disputed'])
const { subInvoicePosting } = costLedger

function cisRate(cisStatus: string): number {
  if (cisStatus === 'gross') return 0
  if (cisStatus === '30') return 0.30
  return 0.20
}

function compute(netAmount: number, vatRate: number, cisRatePct: number) {
  const vatAmount = netAmount * (vatRate / 100)
  const cisAmount = netAmount * cisRatePct
  const grossAmount = netAmount + vatAmount
  const payableAmount = grossAmount - cisAmount
  return { vatAmount, cisAmount, grossAmount, payableAmount }
}

function financialGuard(role: string | null) {
  return !!role && canManage(role)
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!financialGuard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const subcontractorId = searchParams.get('subcontractorId')
    const projectId = searchParams.get('projectId')
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const where = {
      ...(status && ALLOWED_STATUS.has(status) && { status }),
      ...(subcontractorId && { subcontractorId }),
      ...(projectId && { projectId }),
    }
    const [invoices, pendingCount, totals] = await Promise.all([
      prisma.subInvoice.findMany({
        where,
        include: {
          subcontractor: { select: { id: true, name: true, trade: true, cisStatus: true } },
          project: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, number: true, costCodeId: true } },
          costCode: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ status: 'asc' }, { invoiceDate: 'desc' }],
        take,
      }),
      prisma.subInvoice.count({ where: { ...where, status: { in: ['received', 'approved'] } } }),
      prisma.subInvoice.aggregate({
        where: { ...where, status: { in: ['received', 'approved'] } },
        _sum: { payableAmount: true, cisAmount: true },
      }),
    ])
    return NextResponse.json({ invoices, pendingCount, pendingPayable: totals._sum.payableAmount || 0, pendingCisHeld: totals._sum.cisAmount || 0 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch sub-invoices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId = auth.orgId
  if (!financialGuard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const body = await req.json()
    const number = String(body.number || '').trim()
    if (!number) return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    const subcontractorId = String(body.subcontractorId || '').trim()
    if (!subcontractorId) return NextResponse.json({ error: 'Subcontractor is required' }, { status: 400 })
    const sub = await prisma.subcontractor.findUnique({ where: { id: subcontractorId }, select: { id: true, name: true, cisStatus: true } })
    if (!sub) return NextResponse.json({ error: 'Subcontractor not found' }, { status: 400 })

    let projectId = body.projectId ? String(body.projectId) : null
    const purchaseOrderId = body.purchaseOrderId ? String(body.purchaseOrderId) : null
    let matchedPo: { id: string; projectId: string | null; costCodeId: string | null } | null = null
    if (purchaseOrderId) {
      matchedPo = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, select: { id: true, projectId: true, costCodeId: true } })
      if (!matchedPo) return NextResponse.json({ error: 'Purchase order not found' }, { status: 400 })
      if (projectId && matchedPo.projectId && projectId !== matchedPo.projectId) return NextResponse.json({ error: 'Purchase order belongs to a different project' }, { status: 409 })
      projectId = projectId || matchedPo.projectId
    }
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })
    }

    let costCodeId = body.costCodeId ? String(body.costCodeId) : matchedPo?.costCodeId || null
    if (costCodeId) {
      const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
      if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
      costCodeId = code.id
    }

    if (!body.invoiceDate) return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 })
    const invoiceDate = new Date(body.invoiceDate)
    if (Number.isNaN(invoiceDate.getTime())) return NextResponse.json({ error: 'Invalid invoice date' }, { status: 400 })
    const netAmount = Number(body.netAmount)
    if (!Number.isFinite(netAmount) || netAmount < 0) return NextResponse.json({ error: 'Net amount must be ≥ 0' }, { status: 400 })
    const vatRate = body.vatRate === undefined ? 20 : Number(body.vatRate)
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return NextResponse.json({ error: 'VAT 0-100' }, { status: 400 })
    const { vatAmount, cisAmount, grossAmount, payableAmount } = compute(netAmount, vatRate, cisRate(sub.cisStatus))
    const status = ALLOWED_STATUS.has(body.status) ? String(body.status) : 'received'
    if (['approved', 'paid'].includes(status) && !projectId) return NextResponse.json({ error: 'Assign the invoice to a project before approval' }, { status: 409 })

    const invoice = await prisma.$transaction(async tx => {
      const created = await tx.subInvoice.create({
        data: {
          number, subcontractorId, projectId, purchaseOrderId, costCodeId, invoiceDate,
          description: body.description?.toString().trim() || null,
          netAmount, vatAmount, cisAmount, grossAmount, payableAmount, status,
          paidAt: status === 'paid' ? new Date() : null,
          notes: body.notes?.toString().trim() || null,
        },
        include: {
          subcontractor: { select: { id: true, name: true, trade: true, cisStatus: true } },
          project: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, number: true, costCodeId: true } },
          costCode: { select: { id: true, code: true, name: true } },
        },
      })
      if (['approved', 'paid'].includes(status) && projectId) {
        const amounts = subInvoicePosting(created as unknown as Record<string, unknown>)
        await postSourceCost(tx, {
          organizationId: orgId, projectId, sourceType: 'sub_invoice', sourceId: created.id,
          sourceReference: created.number, description: `Subcontract invoice ${created.number} · ${created.subcontractor.name}`,
          netAmount: amounts.netAmount, vatAmount: amounts.vatAmount, grossAmount: amounts.grossAmount,
          costCodeId: created.costCodeId, occurredAt: created.invoiceDate, notes: created.notes,
        })
      }
      return created
    })
    auditLog({ action: 'subInvoice.create', resourceType: 'SubInvoice', resourceId: invoice.id, metadata: { projectId, status, purchaseOrderId, costCodeId }, ...requestMeta(req) })
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'Duplicate invoice number for this subcontractor' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to create sub-invoice' }, { status: 500 })
  }
}

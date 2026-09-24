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
const { costControlSummary, money } = costLedger

function guard(auth: { role: string | null }) {
  return auth.role && canManage(auth.role)
    ? null
    : NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = guard(auth)
  if (forbidden) return forbidden
  try {
    const { id } = await params
    const [project, entries, purchaseOrders, subInvoices, codes, receipts] = await Promise.all([
      prisma.project.findUnique({ where: { id }, select: { id: true, name: true, budget: true, spent: true } }),
      prisma.projectCostEntry.findMany({
        where: { projectId: id },
        include: { costCode: { select: { id: true, code: true, name: true } } },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      prisma.purchaseOrder.findMany({
        where: { projectId: id },
        include: { costCode: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      prisma.subInvoice.findMany({
        where: { projectId: id },
        include: { subcontractor: { select: { id: true, name: true } }, purchaseOrder: { select: { id: true, number: true } } },
        orderBy: { invoiceDate: 'desc' },
        take: 250,
      }),
      prisma.costCode.findMany({ where: { archivedAt: null }, orderBy: { code: 'asc' }, take: 500 }),
      prisma.expenseReceipt.findMany({
        where: { projectId: id, status: { in: ['approved', 'reconciled'] } },
        select: { id: true, vendor: true, totalAmount: true, subtotal: true, vatAmount: true, receiptDate: true, status: true },
        orderBy: { receiptDate: 'desc' },
        take: 250,
      }),
    ])
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const summary = costControlSummary({ entries, purchaseOrders, subInvoices })
    const postedSourceIds = new Set(entries.filter(e => e.status === 'posted' && e.sourceId).map(e => `${e.sourceType}:${e.sourceId}`))
    const exceptions = {
      approvedReceiptsNotPosted: receipts.filter(r => r.status === 'approved' && !postedSourceIds.has(`receipt:${r.id}`)),
      approvedSubInvoicesNotPosted: subInvoices.filter(si => ['approved', 'paid'].includes(si.status) && !postedSourceIds.has(`sub_invoice:${si.id}`)),
      uncodedEntries: entries.filter(e => e.status === 'posted' && !e.costCodeId),
      overMatchedPurchaseOrders: purchaseOrders.filter(po => {
        const matched = subInvoices.filter(si => si.purchaseOrderId === po.id && ['approved', 'paid'].includes(si.status)).reduce((sum, si) => sum + si.netAmount, 0)
        return money(matched) > money(po.subtotal)
      }).map(po => po.id),
    }
    return NextResponse.json({ project, summary, entries, purchaseOrders, subInvoices, codes, exceptions })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load project cost control' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId = auth.orgId
  const forbidden = guard(auth)
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const { id } = await params
    const body = await req.json()
    const project = await prisma.project.findUnique({ where: { id }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const description = String(body.description || '').trim().slice(0, 500)
    if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    const netAmount = Number(body.netAmount)
    const vatAmount = body.vatAmount === undefined ? 0 : Number(body.vatAmount)
    if (!Number.isFinite(netAmount) || netAmount < 0) return NextResponse.json({ error: 'Net amount must be non-negative' }, { status: 400 })
    if (!Number.isFinite(vatAmount) || vatAmount < 0) return NextResponse.json({ error: 'VAT amount must be non-negative' }, { status: 400 })
    const costCodeId = body.costCodeId ? String(body.costCodeId) : null
    if (costCodeId) {
      const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
      if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
    }
    let occurredAt = new Date()
    if (body.occurredAt) {
      occurredAt = new Date(body.occurredAt)
      if (Number.isNaN(occurredAt.getTime())) return NextResponse.json({ error: 'Invalid cost date' }, { status: 400 })
    }
    const entry = await prisma.$transaction(tx => postSourceCost(tx, {
      organizationId: orgId,
      projectId: id,
      sourceType: 'manual',
      sourceReference: String(body.reference || '').trim().slice(0, 160) || null,
      description,
      netAmount: money(netAmount),
      vatAmount: money(vatAmount),
      grossAmount: money(netAmount + vatAmount),
      costCodeId,
      occurredAt,
      notes: String(body.notes || '').trim().slice(0, 1000) || null,
    }))
    auditLog({ action: 'projectCost.create', resourceType: 'ProjectCostEntry', resourceId: entry.id, metadata: { projectId: id, netAmount: entry.netAmount }, ...requestMeta(req) })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to post project cost' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canManage, canWrite } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'
import { auditLog, requestMeta } from '@/lib/audit'
import costLedger from '@/lib/cost-ledger'
import { postSourceCost } from '@/lib/cost-ledger-server'

export const dynamic = 'force-dynamic'
const STATUSES = new Set(['pending', 'extracted', 'needs_review', 'approved', 'reconciled'])
const CATEGORIES = new Set(['materials', 'plant', 'tools', 'fuel', 'travel', 'accommodation', 'subcontract', 'office', 'other'])
const { receiptPosting } = costLedger

function numeric(value: unknown, nullable = true) {
  if (value === '' || value === null || value === undefined) return nullable ? null : NaN
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round((n + Number.EPSILON) * 100) / 100 : NaN
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await params
    const receipt = await prisma.expenseReceipt.findUnique({
      where: { id },
      include: { project: true, document: true },
    })
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    return NextResponse.json({ receipt })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canWrite(role)) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const { id } = await params
    const existing = await prisma.expenseReceipt.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    const body = await req.json()
    const data: Prisma.ExpenseReceiptUpdateInput = {}
    if (existing.status === 'reconciled') {
      const lockedFields = ['vendor', 'receiptDate', 'subtotal', 'vatAmount', 'totalAmount', 'category', 'items', 'costCodeId']
      if (lockedFields.some(field => body[field] !== undefined) || (body.status !== undefined && body.status !== 'reconciled')) {
        return NextResponse.json({ error: 'Reconciled receipt financial fields are locked; reclassify the ledger cost instead' }, { status: 409 })
      }
    }

    if (body.vendor !== undefined) data.vendor = String(body.vendor || '').trim().slice(0, 160) || null
    if (body.costCodeId !== undefined) {
      const costCodeId = body.costCodeId ? String(body.costCodeId) : null
      if (costCodeId) {
        const code = await prisma.costCode.findUnique({ where: { id: costCodeId }, select: { id: true, archivedAt: true } })
        if (!code || code.archivedAt) return NextResponse.json({ error: 'Cost code not found or archived' }, { status: 400 })
      }
      data.costCode = costCodeId ? { connect: { id: costCodeId } } : { disconnect: true }
    }
    for (const field of ['subtotal', 'vatAmount', 'totalAmount'] as const) {
      if (body[field] !== undefined) {
        const n = numeric(body[field])
        if (Number.isNaN(n)) return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 })
        data[field] = n
      }
    }
    if (body.receiptDate !== undefined) {
      if (!body.receiptDate) data.receiptDate = null
      else {
        const d = new Date(String(body.receiptDate) + (String(body.receiptDate).length === 10 ? 'T00:00:00Z' : ''))
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid receipt date' }, { status: 400 })
        data.receiptDate = d
      }
    }
    if (body.category !== undefined) {
      const category = String(body.category || '').trim().toLowerCase()
      if (category && !CATEGORIES.has(category)) return NextResponse.json({ error: 'Invalid receipt category' }, { status: 400 })
      data.category = category || null
    }
    if (body.notes !== undefined) data.notes = String(body.notes || '').trim().slice(0, 1000) || null
    if (body.items !== undefined) {
      if (!Array.isArray(body.items)) return NextResponse.json({ error: 'items must be an array' }, { status: 400 })
      data.items = body.items.slice(0, 100) as Prisma.InputJsonValue
    }
    if (body.status !== undefined) {
      const status = String(body.status)
      if (!STATUSES.has(status)) return NextResponse.json({ error: 'Invalid receipt status' }, { status: 400 })
      if ((status === 'approved' || status === 'reconciled') && role && !canManage(role)) {
        return NextResponse.json({ error: 'Admin permission required to approve or reconcile receipts' }, { status: 403 })
      }
      if (existing.status === 'reconciled' && status !== 'reconciled') {
        return NextResponse.json({ error: 'Reconciled receipts are locked' }, { status: 409 })
      }
      if (status === 'reconciled' && existing.status !== 'approved' && existing.status !== 'reconciled') {
        return NextResponse.json({ error: 'Approve the receipt before reconciliation' }, { status: 409 })
      }
      data.status = status
    }

    const organizationId = getCurrentOrg()?.organizationId
    if (!organizationId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
    const transitioningToReconciled = body.status === 'reconciled' && existing.status !== 'reconciled'
    const receipt = await prisma.$transaction(async tx => {
      const updated = await tx.expenseReceipt.update({
        where: { id },
        data,
        include: { project: { select: { id: true, name: true } }, document: true },
      })
      if (transitioningToReconciled) {
        if (!updated.projectId) throw new Error('RECEIPT_PROJECT_REQUIRED')
        if (updated.totalAmount == null) throw new Error('RECEIPT_AMOUNT_REQUIRED')
        const amounts = receiptPosting(updated as unknown as Record<string, unknown>)
        await postSourceCost(tx, {
          organizationId,
          projectId: updated.projectId,
          sourceType: 'receipt',
          sourceId: updated.id,
          sourceReference: updated.vendor || updated.document?.name || null,
          description: `Receipt${updated.vendor ? ` · ${updated.vendor}` : ''}`,
          netAmount: amounts.netAmount,
          vatAmount: amounts.vatAmount,
          grossAmount: amounts.grossAmount,
          costCodeId: updated.costCodeId,
          occurredAt: updated.receiptDate || updated.capturedAt || updated.createdAt,
          notes: updated.notes,
        })
      }
      return updated
    })
    auditLog({ action: transitioningToReconciled ? 'receipt.reconcile' : 'receipt.update', resourceType: 'ExpenseReceipt', resourceId: id, metadata: { status: receipt.status, projectId: receipt.projectId }, ...requestMeta(req) })
    return NextResponse.json(receipt)
  } catch (error) {
    if (error instanceof Error && error.message === 'RECEIPT_PROJECT_REQUIRED') return NextResponse.json({ error: 'Assign the receipt to a project before reconciliation' }, { status: 409 })
    if (error instanceof Error && error.message === 'RECEIPT_AMOUNT_REQUIRED') return NextResponse.json({ error: 'Receipt total is required before reconciliation' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canManage(role)) return NextResponse.json({ error: 'Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const { id } = await params
    const existing = await prisma.expenseReceipt.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    if (existing.status === 'approved' || existing.status === 'reconciled') {
      return NextResponse.json({ error: 'Approved/reconciled receipts are retained for audit' }, { status: 409 })
    }
    await prisma.expenseReceipt.delete({ where: { id } })
    auditLog({ action: 'receipt.delete', resourceType: 'ExpenseReceipt', resourceId: id, ...requestMeta(req) })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import bankMath from '@/lib/bank-reconciliation'
import { getTarget, syncBankStatus, syncTargetPaymentState, targetAllocated, type BankTargetType } from '@/lib/bank-reconciliation-server'

export const dynamic = 'force-dynamic'
const { allocationSummary, targetAllowed, money } = bankMath
const TYPES = new Set<BankTargetType>(['client_invoice', 'valuation_certificate', 'sub_invoice'])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId: string = auth.orgId
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  try {
    const { id } = await params
    const bank = await prisma.bankTransaction.findUnique({ where: { id }, include: { allocations: { orderBy: { createdAt: 'asc' } } } })
    if (!bank) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    const allocations = await Promise.all(bank.allocations.map(async allocation => {
      try {
        const target = await getTarget(prisma as any, orgId, allocation.targetType as BankTargetType, allocation.targetId)
        return { ...allocation, targetLabel: target.label, projectId: target.projectId }
      } catch { return { ...allocation, targetLabel: allocation.targetId, projectId: null } }
    }))
    return NextResponse.json({ bank, allocations, summary: allocationSummary(bank.amount, bank.allocations) })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId: string = auth.orgId
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId); if (limited) return limited
  try {
    const { id } = await params
    const bank = await prisma.bankTransaction.findUnique({ where: { id }, include: { allocations: true } })
    if (!bank) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    if (bank.status === 'ignored') return NextResponse.json({ error: 'Ignored transactions cannot be allocated' }, { status: 409 })
    const body = await req.json()
    const targetType = String(body.targetType || '') as BankTargetType
    const targetId = String(body.targetId || '').trim()
    if (!TYPES.has(targetType) || !targetId) return NextResponse.json({ error: 'Valid targetType and targetId are required' }, { status: 400 })
    if (!targetAllowed(bank.amount, targetType)) return NextResponse.json({ error: Number(bank.amount) >= 0 ? 'Bank credits can only match client invoices or valuation certificates' : 'Bank debits can only match approved subcontract invoices' }, { status: 409 })
    const current = allocationSummary(bank.amount, bank.allocations)
    if (current.remaining <= 0.009) return NextResponse.json({ error: 'Bank transaction is already fully allocated' }, { status: 409 })

    const result = await prisma.$transaction(async tx => {
      const target = await getTarget(tx, orgId, targetType, targetId)
      const existingTargetAllocated = await targetAllocated(tx, orgId, targetType, targetId)
      const targetOutstanding = money(Math.max(0, target.amount - existingTargetAllocated))
      if (targetOutstanding <= 0.009) throw new Error('TARGET_SETTLED')
      const requested = body.amount === undefined ? Math.min(current.remaining, targetOutstanding) : Number(body.amount)
      if (!Number.isFinite(requested) || requested <= 0) throw new Error('INVALID_AMOUNT')
      const amount = money(requested)
      if (amount > current.remaining + 0.009) throw new Error('BANK_OVERALLOCATED')
      if (amount > targetOutstanding + 0.009) throw new Error('TARGET_OVERALLOCATED')
      const allocation = await tx.bankAllocation.create({ data: {
        bankTransactionId: bank.id,
        targetType,
        targetId,
        amount,
        notes: String(body.notes || '').trim().slice(0, 500) || null,
      } })
      if (targetType === 'valuation_certificate') {
        await tx.valuationPayment.create({ data: {
          certificateId: targetId,
          amount,
          paidAt: bank.occurredAt || new Date(),
          reference: bank.reference || bank.description || null,
          method: 'bank',
          notes: `Bank reconciliation · ${bank.accountName || bank.source}`,
          bankAllocationId: allocation.id,
        } })
      }
      await syncTargetPaymentState(tx, orgId, targetType, targetId)
      const synced = await syncBankStatus(tx, bank.id, orgId)
      return { allocation, target, ...synced }
    })
    auditLog({ action: 'bank.allocate', resourceType: 'BankAllocation', resourceId: result.allocation.id, metadata: { bankTransactionId: id, targetType, targetId, amount: result.allocation.amount }, ...requestMeta(req) })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const map: Record<string, [string, number]> = {
      TARGET_NOT_FOUND: ['Reconciliation target not found', 404], SUB_INVOICE_NOT_APPROVED: ['Subcontract invoice must be approved before bank matching', 409],
      TARGET_SETTLED: ['Target is already fully reconciled', 409], INVALID_AMOUNT: ['Allocation amount must be positive', 400],
      BANK_OVERALLOCATED: ['Allocation exceeds remaining bank transaction value', 409], TARGET_OVERALLOCATED: ['Allocation exceeds target outstanding value', 409],
    }
    if (map[message]) return NextResponse.json({ error: map[message][0] }, { status: map[message][1] })
    if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'This bank transaction is already matched to that target' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to allocate bank transaction' }, { status: 500 })
  }
}

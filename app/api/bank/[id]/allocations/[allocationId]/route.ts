import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { auditLog, requestMeta } from '@/lib/audit'
import { syncBankStatus, syncTargetPaymentState, type BankTargetType } from '@/lib/bank-reconciliation-server'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; allocationId: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const orgId: string = auth.orgId
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId); if (limited) return limited
  try {
    const { id, allocationId } = await params
    const allocation = await prisma.bankAllocation.findFirst({ where: { id: allocationId, bankTransactionId: id } })
    if (!allocation) return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    await prisma.$transaction(async tx => {
      await tx.bankAllocation.delete({ where: { id: allocation.id } })
      await syncTargetPaymentState(tx, orgId, allocation.targetType as BankTargetType, allocation.targetId)
      await syncBankStatus(tx, id, orgId)
    })
    auditLog({ action: 'bank.allocation.delete', resourceType: 'BankAllocation', resourceId: allocationId, metadata: { bankTransactionId: id, targetType: allocation.targetType, targetId: allocation.targetId }, ...requestMeta(req) })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to remove bank allocation' }, { status: 500 })
  }
}

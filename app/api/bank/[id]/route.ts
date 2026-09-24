import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'
import bankMath from '@/lib/bank-reconciliation'

export const dynamic = 'force-dynamic'
const { allocationSummary } = bankMath

function guard(role: string | null) { return !!role && canManage(role) }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!guard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  try {
    const { id } = await params
    const item = await prisma.bankTransaction.findUnique({ where: { id }, include: { allocations: { orderBy: { createdAt: 'asc' } } } })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item: { ...item, reconciliation: allocationSummary(item.amount, item.allocations) } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch bank transaction' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!guard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId); if (limited) return limited
  const { id } = await params
  try {
    const existing = await prisma.bankTransaction.findUnique({ where: { id }, include: { allocations: { select: { id: true } } } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (typeof body.accountName === 'string') data.accountName = body.accountName.trim().slice(0, 160) || null
    if (typeof body.description === 'string') data.description = body.description.trim().slice(0, 500) || null
    if (typeof body.reference === 'string') data.reference = body.reference.trim().slice(0, 160) || null
    if (typeof body.currency === 'string') data.currency = body.currency.trim().toUpperCase().slice(0, 3) || 'GBP'
    if (body.occurredAt !== undefined) {
      const date = new Date(body.occurredAt)
      if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid transaction date' }, { status: 400 })
      data.occurredAt = date
    }
    if (body.amount !== undefined) {
      if (existing.allocations.length) return NextResponse.json({ error: 'Remove allocations before changing the bank amount' }, { status: 409 })
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: 'A non-zero signed amount is required' }, { status: 400 })
      data.amount = amount
    }
    if (body.status === 'ignored') {
      if (existing.allocations.length) return NextResponse.json({ error: 'Remove allocations before ignoring this transaction' }, { status: 409 })
      data.status = 'ignored'; data.reconciled = false
    } else if (body.status === 'unmatched' && existing.status === 'ignored') {
      data.status = 'unmatched'; data.reconciled = false
    }
    const item = await prisma.bankTransaction.update({ where: { id }, data, include: { allocations: true } })
    auditLog({ action: 'bank.update', resourceType: 'BankTransaction', resourceId: id, metadata: { status: item.status }, ...requestMeta(req) })
    return NextResponse.json({ item: { ...item, reconciliation: allocationSummary(item.amount, item.allocations) } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update bank transaction' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!guard(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId); if (limited) return limited
  const { id } = await params
  try {
    const existing = await prisma.bankTransaction.findUnique({ where: { id }, include: { allocations: { select: { id: true } } } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.allocations.length) return NextResponse.json({ error: 'Remove reconciliations before deleting the bank transaction' }, { status: 409 })
    await prisma.bankTransaction.delete({ where: { id } })
    auditLog({ action: 'bank.delete', resourceType: 'BankTransaction', resourceId: id, ...requestMeta(req) })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete bank transaction' }, { status: 500 })
  }
}

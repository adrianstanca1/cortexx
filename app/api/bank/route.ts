import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import bankMath from '@/lib/bank-reconciliation'

export const dynamic = 'force-dynamic'
const MAX_TAKE = 200
const { allocationSummary } = bankMath

function guard(role: string | null) {
  return role && canManage(role) ? null : NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const forbidden = guard(auth.role); if (forbidden) return forbidden
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const status = sp.get('status')
    const where = status && ['unmatched', 'partial', 'reconciled', 'ignored'].includes(status) ? { status } : {}
    const [items, total] = await Promise.all([
      prisma.bankTransaction.findMany({ where, include: { allocations: { orderBy: { createdAt: 'asc' } } }, orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }], take, skip }),
      prisma.bankTransaction.count({ where }),
    ])
    return NextResponse.json({
      items: items.map(item => ({ ...item, reconciliation: allocationSummary(item.amount, item.allocations) })),
      total,
      hasMore: skip + items.length < total,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch bank transactions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const forbidden = guard(auth.role); if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', auth.userId); if (limited) return limited
  try {
    const body = await req.json().catch(() => ({}))
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount === 0) return NextResponse.json({ error: 'A non-zero signed amount is required' }, { status: 400 })
    let occurredAt = new Date()
    if (body.occurredAt) {
      occurredAt = new Date(body.occurredAt)
      if (Number.isNaN(occurredAt.getTime())) return NextResponse.json({ error: 'Invalid transaction date' }, { status: 400 })
    }
    const item = await prisma.bankTransaction.create({ data: {
      source: 'manual',
      accountName: typeof body.accountName === 'string' ? body.accountName.trim().slice(0, 160) || null : null,
      occurredAt,
      amount,
      currency: typeof body.currency === 'string' ? body.currency.trim().toUpperCase().slice(0, 3) || 'GBP' : 'GBP',
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 500) || null : null,
      reference: typeof body.reference === 'string' ? body.reference.trim().slice(0, 160) || null : null,
    } })
    return NextResponse.json({ item: { ...item, reconciliation: allocationSummary(item.amount, []) } }, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to create bank transaction' }, { status: 500 })
  }
}

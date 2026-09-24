import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function stableFallback(row: Record<string, unknown>) {
  const parts = [row.connectionId, row.accountId, row.occurredAt || row.date, row.amount, row.description || row.desc, row.reference || row.raw]
  return parts.map(v => String(v ?? '')).join('|').slice(0, 500)
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId); if (limited) return limited
  try {
    const body = await req.json().catch(() => ({}))
    const source = typeof body.source === 'string' ? body.source.trim().toLowerCase().slice(0, 40) || 'import' : 'import'
    const rows = Array.isArray(body.transactions) ? body.transactions.slice(0, 1000) : []
    if (!rows.length) return NextResponse.json({ error: 'transactions array is required' }, { status: 400 })
    let created = 0, updated = 0, skipped = 0
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') { skipped++; continue }
      const row = raw as Record<string, unknown>
      const amount = Number(row.amount)
      const occurredAt = new Date(String(row.occurredAt || row.date || ''))
      if (!Number.isFinite(amount) || amount === 0 || Number.isNaN(occurredAt.getTime())) { skipped++; continue }
      const externalId = String(row.externalId || row.transactionId || stableFallback(row)).trim().slice(0, 500)
      if (!externalId) { skipped++; continue }
      const existing = await prisma.bankTransaction.findFirst({ where: { source, externalId } })
      const data = {
        source,
        externalId,
        connectionId: String(row.connectionId || '').trim().slice(0, 160) || null,
        accountName: String(row.accountName || row.accountId || '').trim().slice(0, 160) || null,
        occurredAt,
        amount,
        currency: String(row.currency || 'GBP').trim().toUpperCase().slice(0, 3) || 'GBP',
        description: String(row.description || row.desc || '').trim().slice(0, 500) || null,
        reference: String(row.reference || row.raw || '').trim().slice(0, 160) || null,
      }
      if (existing) {
        if (existing.status === 'unmatched') await prisma.bankTransaction.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await prisma.bankTransaction.create({ data })
        created++
      }
    }
    return NextResponse.json({ created, updated, skipped, total: rows.length })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to import bank transactions' }, { status: 500 })
  }
}

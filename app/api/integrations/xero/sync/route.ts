import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import xeroAdapter from '@/lib/xero-adapter'
import { XeroApiError, xeroApiRequest } from '@/lib/xero-server'
import { reportError } from '@/lib/errors'
import { upsertXeroBankTransactions } from '@/lib/xero-bank-import'

export const dynamic = 'force-dynamic'
const { bankTransactionsFromResponse } = xeroAdapter
const DEFAULT_MAX_PAGES = 5
const HARD_MAX_PAGES = 10

function settingsOf(connection: { settings: unknown }) {
  return connection.settings && typeof connection.settings === 'object' && !Array.isArray(connection.settings)
    ? connection.settings as Record<string, unknown> : {}
}


export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
  if (!connection || connection.status === 'disconnected' || !connection.externalTenantId) {
    return NextResponse.json({ error: 'Xero is not connected' }, { status: 409 })
  }

  const syncStartedAt = new Date()
  const configuredPages = Math.trunc(Number(settingsOf(connection).maxPages || DEFAULT_MAX_PAGES))
  const maxPages = Math.max(1, Math.min(HARD_MAX_PAGES, Number.isFinite(configuredPages) ? configuredPages : DEFAULT_MAX_PAGES))
  let created = 0
  let updated = 0
  let unchanged = 0
  let ignored = 0
  let pages = 0
  let bounded = false

  try {
    const headers: Record<string, string> = {}
    if (connection.lastSyncAt) {
      // Small overlap makes incremental sync resilient to clock skew and near-boundary updates.
      headers['If-Modified-Since'] = new Date(connection.lastSyncAt.getTime() - 5 * 60 * 1000).toUTCString()
    }

    for (let page = 1; page <= maxPages; page += 1) {
      const body = await xeroApiRequest(connection, `/BankTransactions?page=${page}`, { headers })
      const raw = Array.isArray(body.BankTransactions) ? body.BankTransactions : []
      const rows = bankTransactionsFromResponse(body)
      pages += 1
      ignored += Math.max(0, raw.length - rows.length)
      const counts = await upsertXeroBankTransactions(connection.id, rows)
      created += counts.created
      updated += counts.updated
      unchanged += counts.unchanged
      if (raw.length < 100) break
      if (page === maxPages) bounded = true
    }

    await prisma.accountingConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: syncStartedAt, lastSyncStatus: 'ok', lastSyncError: null, status: 'connected' },
    })
    auditLog({ action: 'accounting.xero.bank_import', resourceType: 'AccountingConnection', resourceId: connection.id, metadata: { created, updated, unchanged, ignored, pages }, ...requestMeta(req) })
    return NextResponse.json({ status: 'ok', created, updated, unchanged, ignored, pages, bounded })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1800) : 'Xero bank import failed'
    await prisma.accountingConnection.update({ where: { id: connection.id }, data: { lastSyncAt: syncStartedAt, lastSyncStatus: error instanceof XeroApiError && error.status === 429 ? 'rate_limited' : 'error', lastSyncError: message } }).catch(() => undefined)
    reportError(error)
    if (error instanceof XeroApiError && error.status === 429) {
      const headers = error.retryAfter != null ? { 'Retry-After': String(error.retryAfter) } : undefined
      return NextResponse.json({ error: 'Xero rate limit reached', retryAfter: error.retryAfter }, { status: 429, headers })
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

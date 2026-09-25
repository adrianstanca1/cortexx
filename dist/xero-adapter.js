'use strict'

const XERO_SCOPES = Object.freeze([
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.banktransactions.read',
  'accounting.settings.read',
])

function buildAuthorizeUrl({ clientId, redirectUri, state, scopes = XERO_SCOPES }) {
  const url = new URL('https://login.xero.com/identity/connect/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  return url.toString()
}

function decodeJwtPayload(token) {
  const part = String(token || '').split('.')[1]
  if (!part) return {}
  try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) } catch { return {} }
}

function selectAuthorizedConnection(connections, accessToken, existingTenantId) {
  const rows = Array.isArray(connections) ? connections : []
  if (existingTenantId) {
    const existing = rows.find(row => row && row.tenantId === existingTenantId)
    if (existing) return existing
  }
  const eventId = decodeJwtPayload(accessToken).authentication_event_id
  if (eventId) {
    const current = rows.filter(row => row && row.authEventId === eventId)
    if (current.length === 1) return current[0]
    if (current.length > 1) return [...current].sort((a, b) => String(b.updatedDateUtc || '').localeCompare(String(a.updatedDateUtc || '')))[0]
  }
  return rows.length === 1 ? rows[0] : null
}

function parseXeroDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const raw = String(value || '').trim()
  const legacy = raw.match(/^\/Date\((-?\d+)/)
  if (legacy) {
    const date = new Date(Number(legacy[1]))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function xeroBankAmount(transaction) {
  const total = Math.abs(Number(transaction?.Total || 0))
  if (!Number.isFinite(total)) return null
  const type = String(transaction?.Type || '').toUpperCase()
  if (type.startsWith('SPEND')) return -total
  if (type.startsWith('RECEIVE')) return total
  const raw = Number(transaction?.Total)
  return Number.isFinite(raw) ? raw : null
}

function normalizeXeroBankTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object') return null
  const externalId = String(transaction.BankTransactionID || '').trim()
  const occurredAt = parseXeroDate(transaction.DateString || transaction.Date)
  const amount = xeroBankAmount(transaction)
  if (!externalId || !occurredAt || amount == null) return null
  const lineItems = Array.isArray(transaction.LineItems) ? transaction.LineItems : []
  const lineDescription = lineItems.map(item => String(item?.Description || '').trim()).filter(Boolean).join(' · ')
  const contact = String(transaction.Contact?.Name || '').trim()
  const type = String(transaction.Type || '').trim()
  const description = [contact, lineDescription || type].filter(Boolean).join(' · ').slice(0, 1000) || type || 'Xero bank transaction'
  return {
    externalId,
    occurredAt,
    amount,
    currency: String(transaction.CurrencyCode || 'GBP').trim().slice(0, 8) || 'GBP',
    description,
    reference: String(transaction.Reference || externalId).trim().slice(0, 500),
    accountName: String(transaction.BankAccount?.Name || '').trim().slice(0, 300) || null,
  }
}

function bankTransactionsFromResponse(body) {
  const rows = body && Array.isArray(body.BankTransactions) ? body.BankTransactions : []
  return rows.map(normalizeXeroBankTransaction).filter(Boolean)
}

module.exports = {
  XERO_SCOPES,
  buildAuthorizeUrl,
  decodeJwtPayload,
  selectAuthorizedConnection,
  parseXeroDate,
  xeroBankAmount,
  normalizeXeroBankTransaction,
  bankTransactionsFromResponse,
}

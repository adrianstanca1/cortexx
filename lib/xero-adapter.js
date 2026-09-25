'use strict'

const crypto = require('crypto')

const XERO_SCOPES = Object.freeze([
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.invoices',
  'accounting.payments',
  'accounting.contacts',
  'accounting.settings',
])

function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
  return d.toISOString().slice(0, 10)
}

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
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return {}
  }
}

function selectAuthorizedConnection(connections, accessToken, existingTenantId) {
  const rows = Array.isArray(connections) ? connections : []
  if (existingTenantId) {
    const existing = rows.find(row => row && row.tenantId === existingTenantId)
    if (existing) return existing
  }
  const payload = decodeJwtPayload(accessToken)
  const eventId = payload.authentication_event_id
  if (eventId) {
    const current = rows.filter(row => row && row.authEventId === eventId)
    if (current.length === 1) return current[0]
    if (current.length > 1) {
      return [...current].sort((a, b) => String(b.updatedDateUtc || '').localeCompare(String(a.updatedDateUtc || '')))[0]
    }
  }
  if (rows.length === 1) return rows[0]
  return null
}

function requiredSetting(settings, key) {
  const value = settings && typeof settings[key] === 'string' ? settings[key].trim() : ''
  if (!value) throw new Error(`Xero setting ${key} is required before sync`)
  return value
}

function salesInvoicePayload(invoice, settings = {}) {
  const accountCode = requiredSetting(settings, 'salesAccountCode')
  const taxType = requiredSetting(settings, 'salesTaxType')
  return {
    Type: 'ACCREC',
    Contact: { Name: String(invoice.clientName || '').trim() },
    Date: formatDate(invoice.issuedDate),
    DueDate: formatDate(invoice.dueDate),
    InvoiceNumber: String(invoice.number),
    Reference: invoice.project && invoice.project.name ? `Cortexx · ${invoice.project.name}` : `Cortexx · ${invoice.id}`,
    LineAmountTypes: 'Inclusive',
    LineItems: [{
      Description: String(invoice.notes || invoice.project?.name || 'Construction services').slice(0, 4000),
      Quantity: 1,
      UnitAmount: Number(invoice.amount),
      AccountCode: accountCode,
      TaxType: taxType,
    }],
    Status: 'DRAFT',
  }
}

function purchaseBillPayload(invoice, settings = {}) {
  const accountCode = requiredSetting(settings, 'purchaseAccountCode')
  const taxType = requiredSetting(settings, 'purchaseTaxType')
  const cisNote = Number(invoice.cisAmount || 0) > 0 ? ` · CIS held in Cortexx £${Number(invoice.cisAmount).toFixed(2)}; review before authorising in Xero` : ''
  return {
    Type: 'ACCPAY',
    Contact: { Name: String(invoice.subcontractor?.name || '').trim() },
    Date: formatDate(invoice.invoiceDate),
    InvoiceNumber: String(invoice.number),
    Reference: invoice.project?.name ? `Cortexx · ${invoice.project.name}` : `Cortexx · ${invoice.id}`,
    LineAmountTypes: 'Inclusive',
    LineItems: [{
      Description: `${String(invoice.description || 'Subcontractor invoice').slice(0, 3500)}${cisNote}`,
      Quantity: 1,
      UnitAmount: Number(invoice.grossAmount),
      AccountCode: accountCode,
      TaxType: taxType,
    }],
    Status: 'DRAFT',
  }
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function xeroStatusToLocal(status, resourceType) {
  const value = String(status || '').toUpperCase()
  if (value === 'PAID') return resourceType === 'sub_invoice' ? 'paid' : 'paid'
  if (resourceType === 'invoice' && value === 'AUTHORISED') return 'sent'
  if (resourceType === 'sub_invoice' && value === 'AUTHORISED') return 'approved'
  return null
}

module.exports = {
  XERO_SCOPES,
  buildAuthorizeUrl,
  decodeJwtPayload,
  selectAuthorizedConnection,
  salesInvoicePayload,
  purchaseBillPayload,
  payloadHash,
  xeroStatusToLocal,
}

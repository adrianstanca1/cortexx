'use strict'

const crypto = require('node:crypto')

const WRITE_SCOPES = Object.freeze(['accounting.invoices', 'accounting.payments', 'accounting.contacts'])

function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : null
}

function settingsObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function writebackMapping(settings) {
  const s = settingsObject(settings)
  return {
    enabled: s.writebackEnabled === true,
    salesAccountCode: String(s.salesAccountCode || '').trim(),
    salesTaxType: String(s.salesTaxType || '').trim(),
    purchaseAccountCode: String(s.purchaseAccountCode || '').trim(),
    purchaseTaxType: String(s.purchaseTaxType || '').trim(),
    paymentAccountCode: String(s.paymentAccountCode || '').trim(),
  }
}

function missingWriteScopes(scopes) {
  const set = new Set(String(scopes || '').split(/\s+/).filter(Boolean))
  return WRITE_SCOPES.filter(scope => !set.has(scope))
}

function validateGrossBreakdown({ amount, netAmount, vatAmount, vatRate }) {
  const gross = money(amount)
  const net = money(netAmount)
  const vat = money(vatAmount)
  if (gross == null || gross <= 0) return { ok: false, error: 'Gross amount must be positive' }
  if (net == null || net < 0 || vat == null || vat < 0) {
    return { ok: false, error: 'Explicit net and VAT amounts are required before Xero write-back' }
  }
  if (Math.abs(gross - money(net + vat)) > 0.01) {
    return { ok: false, error: 'Gross amount must equal net amount plus VAT amount' }
  }
  if (vatRate !== undefined && vatRate !== null && vatRate !== '') {
    const rate = Number(vatRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, error: 'VAT rate must be between 0 and 100' }
    const expectedVat = money(net * rate / 100)
    if (expectedVat == null || Math.abs(vat - expectedVat) > 0.02) {
      return { ok: false, error: 'VAT amount does not match the net amount and VAT rate' }
    }
  }
  return { ok: true, gross, net, vat }
}

function clientInvoicePayload(invoice, mapping, contactId) {
  const totals = validateGrossBreakdown(invoice)
  if (!totals.ok) throw new Error(totals.error)
  if (!mapping.salesAccountCode || !mapping.salesTaxType) throw new Error('Sales account and tax mappings are required')
  if (!contactId) throw new Error('Xero ContactID is required')
  const status = String(invoice.status || '').toLowerCase() === 'draft' ? 'DRAFT' : 'AUTHORISED'
  return {
    Type: 'ACCREC',
    Contact: { ContactID: contactId },
    InvoiceNumber: String(invoice.number),
    Reference: `Cortexx:${invoice.id}`,
    Date: new Date(invoice.issuedDate).toISOString().slice(0, 10),
    DueDate: new Date(invoice.dueDate).toISOString().slice(0, 10),
    Status: status,
    LineAmountTypes: 'Exclusive',
    CurrencyCode: 'GBP',
    LineItems: [{
      Description: invoice.project?.name
        ? `${invoice.project.name} — services rendered`
        : `${invoice.clientName} — services rendered`,
      Quantity: 1,
      UnitAmount: totals.net,
      AccountCode: mapping.salesAccountCode,
      TaxType: mapping.salesTaxType,
      TaxAmount: totals.vat,
    }],
  }
}

function subInvoicePayload(invoice, mapping, contactId) {
  if (Number(invoice.cisAmount || 0) > 0.005) {
    throw new Error('CIS subcontract invoices require a dedicated Xero CIS mapping before write-back')
  }
  const totals = validateGrossBreakdown({ amount: invoice.grossAmount, netAmount: invoice.netAmount, vatAmount: invoice.vatAmount })
  if (!totals.ok) throw new Error(totals.error)
  if (!mapping.purchaseAccountCode || !mapping.purchaseTaxType) throw new Error('Purchase account and tax mappings are required')
  if (!contactId) throw new Error('Xero ContactID is required')
  return {
    Type: 'ACCPAY',
    Contact: { ContactID: contactId },
    InvoiceNumber: String(invoice.number),
    Reference: `Cortexx:${invoice.id}`,
    Date: new Date(invoice.invoiceDate).toISOString().slice(0, 10),
    DueDate: new Date(invoice.invoiceDate).toISOString().slice(0, 10),
    Status: String(invoice.status || '').toLowerCase() === 'received' ? 'DRAFT' : 'AUTHORISED',
    LineAmountTypes: 'Exclusive',
    CurrencyCode: 'GBP',
    LineItems: [{
      Description: invoice.description || invoice.project?.name || invoice.subcontractor?.name || 'Subcontract invoice',
      Quantity: 1,
      UnitAmount: totals.net,
      AccountCode: mapping.purchaseAccountCode,
      TaxType: mapping.purchaseTaxType,
      TaxAmount: totals.vat,
    }],
  }
}

function paymentPayload({ invoiceId, amount, paidAt, reference, accountCode }) {
  const total = money(amount)
  if (!invoiceId) throw new Error('Xero InvoiceID is required')
  if (!accountCode) throw new Error('Payment account mapping is required')
  if (total == null || total <= 0) throw new Error('Payment amount must be positive')
  return {
    Invoice: { InvoiceID: invoiceId },
    Account: { Code: accountCode },
    Date: new Date(paidAt || Date.now()).toISOString().slice(0, 10),
    Amount: total,
    Reference: reference || 'Cortexx payment',
  }
}

function contactNumber(entityType, entityId) {
  return `CB-${String(entityType).replace(/[^a-z0-9]/gi, '').slice(0, 12)}-${String(entityId).replace(/[^a-z0-9]/gi, '').slice(-28)}`
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

module.exports = {
  WRITE_SCOPES,
  money,
  writebackMapping,
  missingWriteScopes,
  validateGrossBreakdown,
  clientInvoicePayload,
  subInvoicePayload,
  paymentPayload,
  contactNumber,
  payloadHash,
}

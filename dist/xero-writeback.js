'use strict'

const crypto = require('node:crypto')

const WRITE_SCOPES = Object.freeze(['accounting.invoices', 'accounting.payments', 'accounting.contacts'])

function money(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
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
    salesTaxRate: money(s.salesTaxRate),
    purchaseAccountCode: String(s.purchaseAccountCode || '').trim(),
    purchaseTaxType: String(s.purchaseTaxType || '').trim(),
    purchaseTaxRate: money(s.purchaseTaxRate),
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

function validateMappedTaxRate(label, mappedRate, documentRate) {
  const mapped = money(mappedRate)
  const document = money(documentRate)
  if (mapped == null) throw new Error(label + ' tax mapping is missing its Xero rate')
  if (document == null) throw new Error(label + ' document VAT rate is missing')
  if (Math.abs(mapped - document) > 0.02) {
    throw new Error(label + ' VAT rate ' + document + '% does not match mapped Xero tax rate ' + mapped + '%')
  }
}

function clientInvoicePayload(invoice, mapping, contactId) {
  const totals = validateGrossBreakdown(invoice)
  if (!totals.ok) throw new Error(totals.error)
  if (!mapping.salesAccountCode || !mapping.salesTaxType) throw new Error('Sales account and tax mappings are required')
  validateMappedTaxRate('Sales', mapping.salesTaxRate, invoice.vatRate)
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
  const effectivePurchaseRate = totals.net === 0 ? (totals.vat === 0 ? 0 : null) : money(totals.vat / totals.net * 100)
  validateMappedTaxRate('Purchase', mapping.purchaseTaxRate, effectivePurchaseRate)
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
  if (!paidAt) throw new Error('An explicit payment date is required')
  const date = new Date(paidAt)
  if (Number.isNaN(date.getTime())) throw new Error('Payment date is invalid')
  return {
    Invoice: { InvoiceID: invoiceId },
    Account: { Code: accountCode },
    Date: date.toISOString().slice(0, 10),
    Amount: total,
    Reference: reference || 'Cortexx payment',
  }
}

function contactNumber(entityType, entityId) {
  const type = String(entityType).replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'contact'
  const digest = crypto.createHash('sha256').update(String(entityId)).digest('hex').slice(0, 20)
  return 'CB-' + type + '-' + digest
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function idempotencyKey(connectionId, entityType, entityId) {
  // One creation per local identity. Concurrent edits must conflict at Xero,
  // rather than obtain a new key that could create a second payment.
  return `Cortexx-${payloadHash({ connectionId, entityType, entityId })}`
}

function recoverPaymentId(payments, expected) {
  const candidates = payments.filter(payment => {
    if (payment.Status === 'DELETED' || money(payment.Amount) !== expected.Amount) return false
    const raw = payment.DateString || payment.Date
    const legacy = String(raw || '').match(/^\/Date\((-?\d+)/)
    const date = legacy ? new Date(Number(legacy[1])) : new Date(raw || '')
    if (Number.isNaN(date.getTime())) throw new Error('Existing Xero payment has no valid date; manual reconciliation required')
    return date.toISOString().slice(0, 10) === expected.Date
  })
  if (candidates.length > 1) throw new Error('Multiple matching Xero payments found; manual reconciliation required')
  if (!candidates.length) return null
  const payment = candidates[0]
  if (!payment.PaymentID || payment.Reference !== expected.Reference || payment.Account?.Code !== expected.Account.Code) {
    throw new Error('Existing Xero payment has a different reference or account; manual reconciliation required')
  }
  return String(payment.PaymentID)
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
  idempotencyKey,
  recoverPaymentId,
}

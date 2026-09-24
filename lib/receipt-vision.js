'use strict'

const CATEGORIES = new Set(['materials', 'plant', 'tools', 'fuel', 'travel', 'accommodation', 'subcontract', 'office', 'other'])

function text(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function money(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(/[,£$€]/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function date(value) {
  const v = text(value, 32)
  if (!v) return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(`${v}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v
}

function extractJson(raw) {
  const cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Model returned no JSON object')
  return JSON.parse(cleaned.slice(start, end + 1))
}

function parseReceiptVision(raw) {
  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Receipt response must be an object')
  const obj = parsed
  const vendor = text(obj.vendor ?? obj.merchant ?? obj.supplier, 160) || null
  const totalAmount = money(obj.totalAmount ?? obj.total ?? obj.amount)
  const vatAmount = money(obj.vatAmount ?? obj.vat ?? obj.tax)
  let subtotal = money(obj.subtotal ?? obj.netAmount ?? obj.net)
  if (subtotal === null && totalAmount !== null && vatAmount !== null && totalAmount >= vatAmount) subtotal = money(totalAmount - vatAmount)
  const rawCategory = text(obj.category, 40).toLowerCase()
  const category = CATEGORIES.has(rawCategory) ? rawCategory : 'other'
  const rawConfidence = Number(obj.confidence)
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0
  const receiptDate = date(obj.date ?? obj.receiptDate)
  const currency = text(obj.currency, 3).toUpperCase() || 'GBP'
  const notes = text(obj.notes, 400) || null
  const rawItems = Array.isArray(obj.items) ? obj.items : []
  const items = rawItems.slice(0, 50).flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const description = text(item.description ?? item.d ?? item.name, 180)
    if (!description) return []
    const quantityRaw = Number(item.quantity ?? item.qty ?? 1)
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw * 1000) / 1000 : 1
    const unitPrice = money(item.unitPrice ?? item.price)
    const total = money(item.total ?? (unitPrice !== null ? unitPrice * quantity : null))
    return [{ description, quantity, unitPrice, total }]
  })
  if (!vendor && totalAmount === null) throw new Error('Receipt extraction did not contain a vendor or total')
  return { vendor, receiptDate, subtotal, vatAmount, totalAmount, currency, category, items, confidence, notes }
}

module.exports = { CATEGORIES, parseReceiptVision, money, date }

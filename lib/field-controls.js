'use strict'

const CONSTRAINT_TRANSITIONS = Object.freeze({
  open: new Set(['mitigating', 'resolved']),
  mitigating: new Set(['open', 'resolved']),
  resolved: new Set(['open']),
})

function cleanText(value, max = 500) {
  return String(value ?? '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeNonNegative(value, max = 1_000_000_000) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > max) return null
  return n
}

function productionMetrics(plannedQty, installedQty, labourHours) {
  const planned = normalizeNonNegative(plannedQty) ?? 0
  const installed = normalizeNonNegative(installedQty) ?? 0
  const hours = normalizeNonNegative(labourHours, 100000) ?? 0
  const varianceQty = installed - planned
  const completionPct = planned > 0 ? Math.round((installed / planned) * 1000) / 10 : null
  const qtyPerLabourHour = hours > 0 ? Math.round((installed / hours) * 1000) / 1000 : null
  const labourHoursPerUnit = installed > 0 ? Math.round((hours / installed) * 1000) / 1000 : null
  return { plannedQty: planned, installedQty: installed, labourHours: hours, varianceQty, completionPct, qtyPerLabourHour, labourHoursPerUnit }
}

function sanitizeOpenItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 50).map((item, index) => {
    const value = item && typeof item === 'object' ? item : {}
    const title = cleanText(value.title || value.text, 220)
    if (!title) return null
    return {
      id: cleanText(value.id, 50) || `item-${index}`,
      title,
      owner: cleanText(value.owner, 120) || null,
      dueDate: cleanText(value.dueDate, 40) || null,
      status: ['open', 'done'].includes(String(value.status)) ? String(value.status) : 'open',
    }
  }).filter(Boolean)
}

function sanitizeUploadUrl(value) {
  const url = cleanText(value, 500)
  return /^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(url) ? url : null
}

function sanitizeEvidence(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  const photoUrls = Array.isArray(value.photoUrls)
    ? value.photoUrls.map(sanitizeUploadUrl).filter(Boolean).slice(0, 6)
    : []
  const signatureUrl = sanitizeUploadUrl(value.signatureUrl)
  return {
    photoUrls,
    signatureUrl,
    signedBy: cleanText(value.signedBy, 120) || null,
    condition: cleanText(value.condition, 120) || null,
    storageLocation: cleanText(value.storageLocation, 160) || null,
  }
}

function hasReleaseEvidence(raw) {
  const evidence = sanitizeEvidence(raw)
  return evidence.photoUrls.length > 0 || Boolean(evidence.signatureUrl)
}

function initialReleaseStatus(pointType) {
  return pointType === 'hold' || pointType === 'witness' ? 'pending' : 'not_required'
}

function canCompletePoint(pointType, releaseStatus) {
  return pointType === 'inspection' || releaseStatus === 'released'
}

function canTransitionConstraintStatus(from, to) {
  if (from === to) return true
  return Boolean(CONSTRAINT_TRANSITIONS[from]?.has(to))
}

module.exports = {
  cleanText,
  normalizeNonNegative,
  productionMetrics,
  sanitizeOpenItems,
  sanitizeEvidence,
  hasReleaseEvidence,
  initialReleaseStatus,
  canCompletePoint,
  canTransitionConstraintStatus,
}

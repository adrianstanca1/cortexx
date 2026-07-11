/**
 * Shared helper for AI-drafted line items.
 *
 * Used by /api/quotes/draft and /api/pos/draft. Both endpoints share the
 * same line-item shape (description, quantity, unit, unitPrice) and need
 * the same defensive parser — local LLMs sometimes wrap JSON in markdown
 * fences, drift on key casing, or return out-of-range numbers.
 *
 * The system prompt differs per caller (quotes describe whole jobs; POs
 * describe specific materials / plant). Callers pass it in.
 */
import { chat } from './llm'

export const COMMON_UNITS = ['hour', 'day', 'item', 'm', 'm²', 'm³', 'kg', 'tonne', 'job'] as const
export const MAX_ITEMS = 12
export const MAX_DESC_LEN = 140
export const MAX_BRIEF_LEN = 800

export interface DraftLineItem {
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface DraftResponse {
  items: DraftLineItem[]
  notes?: string
}

/**
 * Parse raw LLM output into validated line items. Tolerates:
 *  - markdown fences (```json ... ```)
 *  - both `unitPrice` and `unit_price` key spellings
 *  - unknown units (falls back to 'item')
 *  - out-of-range quantity / price (clamps to safe ranges)
 *  - empty descriptions (drops the item)
 *  - >MAX_ITEMS items (caps)
 *
 * Throws if no usable items remain after validation.
 */
export function parseDraftResponse(raw: string): DraftResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Model did not return a JSON object')
  }
  const obj = parsed as Record<string, unknown>
  const rawItems = Array.isArray(obj.items) ? obj.items : []
  const items: DraftLineItem[] = []
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue
    const r = it as Record<string, unknown>
    const description = typeof r.description === 'string' ? r.description.trim().slice(0, MAX_DESC_LEN) : ''
    if (!description) continue
    const quantity = Math.max(0.1, Math.min(10_000, Number(r.quantity) || 1))
    let unit = typeof r.unit === 'string' ? r.unit.trim().toLowerCase() : 'item'
    if (!(COMMON_UNITS as readonly string[]).includes(unit)) unit = 'item'
    const unitPrice = Math.max(0, Math.min(1_000_000, Number(r.unitPrice ?? r.unit_price) || 0))
    items.push({ description, quantity, unit, unitPrice })
    if (items.length >= MAX_ITEMS) break
  }
  if (items.length === 0) {
    throw new Error('Model did not return any usable line items')
  }
  const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 280) : undefined
  return { items, notes }
}

export interface DraftedItems extends DraftResponse {
  model: string
  latencyMs?: number
}

export async function draftLineItems(system: string, user: string): Promise<DraftedItems> {
  const res = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { json: true }
  )
  const parsed = parseDraftResponse(res.content)
  return { ...parsed, model: res.model, latencyMs: res.totalDurationMs }
}

/**
 * In-memory per-user rate limit. Generous enough for normal manual drafting
 * (6 / 60s ≈ one draft every 10s sustained), tight enough to stop a runaway
 * client. Mirrors the cap pattern from /api/ask.
 */
const rateLimits = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000

export function checkDraftRateLimit(userKey: string, max = 6): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const arr = (rateLimits.get(userKey) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (arr.length >= max) {
    const oldest = arr[0]
    return { ok: false, retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000) }
  }
  arr.push(now)
  rateLimits.set(userKey, arr)
  return { ok: true }
}

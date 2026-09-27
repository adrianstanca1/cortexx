import { canWrite } from './rbac'

export const DRAWING_MARKUP_KINDS = ['pin', 'note', 'box'] as const
export const DRAWING_MARKUP_STATUSES = ['open', 'resolved'] as const

export type DrawingMarkupKind = typeof DRAWING_MARKUP_KINDS[number]
export type DrawingMarkupStatus = typeof DRAWING_MARKUP_STATUSES[number]

const KINDS = new Set<string>(DRAWING_MARKUP_KINDS)
const STATUSES = new Set<string>(DRAWING_MARKUP_STATUSES)
const ANNOTATORS = new Set(['company_admin', 'project_manager', 'foreman', 'operative'])
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export class DrawingMarkupValidationError extends Error {}

export function canAnnotateDrawing(role?: string | null, personaRole?: string | null) {
  return canWrite(role || '') && ANNOTATORS.has(personaRole || '')
}

export function parseMarkupKind(value: unknown): DrawingMarkupKind {
  const kind = String(value || 'pin').trim().toLowerCase()
  if (!KINDS.has(kind)) throw new DrawingMarkupValidationError('Unsupported markup type')
  return kind as DrawingMarkupKind
}
export function parseMarkupStatus(value: unknown): DrawingMarkupStatus {
  const status = String(value || '').trim().toLowerCase()
  if (!STATUSES.has(status)) throw new DrawingMarkupValidationError('Unsupported markup status')
  return status as DrawingMarkupStatus
}

export function parseNormalized(value: unknown, field: string) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) {
    throw new DrawingMarkupValidationError(field + ' must be between 0 and 1')
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new DrawingMarkupValidationError(field + ' must be between 0 and 1')
  }
  return number
}

export function parseOptionalNormalized(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  return parseNormalized(value, field)
}

export function parseMarkupPage(value: unknown) {
  const raw = value === undefined ? 1 : value
  const page = typeof raw === 'number' || (typeof raw === 'string' && /^[0-9]+$/.test(raw.trim())) ? Number(raw) : NaN
  if (!Number.isInteger(page) || page < 1 || page > 9999) {
    throw new DrawingMarkupValidationError('Page must be between 1 and 9999')
  }
  return page
}
export function parseMarkupText(value: unknown) {
  const text = String(value || '').trim()
  if (!text) throw new DrawingMarkupValidationError('Markup note is required')
  if (text.length > 1000) throw new DrawingMarkupValidationError('Markup note is too long')
  return text
}

export function parseMarkupColor(value: unknown) {
  if (value === null || value === undefined || value === '') return '#f59e0b'
  const color = String(value).trim()
  if (!HEX_COLOR.test(color)) throw new DrawingMarkupValidationError('Markup color must be a 6-digit hex value')
  return color.toLowerCase()
}

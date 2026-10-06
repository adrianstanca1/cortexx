export interface KnowledgeSource {
  id: string
  label: string
  href: string
  summary: string
  observedAt: string
}

// Both API responses and restored browser history use this guard. Only the
// app's own source pages can become clickable citations.
export function isKnowledgeSource(value: unknown): value is KnowledgeSource {
  if (!value || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  return typeof source.id === 'string' && /^K\d+$/.test(source.id)
    && typeof source.label === 'string' && typeof source.summary === 'string'
    && typeof source.observedAt === 'string' && Number.isFinite(Date.parse(source.observedAt))
    && typeof source.href === 'string'
    && (/^\/(projects|snags|timesheets|rfis|risks|inspections|invoices)$/.test(source.href)
      || /^\/projects\/[A-Za-z0-9_-]+$/.test(source.href))
}

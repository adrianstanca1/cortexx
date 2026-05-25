'use client'

import { useEffect, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'
import ModuleRecordModal from '@/components/ui/ModuleRecordModal'

interface Row {
  id: string
  createdAt: string
  title?: string
  description?: string | null
  parties?: string | null
  owner?: string | null
  status?: string
  severity?: string
  raisedAt?: string | null
  resolvedAt?: string | null
  [k: string]: unknown
}

type FilterId = 'all' | 'open' | 'investigating' | 'resolved' | 'dropped'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'investigating', label: 'Investigating' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dropped', label: 'Dropped' },
]

const SEVERITY_COLOR: Record<string, string> = {
  low: '#52749a',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#ef4444',
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function ConflictsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')

  useEffect(() => {
    fetch('/api/conflicts')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    const value = window.prompt('New conflict — title')
    if (!value) return
    const res = await fetch('/api/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: value }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      window.alert(d.error || 'Failed to create')
      return
    }
    const created = await res.json()
    setRows(prev => [created.item, ...prev])
    setSelected(created.item)
  }

  const markResolved = async (row: Row, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await fetch(`/api/conflicts/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolvedAt: new Date().toISOString() }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      window.alert(d.error || 'Failed to update')
      return
    }
    const updated = await res.json()
    setRows(prev => prev.map(r => r.id === updated.item.id ? updated.item : r))
  }

  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  return (
    <ModuleShell
      title="Conflicts"
      tagline="Logged cross-team conflicts on site with severity, owner, and resolution notes"
      action={{ label: 'New', onClick: create }}
    >
      {/* Status filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {FILTERS.map(f => {
          const count = f.id === 'all' ? rows.length : rows.filter(r => r.status === f.id).length
          const active = f.id === filter
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 14px',
                borderRadius: 99,
                border: 'none',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? '#0c1a2e' : '#52749a',
                background: active ? '#ef4444' : 'rgba(255,255,255,0.06)',
                cursor: 'pointer',
                fontFamily: 'var(--font-system)',
                whiteSpace: 'nowrap',
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? '#0c1a2e' : '#8ea8c5',
                    opacity: active ? 0.8 : 1,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : visible.length === 0 ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)', padding: 32, textAlign: 'center' }}>
          No records yet. Click <strong style={{ color: '#ef4444' }}>+ New</strong> to add the first one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(r => {
            const severity = (r.severity || 'medium').toLowerCase()
            const sevColor = SEVERITY_COLOR[severity] || SEVERITY_COLOR.medium
            const isCritical = severity === 'critical'
            const isResolved = r.status === 'resolved' || r.status === 'dropped'
            const raised = r.raisedAt || r.createdAt
            return (
              <li
                key={r.id}
                onClick={() => setSelected(r)}
                style={{
                  background: '#152641',
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: isCritical
                    ? '1px solid rgba(239,68,68,0.6)'
                    : '0.5px solid rgba(255,255,255,0.07)',
                  fontFamily: 'var(--font-system)',
                  fontSize: 13,
                  color: '#eef3fa',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                      color: isResolved ? '#52749a' : '#eef3fa',
                      textDecoration: isResolved ? 'line-through' : 'none',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: sevColor,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title || r.id}
                    </span>
                    {r.status && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                          padding: '2px 7px',
                          borderRadius: 99,
                          background: 'rgba(255,255,255,0.06)',
                          color: '#8ea8c5',
                          textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        {r.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#52749a', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.parties && <span>{r.parties}</span>}
                    {r.owner && <span>Owner: {r.owner}</span>}
                    <span>Raised {relativeTime(raised as string)}</span>
                  </div>
                </div>
                {!isResolved && (
                  <button
                    onClick={e => markResolved(r, e)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(16,185,129,0.15)',
                      border: '0.5px solid rgba(16,185,129,0.4)',
                      color: '#10b981',
                      fontFamily: 'var(--font-system)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Mark resolved
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ModuleRecordModal
        slug="conflicts"
        record={selected}
        onClose={() => setSelected(null)}
        onSaved={next => setRows(prev => prev.map(r => r.id === next.id ? next : r))}
        onDeleted={id => setRows(prev => prev.filter(r => r.id !== id))}
      />
    </ModuleShell>
  )
}

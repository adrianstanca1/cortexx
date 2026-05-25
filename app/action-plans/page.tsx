'use client'

import { useEffect, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'
import ModuleRecordModal from '@/components/ui/ModuleRecordModal'

interface Row {
  id: string
  createdAt: string
  title?: string
  owner?: string | null
  status?: string
  priority?: string
  dueDate?: string | null
  [k: string]: unknown
}

type FilterId = 'all' | 'open' | 'in_progress' | 'done'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]

export default function ActionPlansPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')

  useEffect(() => {
    fetch('/api/action-plans')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    const value = window.prompt('New action plan — title')
    if (!value) return
    const res = await fetch('/api/action-plans', {
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

  const markDone = async (row: Row, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await fetch(`/api/action-plans/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', closedAt: new Date().toISOString() }),
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
      title="Action plans"
      tagline="Tracked corrective actions with owner, due date, and close-out notes"
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
                background: active ? '#f59e0b' : 'rgba(255,255,255,0.06)',
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
          No records yet. Click <strong style={{ color: '#f59e0b' }}>+ New</strong> to add the first one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(r => {
            const isDone = r.status === 'done'
            return (
              <li
                key={r.id}
                onClick={() => setSelected(r)}
                style={{
                  background: '#152641',
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: '0.5px solid rgba(255,255,255,0.07)',
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
                  <div style={{ fontWeight: 600, color: isDone ? '#52749a' : '#eef3fa', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {r.title || r.id}
                  </div>
                  <div style={{ fontSize: 11, color: '#52749a', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.owner && <span>Owner: {r.owner}</span>}
                    {r.priority && <span>Priority: {r.priority}</span>}
                    {r.status && <span>Status: {r.status}</span>}
                    {r.dueDate && <span>Due: {new Date(r.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                    <span>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                  </div>
                </div>
                {!isDone && (
                  <button
                    onClick={e => markDone(r, e)}
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
                    Mark done
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ModuleRecordModal
        slug="action-plans"
        record={selected}
        onClose={() => setSelected(null)}
        onSaved={next => setRows(prev => prev.map(r => r.id === next.id ? next : r))}
        onDeleted={id => setRows(prev => prev.filter(r => r.id !== id))}
      />
    </ModuleShell>
  )
}

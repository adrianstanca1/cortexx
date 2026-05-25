'use client'

import { useEffect, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'
import ModuleRecordModal from '@/components/ui/ModuleRecordModal'

interface Row { id: string; createdAt: string; [k: string]: unknown }

export default function KaizenCardPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)

  useEffect(() => {
    fetch('/api/kaizen-board')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    const value = window.prompt('New kaizen board — short label')
    if (!value) return
    const res = await fetch('/api/kaizen-board', {
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
  }

  return (
    <ModuleShell
      title="Kaizen board"
      tagline="Lean-style kaizen tickets"
      action={{ label: 'New', onClick: create }}
    >
      {loading ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)', padding: 32, textAlign: 'center' }}>
          No records yet. Click <strong style={{ color: '#f59e0b' }}>New</strong> to add the first one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <li
              key={r.id}
              onClick={() => setSelected(r)}
              style={{ background: '#152641', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', cursor: 'pointer' }}
            >
              <div>{[r.title, r.problem, r.solution].filter(Boolean).join(' · ') || r.id}</div>
              <div style={{ fontSize: 11, color: '#52749a', marginTop: 4 }}>
                {new Date(r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ModuleRecordModal
        slug="kaizen-board"
        record={selected}
        onClose={() => setSelected(null)}
        onSaved={next => setRows(prev => prev.map(r => r.id === next.id ? next : r))}
        onDeleted={id => setRows(prev => prev.filter(r => r.id !== id))}
      />
    </ModuleShell>
  )
}

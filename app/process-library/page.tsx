'use client'

import { useEffect, useState } from 'react'
import ModuleShell from '@/components/ui/ModuleShell'
import ModuleRecordModal from '@/components/ui/ModuleRecordModal'

interface Row { id: string; createdAt: string; [k: string]: unknown }

export default function ProcessDocPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/process-library')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const openRecord = async (id: string) => {
    if (openingId) return
    setOpeningId(id)
    setError(null)
    try {
      const res = await fetch('/api/process-library/' + id)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to open process')
      setSelected(json.item)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open process')
    } finally {
      setOpeningId(null)
    }
  }

  const create = async () => {
    const value = window.prompt('New process library — short label')
    if (!value) return
    const res = await fetch('/api/process-library', {
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
    // Open the edit modal on the new record so the user can fill in
    // the remaining fields without having to find + click the row.
    setSelected(created.item)
  }

  return (
    <ModuleShell
      title="Process library"
      tagline="Reusable company standards and proven construction methods"
      action={{ label: 'New process', onClick: create }}
    >
      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: 'var(--font-system)', padding: 32, textAlign: 'center' }}>
          No company standards yet. Click <strong style={{ color: '#f59e0b' }}>New process</strong> to add one, or standardise a proven Innovation OS pilot.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => {
            const title = typeof r.title === 'string' && r.title.trim() ? r.title : 'Untitled process'
            const category = typeof r.category === 'string' ? r.category : null
            const owner = typeof r.owner === 'string' ? r.owner : null
            const version = typeof r.version === 'string' ? r.version : null
            const publishedAt = typeof r.publishedAt === 'string' ? r.publishedAt : null
            return (
              <li
                key={r.id}
                onClick={() => void openRecord(r.id)}
                style={{ background: 'var(--surface-raised)', borderRadius: 12, padding: '13px 14px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)', color: 'var(--t1)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{title}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                      {[category, owner ? 'owner ' + owner : null, version ? 'v' + version : null].filter(Boolean).join(' · ') || 'Process standard'}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, borderRadius: 999, padding: '3px 7px', fontSize: 9, fontWeight: 800, color: publishedAt ? '#86efac' : '#fde68a', background: publishedAt ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)' }}>
                    {publishedAt ? 'Published' : 'Draft'}
                  </span>
                </div>
                {openingId === r.id && <div style={{ color: '#67e8f9', fontSize: 10, marginTop: 8 }}>Opening full standard…</div>}
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>
                  {new Date(publishedAt || r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ModuleRecordModal
        slug="process-library"
        record={selected}
        onClose={() => setSelected(null)}
        onSaved={next => setRows(prev => prev.map(r => r.id === next.id ? next : r))}
        onDeleted={id => setRows(prev => prev.filter(r => r.id !== id))}
      />
    </ModuleShell>
  )
}

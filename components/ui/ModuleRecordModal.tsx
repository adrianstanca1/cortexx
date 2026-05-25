'use client'

/**
 * Generic edit modal for the 24 legacy-parity modules. Renders each
 * field of the record as a control inferred from the value's type:
 *
 *   string  → <input type="text">
 *   number  → <input type="number">
 *   boolean → <input type="checkbox">
 *   ISO date string → <input type="date">
 *   other / null → <input type="text"> (free-form)
 *
 * id, createdAt, updatedAt, organizationId are read-only.
 *
 * Save → PUT /api/<slug>/<id>
 * Delete → DELETE /api/<slug>/<id>
 *
 * Returns the updated record / deleted id via callbacks so the parent
 * can update its in-memory list without a refetch.
 */
import { useEffect, useState } from 'react'

interface Row { id: string; createdAt: string; [k: string]: unknown }

const READ_ONLY = new Set(['id', 'createdAt', 'updatedAt', 'organizationId'])

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/

function inferType(value: unknown): 'string' | 'number' | 'boolean' | 'date' {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) return 'date'
  return 'string'
}

function coerceForSubmit(initialType: 'string' | 'number' | 'boolean' | 'date', raw: string): unknown {
  if (initialType === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  if (initialType === 'boolean') return raw === 'true'
  // Anchor the date at local midnight so a yyyy-mm-dd input doesn't
  // shift back/forward by one day on re-edit in non-UTC locales. The
  // ISO output still serializes consistently for the server.
  if (initialType === 'date') return raw ? new Date(raw + 'T00:00:00').toISOString() : null
  return raw
}

function valueToInput(value: unknown, t: 'string' | 'number' | 'boolean' | 'date'): string {
  if (value == null) return ''
  if (t === 'date' && typeof value === 'string') return value.slice(0, 10)
  return String(value)
}

interface Props {
  slug: string
  record: Row | null
  onClose: () => void
  onSaved: (next: Row) => void
  onDeleted: (id: string) => void
}

export default function ModuleRecordModal({ slug, record, onClose, onSaved, onDeleted }: Props) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEdits({})
    setError(null)
  }, [record?.id])

  if (!record) return null

  const fields = Object.entries(record)
    .filter(([k]) => !READ_ONLY.has(k))

  const save = async () => {
    if (Object.keys(edits).length === 0) { onClose(); return }
    setSaving(true)
    setError(null)
    const body: Record<string, unknown> = {}
    for (const [k, raw] of Object.entries(edits)) {
      const t = inferType(record[k])
      body[k] = coerceForSubmit(t, raw)
    }
    try {
      const res = await fetch(`/api/${slug}/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      const d = await res.json()
      onSaved(d.item)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/${slug}/${record.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onDeleted(record.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0a1a31', borderRadius: 14, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '0.5px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-system)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, color: '#eef3fa', fontWeight: 700, margin: 0 }}>Edit record</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#52749a', fontSize: 20, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(([key, value]) => {
            const t = inferType(value)
            const current = edits[key] ?? valueToInput(value, t)
            return (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#52749a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{key}</span>
                {t === 'boolean' ? (
                  <select
                    value={current}
                    onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={t === 'number' ? 'number' : t === 'date' ? 'date' : 'text'}
                    value={current}
                    onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                )}
              </label>
            )
          })}
          {fields.length === 0 && (
            <div style={{ color: '#52749a', fontSize: 13, padding: 16, textAlign: 'center' }}>No editable fields.</div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, color: '#ef4444', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
          <button
            onClick={del}
            disabled={saving}
            style={{ ...btnStyle, color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.4)' }}
          >
            Delete
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={saving} style={{ ...btnStyle, color: '#8ea8c5' }}>Cancel</button>
            <button
              onClick={save}
              disabled={saving || Object.keys(edits).length === 0}
              style={{ ...btnStyle, background: '#f59e0b', color: '#06101e', borderColor: 'transparent', opacity: saving || Object.keys(edits).length === 0 ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#152641',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#eef3fa',
  fontFamily: 'var(--font-system)',
  fontSize: 13,
  outline: 'none',
}

const btnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  background: 'transparent',
  border: '0.5px solid rgba(255,255,255,0.1)',
  fontSize: 12,
  fontFamily: 'var(--font-system)',
  fontWeight: 700,
  cursor: 'pointer',
}

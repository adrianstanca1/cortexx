'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcDoc, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Doc {
  id: string
  name: string
  type: string
  expiresAt: string | null
  createdAt: string
  projectId: string | null
  project?: { id: string; name: string } | null
}

const EXPIRY_WARN_DAYS = 7

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'rams', projectId: '', expiresAt: '' })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(() => {
    fetch('/api/documents')
      .then(r => { if (!r.ok) throw new Error('Failed to load documents'); return r.json() })
      .then(d => { setDocs(d.documents || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => setProjects((d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          projectId: form.projectId || null,
          expiresAt: form.expiresAt || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const newDoc = await res.json()
      setDocs(prev => [newDoc, ...prev])
      setShowModal(false)
      setForm({ name: '', type: 'rams', projectId: '', expiresAt: '' })
      setToast({ msg: 'Document added' })
    } catch {
      setToast({ msg: 'Failed to add document', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setDocs(prev => prev.filter(d => d.id !== id))
      setToast({ msg: 'Document deleted' })
    } catch {
      setToast({ msg: 'Failed to delete', type: 'error' })
    }
  }

  const types = Array.from(new Set(docs.map(d => d.type)))
  const filtered = docs.filter(d => filter === 'all' || d.type === filter)
  const now = Date.now()
  const expiringCount = docs.filter(d => d.expiresAt && new Date(d.expiresAt).getTime() < now + EXPIRY_WARN_DAYS * 86400000).length

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Back</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: 'var(--font-system)' }}>Documents</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>
              {docs.length} total{expiringCount > 0 ? ` · ${expiringCount} expiring` : ''}
            </p>
          </div>
          <button onClick={() => setShowModal(true)} aria-label="Add document" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {['all', ...types].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
      ) : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>No documents</div>
          ) : (
            filtered.map(d => {
              const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : null
              const expiring = exp !== null && exp < now + EXPIRY_WARN_DAYS * 86400000
              const expired = exp !== null && exp < now
              return (
                <div key={d.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <IcDoc size={20} color={expired ? '#ef4444' : expiring ? '#f59e0b' : '#52749a'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, color: '#eef3fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                      <span style={{ textTransform: 'capitalize' }}>{d.type}</span>
                      {d.project && <> · <Link href={`/projects/${d.project.id}`} style={{ color: '#8ea8c5', textDecoration: 'none' }}>{d.project.name}</Link></>}
                      {d.expiresAt && <span style={{ color: expired ? '#ef4444' : expiring ? '#f59e0b' : '#52749a' }}>
                        {' '}· {expired ? 'Expired' : 'Expires'} {new Date(d.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(d.id)}
                    aria-label={confirmDelete === d.id ? 'Confirm delete' : 'Delete document'}
                    style={{ background: confirmDelete === d.id ? 'rgba(239,68,68,0.2)' : 'none', border: 'none', borderRadius: 4, padding: confirmDelete === d.id ? '4px 8px' : 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <IcTrash size={13} color="#ef4444" />
                    {confirmDelete === d.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-system)' }}>Sure?</span>}
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      <TabBar />

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: 'var(--font-system)' }}>Add document</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Document name" style={inputStyle} />

            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="rams">RAMS</option>
                <option value="report">Report</option>
                <option value="photo">Photo</option>
                <option value="receipt">Receipt</option>
                <option value="quote">Quote</option>
                <option value="permit">Permit</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Project</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Expires (optional)</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <button onClick={create} disabled={saving || !form.name.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Add document'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 11,
  color: '#52749a',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a2f4e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '11px 14px',
  color: '#eef3fa',
  fontFamily: 'var(--font-system)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

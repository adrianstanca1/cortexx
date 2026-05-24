'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcBell, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcPin } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
interface Announcement {
  id: string
  title: string
  body: string
  type: 'general' | 'safety' | 'urgent' | 'update'
  projectId: string | null
  authorName: string | null
  isPinned: boolean
  createdAt: string
  updatedAt: string
  project?: Project | null
}

const SF = 'var(--font-system)'

const TYPE_CFG: Record<Announcement['type'], { label: string; color: string; bg: string }> = {
  general: { label: 'General', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  safety:  { label: 'Safety',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  urgent:  { label: 'Urgent',  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  update:  { label: 'Update',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
}

export default function MessagesPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Announcement['type']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'general' as Announcement['type'],
    projectId: '',
  })

  useModalEffects(showCompose, () => setShowCompose(false))

  const load = useCallback(() => {
    fetch('/api/announcements')
      .then(r => { if (!r.ok) throw new Error('Failed to load announcements'); return r.json() })
      .then(d => { setItems(d.announcements || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      setProjects((d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const post = async () => {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          type: form.type,
          projectId: form.projectId || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowCompose(false)
      setForm({ title: '', body: '', type: 'general', projectId: '' })
      load()
      setToast({ msg: 'Announcement posted' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Post failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const togglePin = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !a.isPinned }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Pin failed', type: 'error' })
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
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
  const pinned = filtered.filter(i => i.isPinned)
  const recent = filtered.filter(i => !i.isPinned)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Messages</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {items.length} announcement{items.length === 1 ? '' : 's'}
              {pinned.length > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· {pinned.length} pinned</span>}
            </p>
          </div>
          <button onClick={() => setShowCompose(true)} aria-label="Compose announcement" style={{ width: 36, height: 36, borderRadius: 10, background: '#06b6d4', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'general', 'safety', 'urgent', 'update'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : TYPE_CFG[t].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcBell size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No announcements yet</p>
          <button onClick={() => setShowCompose(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Post first
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pinned.length > 0 && (
            <>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>📌 Pinned</div>
              {pinned.map(a => <Card key={a.id} a={a} onPin={togglePin} onDelete={remove} confirmDelete={confirmDelete} />)}
            </>
          )}
          {recent.length > 0 && pinned.length > 0 && (
            <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4, marginTop: 8 }}>Recent</div>
          )}
          {recent.map(a => <Card key={a.id} a={a} onPin={togglePin} onDelete={remove} confirmDelete={confirmDelete} />)}
        </div>
      )}

      <TabBar />

      {showCompose && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowCompose(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>New announcement</h2>
              <button onClick={() => setShowCompose(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(['general', 'safety', 'urgent', 'update'] as const).map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{ padding: '8px', borderRadius: 8, border: form.type === t ? `1px solid ${TYPE_CFG[t].color}` : '1px solid rgba(255,255,255,0.1)', background: form.type === t ? TYPE_CFG[t].bg : 'rgba(255,255,255,0.02)', color: form.type === t ? TYPE_CFG[t].color : '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {TYPE_CFG[t].label}
                  </button>
                ))}
              </div>
              {(form.type === 'urgent' || form.type === 'safety') && (
                <div style={{ marginTop: 6, fontFamily: SF, fontSize: 11, color: '#f59e0b' }}>Urgent & Safety announcements are pinned automatically.</div>
              )}
            </div>

            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" style={inputStyle} />
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="What's the message?" rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />

            <div>
              <label style={labelStyle}>Scope (optional)</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Whole workspace —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <button onClick={post} disabled={saving || !form.title.trim() || !form.body.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() || !form.body.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Posting…' : <><IcCheck size={16} color="#fff" /> Post</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ a, onPin, onDelete, confirmDelete }: { a: Announcement; onPin: (a: Announcement) => void; onDelete: (id: string) => void; confirmDelete: string | null }) {
  const cfg = TYPE_CFG[a.type]
  return (
    <div style={{ background: '#152641', borderRadius: 14, padding: '14px', border: `0.5px solid ${a.isPinned ? `${cfg.color}55` : 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontFamily: SF, fontSize: 9, fontWeight: 800, border: `1px solid ${cfg.color}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</span>
        {a.project && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{a.project.name}</span>}
        <span style={{ marginLeft: 'auto', fontFamily: SF, fontSize: 11, color: '#52749a' }}>{new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
      </div>
      <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.2 }}>{a.title}</div>
      <div style={{ fontFamily: SF, fontSize: 13, color: '#c1d2e8', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{a.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {a.authorName && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>— {a.authorName}</span>}
        <button onClick={() => onPin(a)} aria-label={a.isPinned ? 'Unpin' : 'Pin'} style={{ marginLeft: 'auto', background: a.isPinned ? `${cfg.color}22` : 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IcPin size={11} color={a.isPinned ? cfg.color : '#52749a'} />
          <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: a.isPinned ? cfg.color : '#52749a' }}>{a.isPinned ? 'Pinned' : 'Pin'}</span>
        </button>
        <button onClick={() => onDelete(a.id)} aria-label={confirmDelete === a.id ? 'Confirm delete' : 'Delete'} style={{ background: confirmDelete === a.id ? 'rgba(239,68,68,0.18)' : 'transparent', border: 'none', borderRadius: 4, padding: confirmDelete === a.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IcTrash size={11} color="#ef4444" />
          {confirmDelete === a.id && <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Sure?</span>}
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

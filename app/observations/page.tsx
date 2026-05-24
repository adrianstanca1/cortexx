'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcAlert, IcChevL, IcPlus, IcX, IcCheck, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
interface Observation {
  id: string
  projectId: string
  type: 'positive' | 'improvement' | 'unsafe' | 'near_miss'
  title: string
  description: string | null
  location: string | null
  reportedBy: string | null
  photoUrl: string | null
  status: 'open' | 'resolved'
  resolvedAt: string | null
  createdAt: string
  project?: Project | null
}

const SF = 'var(--font-system)'

const TYPE_CFG: Record<Observation['type'], { label: string; color: string; bg: string; emoji: string }> = {
  positive:    { label: 'Positive',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  emoji: '👍' },
  improvement: { label: 'Improvement', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', emoji: '💡' },
  unsafe:      { label: 'Unsafe act',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  emoji: '⚠️' },
  near_miss:   { label: 'Near miss',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', emoji: '🚨' },
}

export default function ObservationsPage() {
  const [items, setItems] = useState<Observation[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [unsafeOpenCount, setUnsafeOpenCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Observation['type']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Observation['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    type: 'positive' as Observation['type'],
    projectId: '',
  })

  useModalEffects(showAdd, () => setShowAdd(false))

  const load = useCallback(() => {
    fetch('/api/observations')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
      .then(d => { setItems(d.observations || []); setOpenCount(d.openCount || 0); setUnsafeOpenCount(d.unsafeOpenCount || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
      setProjects(ps)
      setForm(prev => prev.projectId ? prev : { ...prev, projectId: ps[0]?.id || '' })
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.title.trim() || !form.projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          type: form.type,
          projectId: form.projectId,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, title: '', description: '', location: '', type: 'positive' }))
      load()
      setToast({ msg: 'Observation logged' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to log', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleResolved = async (o: Observation) => {
    try {
      const res = await fetch(`/api/observations/${o.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: o.status === 'open' ? 'resolved' : 'open' }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Status change failed', type: 'error' })
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
      const res = await fetch(`/api/observations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const filtered = items
    .filter(i => filter === 'all' || i.type === filter)
    .filter(i => statusFilter === 'all' || i.status === statusFilter)

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Observations</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {items.length} total · {openCount} open
              {unsafeOpenCount > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· {unsafeOpenCount} unsafe / near-miss open</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Log observation" disabled={projects.length === 0} style={{ width: 36, height: 36, borderRadius: 10, background: projects.length === 0 ? 'rgba(34,197,94,0.3)' : '#22c55e', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: projects.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
          {(['all', 'positive', 'improvement', 'unsafe', 'near_miss'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#22c55e' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : TYPE_CFG[t].label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'open', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 99, border: '0.5px solid rgba(255,255,255,0.1)', background: statusFilter === s ? 'rgba(255,255,255,0.1)' : 'transparent', color: statusFilter === s ? '#eef3fa' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: statusFilter === s ? 700 : 400, cursor: 'pointer' }}>
              {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Resolved'}
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
          <IcAlert size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{items.length === 0 ? 'No observations logged yet' : 'Nothing in this filter'}</p>
          {items.length === 0 && projects.length > 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#22c55e', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Log first observation
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(o => {
            const cfg = TYPE_CFG[o.type]
            return (
              <div key={o.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', opacity: o.status === 'resolved' ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontFamily: SF, fontSize: 9, fontWeight: 800, border: `1px solid ${cfg.color}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</span>
                  {o.project && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>· {o.project.name}</span>}
                  <span style={{ marginLeft: 'auto', fontFamily: SF, fontSize: 10, color: o.status === 'resolved' ? '#10b981' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>{o.status}</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', textDecoration: o.status === 'resolved' ? 'line-through' : 'none' }}>{o.title}</div>
                {o.description && <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2, lineHeight: 1.35 }}>{o.description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  {o.location && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{o.location}</span>}
                  {o.reportedBy && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>— {o.reportedBy}</span>}
                  <button onClick={() => toggleResolved(o)} style={{ marginLeft: 'auto', background: o.status === 'resolved' ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.18)', border: `0.5px solid ${o.status === 'resolved' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`, color: o.status === 'resolved' ? '#f59e0b' : '#10b981', borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {o.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </button>
                  <button onClick={() => remove(o.id)} aria-label={confirmDelete === o.id ? 'Confirm delete' : 'Delete'} style={{ background: confirmDelete === o.id ? 'rgba(239,68,68,0.18)' : 'transparent', border: 'none', borderRadius: 4, padding: confirmDelete === o.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IcTrash size={11} color="#ef4444" />
                    {confirmDelete === o.id && <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Sure?</span>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>Log observation</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {(['positive', 'improvement', 'unsafe', 'near_miss'] as const).map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{ padding: '8px', borderRadius: 8, border: form.type === t ? `1px solid ${TYPE_CFG[t].color}` : '1px solid rgba(255,255,255,0.1)', background: form.type === t ? TYPE_CFG[t].bg : 'rgba(255,255,255,0.02)', color: form.type === t ? TYPE_CFG[t].color : '#8ea8c5', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {TYPE_CFG[t].emoji} {TYPE_CFG[t].label}
                  </button>
                ))}
              </div>
            </div>

            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What did you see?" style={inputStyle} />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detail (optional)" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Where (e.g. Level 2 corridor)" style={inputStyle} />

            <div>
              <label style={labelStyle}>Project</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <button onClick={create} disabled={saving || !form.title.trim() || !form.projectId} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: TYPE_CFG[form.type].color, border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() || !form.projectId ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Log observation</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

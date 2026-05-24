'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcAlert, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSend } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
interface Rfi {
  id: string
  number: string
  subject: string
  body: string
  projectId: string
  status: 'open' | 'answered' | 'closed'
  priority: 'low' | 'medium' | 'high'
  raisedBy: string | null
  assignee: string | null
  dueDate: string | null
  response: string | null
  respondedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  project?: Project | null
}

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<Rfi['status'], string> = { open: '#3b82f6', answered: '#10b981', closed: '#6b7280' }
const STATUS_LABEL: Record<Rfi['status'], string> = { open: 'Open', answered: 'Answered', closed: 'Closed' }
const PRIORITY_COLOR: Record<Rfi['priority'], string> = { low: '#52749a', medium: '#06b6d4', high: '#ef4444' }
const COMMON_ASSIGNEES = ['Structural Engineer', 'Architect', 'Civil Engineer', 'M&E Engineer', 'Quantity Surveyor', 'Client']

export default function RfisPage() {
  const [rfis, setRfis] = useState<Rfi[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Rfi['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeRfi, setActiveRfi] = useState<Rfi | null>(null)
  const [saving, setSaving] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    subject: '',
    body: '',
    projectId: '',
    priority: 'medium' as Rfi['priority'],
    assignee: '',
    dueDate: '',
  })

  useModalEffects(showAdd || activeRfi !== null, () => { setShowAdd(false); setActiveRfi(null) })

  const load = useCallback(() => {
    fetch('/api/rfis')
      .then(r => { if (!r.ok) throw new Error('Failed to load RFIs'); return r.json() })
      .then(d => { setRfis(d.rfis || []); setOpenCount(d.openCount || 0); setOverdueCount(d.overdueCount || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
      setProjects(ps)
      setForm(prev => prev.projectId ? prev : { ...prev, projectId: ps[0]?.id || '' })
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const isOverdue = (r: Rfi) => r.status !== 'closed' && r.dueDate && new Date(r.dueDate) < new Date()

  const create = async () => {
    if (!form.subject.trim() || !form.body.trim() || !form.projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/rfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject.trim(),
          body: form.body.trim(),
          projectId: form.projectId,
          priority: form.priority,
          assignee: form.assignee.trim() || null,
          dueDate: form.dueDate || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, subject: '', body: '', assignee: '', dueDate: '', priority: 'medium' }))
      load()
      setToast({ msg: 'RFI raised' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to raise RFI', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const answer = async () => {
    if (!activeRfi || !responseText.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/rfis/${activeRfi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText.trim(), status: 'answered' }),
      })
      if (!res.ok) throw new Error('Failed')
      setActiveRfi(null)
      setResponseText('')
      load()
      setToast({ msg: 'RFI answered' })
    } catch {
      setToast({ msg: 'Failed to answer', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (rfi: Rfi) => {
    const next: Rfi['status'] =
      rfi.status === 'open' ? (rfi.response ? 'answered' : 'closed')
      : rfi.status === 'answered' ? 'closed'
      : 'open'
    try {
      const res = await fetch(`/api/rfis/${rfi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
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
      const res = await fetch(`/api/rfis/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveRfi(null)
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const filtered = filter === 'all' ? rfis : rfis.filter(r => r.status === filter)

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>RFIs</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {rfis.length} total · {openCount} open
              {overdueCount > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· {overdueCount} overdue</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Raise RFI" disabled={projects.length === 0} style={{ width: 36, height: 36, borderRadius: 10, background: projects.length === 0 ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: projects.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'open', 'answered', 'closed'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
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
          <p style={{ marginTop: 12, fontSize: 14 }}>{rfis.length === 0 ? 'No RFIs raised yet' : 'Nothing in this filter'}</p>
          {rfis.length === 0 && projects.length > 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Raise first RFI
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <button key={r.id} onClick={() => { setActiveRfi(r); setResponseText(r.response || '') }} style={{ background: '#152641', borderRadius: 14, padding: '14px', border: `0.5px solid ${isOverdue(r) ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: '#52749a', letterSpacing: 0.5 }}>{r.number}</span>
                <span style={{ fontFamily: SF, fontSize: 9, fontWeight: 800, color: PRIORITY_COLOR[r.priority], textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.priority}</span>
                {r.project && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>· {r.project.name}</span>}
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[r.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', textDecoration: r.status === 'closed' ? 'line-through' : 'none' }}>{r.subject}</div>
              {(r.assignee || r.dueDate) && (
                <div style={{ display: 'flex', gap: 10, fontFamily: SF, fontSize: 11, color: isOverdue(r) ? '#ef4444' : '#52749a' }}>
                  {r.assignee && <span>→ {r.assignee}</span>}
                  {r.dueDate && <span>{isOverdue(r) ? 'Overdue ' : 'Due '}{new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>Raise RFI</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" style={inputStyle} />
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="What needs clarifying? Include drawing refs, spec sections, photos if relevant." rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Project</label>
                <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Rfi['priority'] }))} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Ball-in-court</label>
              <input value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} placeholder="e.g. Structural Engineer" list="rfi-assignees" style={inputStyle} />
              <datalist id="rfi-assignees">
                {COMMON_ASSIGNEES.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>

            <div>
              <label style={labelStyle}>Response needed by</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <button onClick={create} disabled={saving || !form.subject.trim() || !form.body.trim() || !form.projectId} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.subject.trim() || !form.body.trim() || !form.projectId ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Raising…' : <><IcCheck size={16} color="#fff" /> Raise RFI</>}
            </button>
          </div>
        </div>
      )}

      {activeRfi && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveRfi(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700, letterSpacing: 0.5 }}>{activeRfi.number}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF, marginTop: 2 }}>{activeRfi.subject}</h2>
              </div>
              <button onClick={() => setActiveRfi(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 9px', borderRadius: 99, background: `${STATUS_COLOR[activeRfi.status]}22`, color: STATUS_COLOR[activeRfi.status], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${STATUS_COLOR[activeRfi.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[activeRfi.status]}</span>
              <span style={{ padding: '3px 9px', borderRadius: 99, background: `${PRIORITY_COLOR[activeRfi.priority]}22`, color: PRIORITY_COLOR[activeRfi.priority], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${PRIORITY_COLOR[activeRfi.priority]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{activeRfi.priority}</span>
              {activeRfi.assignee && <span style={{ padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#8ea8c5', fontFamily: SF, fontSize: 10 }}>→ {activeRfi.assignee}</span>}
              {activeRfi.dueDate && <span style={{ padding: '3px 9px', borderRadius: 99, background: isOverdue(activeRfi) ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)', color: isOverdue(activeRfi) ? '#ef4444' : '#8ea8c5', fontFamily: SF, fontSize: 10 }}>{isOverdue(activeRfi) ? 'Overdue ' : 'Due '}{new Date(activeRfi.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            </div>

            <div style={{ background: '#1a2f4e', padding: '12px 14px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Question</div>
              <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{activeRfi.body}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 8 }}>
                Raised{activeRfi.raisedBy ? ` by ${activeRfi.raisedBy}` : ''} · {new Date(activeRfi.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            {activeRfi.status !== 'closed' ? (
              <div>
                <label style={labelStyle}>Response</label>
                <textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder={activeRfi.response ? 'Update the existing response…' : 'Answer here…'} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
                <button onClick={answer} disabled={saving || !responseText.trim()} style={{ marginTop: 8, padding: '10px 0', borderRadius: 10, background: '#10b981', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving || !responseText.trim() ? 0.5 : 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <IcSend size={13} color="#fff" /> {saving ? 'Sending…' : (activeRfi.response ? 'Update answer' : 'Answer & mark answered')}
                </button>
              </div>
            ) : activeRfi.response ? (
              <div style={{ background: 'rgba(16,185,129,0.08)', padding: '12px 14px', borderRadius: 10, border: '0.5px solid rgba(16,185,129,0.3)' }}>
                <div style={{ ...labelStyle, color: '#10b981', marginBottom: 4 }}>Answer</div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{activeRfi.response}</div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => cycleStatus(activeRfi)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#8ea8c5', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {activeRfi.status === 'open' ? 'Mark closed' : activeRfi.status === 'answered' ? 'Mark closed' : 'Reopen'}
              </button>
              <button onClick={() => remove(activeRfi.id)} style={{ padding: '10px 14px', borderRadius: 10, background: confirmDelete === activeRfi.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeRfi.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={12} color="#ef4444" />
                {confirmDelete === activeRfi.id ? 'Sure?' : 'Delete'}
              </button>
            </div>
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

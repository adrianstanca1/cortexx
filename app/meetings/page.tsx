'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcClock, IcChevL, IcPlus, IcX, IcTrash, IcCheck } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface ActionItem { id: string; title: string; assignee?: string; dueDate?: string; done?: boolean }
interface Meeting {
  id: string
  projectId: string | null
  title: string
  location: string | null
  scheduledAt: string
  durationMin: number
  attendees: string | null
  minutes: string | null
  actionItems: ActionItem[]
  status: 'scheduled' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const STATUS_COLOR: Record<Meeting['status'], string> = {
  scheduled: '#06b6d4', completed: '#10b981', cancelled: '#52749a',
}
const SF = 'var(--font-system)'

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Meeting['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newAction, setNewAction] = useState('')

  const [form, setForm] = useState({
    title: '', projectId: '', location: '', scheduledAt: '', durationMin: 60, attendees: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [mRes, prjRes] = await Promise.all([
        fetch(`/api/meetings?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!mRes.ok) throw new Error('Failed to load meetings')
      const md = await mRes.json()
      setMeetings(md.meetings || [])
      if (prjRes.ok) {
        const pd = await prjRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1)
    const iso = now.toISOString().slice(0, 16)
    setForm({ title: '', projectId: '', location: '', scheduledAt: iso, durationMin: 60, attendees: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.scheduledAt) return setToast({ msg: 'Pick a time', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          projectId: form.projectId || undefined,
          location: form.location.trim() || undefined,
          scheduledAt: form.scheduledAt,
          durationMin: form.durationMin,
          attendees: form.attendees.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Meeting scheduled', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const update = async (m: Meeting, patch: Partial<Meeting>) => {
    try {
      const res = await fetch(`/api/meetings/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const addAction = (m: Meeting) => {
    if (!newAction.trim()) return
    const next: ActionItem[] = [...m.actionItems, { id: `act-${Date.now()}`, title: newAction.trim() }]
    setNewAction('')
    update(m, { actionItems: next })
  }
  const toggleAction = (m: Meeting, id: string) => {
    const next = m.actionItems.map(a => a.id === id ? { ...a, done: !a.done } : a)
    update(m, { actionItems: next })
  }
  const removeAction = (m: Meeting, id: string) => {
    update(m, { actionItems: m.actionItems.filter(a => a.id !== id) })
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IcClock size={20} color="#06b6d4" /> Meetings
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {meetings.filter(m => m.status === 'scheduled' && new Date(m.scheduledAt) > new Date()).length} upcoming
            </p>
          </div>
          <button onClick={openAdd} aria-label="Schedule meeting" style={{ background: '#06b6d4', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Schedule</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ background: statusFilter === s ? '#06b6d4' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: statusFilter === s ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && meetings.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No meetings yet. Schedule one to track minutes and actions.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {meetings.map(m => {
          const isOpen = expanded === m.id
          const when = new Date(m.scheduledAt)
          const openActions = m.actionItems.filter(a => !a.done).length
          return (
            <div key={m.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
              <div onClick={() => setExpanded(isOpen ? null : m.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ background: STATUS_COLOR[m.status] + '33', color: STATUS_COLOR[m.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{m.status}</span>
                  {openActions > 0 && <span style={{ color: '#f59e0b', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{openActions} OPEN</span>}
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                  {when.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {m.durationMin} min
                  {m.location ? ` · ${m.location}` : ''}
                  {m.project ? ` · ${m.project.name}` : ''}
                </div>
              </div>

              {isOpen && (
                <>
                  {m.attendees && (
                    <div style={{ marginTop: 10, background: '#0a1426', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Attendees</div>
                      <div style={{ fontFamily: SF, fontSize: 12, color: '#c1d2e8', whiteSpace: 'pre-wrap' }}>{m.attendees}</div>
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Minutes</div>
                    <textarea value={m.minutes || ''} onChange={e => setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, minutes: e.target.value } : x))} onBlur={e => update(m, { minutes: e.target.value })} placeholder="Add minutes…" rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Action items</div>
                    {m.actionItems.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: a.done ? '#0a1426' : '#1a2f4e', borderRadius: 6, marginBottom: 4 }}>
                        <button onClick={() => toggleAction(m, a.id)} style={{ width: 18, height: 18, borderRadius: 4, border: '0.5px solid rgba(255,255,255,0.2)', background: a.done ? '#10b981' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {a.done && <IcCheck size={11} color="#fff" />}
                        </button>
                        <span style={{ flex: 1, fontFamily: SF, fontSize: 12, color: a.done ? '#52749a' : '#c1d2e8', textDecoration: a.done ? 'line-through' : 'none' }}>{a.title}</span>
                        {a.assignee && <span style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5' }}>@{a.assignee}</span>}
                        <button onClick={() => removeAction(m, a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}><IcTrash size={11} color="#52749a" /></button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input type="text" value={newAction} onChange={e => setNewAction(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAction(m) }} placeholder="New action…" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => addAction(m)} style={{ background: '#06b6d4', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {m.status !== 'completed' && <button onClick={() => update(m, { status: 'completed' })} style={pillBtn('#10b981')}>Mark completed</button>}
                    {m.status !== 'cancelled' && m.status !== 'completed' && <button onClick={() => update(m, { status: 'cancelled' })} style={pillBtn('#1a2f4e', '#c1d2e8')}>Cancel</button>}
                    <button onClick={() => setConfirmDelete(m.id)} aria-label="Delete" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                      <IcTrash size={11} color="#fca5a5" /> Delete
                    </button>
                  </div>
                </>
              )}

              {confirmDelete === m.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this meeting?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(m.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', width: '100%', maxHeight: '85vh', borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Schedule meeting</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Title *">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Weekly progress catch-up" />
              </Field>
              <Field label="Project (optional)">
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">— None —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <Field label="Date & time *">
                  <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" min="5" max="480" step="5" value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: Number(e.target.value) || 60 }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Location">
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="Site office / Teams / address" />
              </Field>
              <Field label="Attendees (one per line)">
                <textarea value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#06b6d4', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <TabBar />
    </div>
  )
}

const inputStyle = { background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#eef3fa', fontFamily: SF, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600, marginBottom: 4 }}>{label}</label>{children}</div>
}
function pillBtn(bg: string, color = '#fff', borderColor = 'rgba(255,255,255,0.1)'): React.CSSProperties {
  return { background: bg, border: `0.5px solid ${borderColor}`, borderRadius: 8, padding: '6px 10px', color, fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }
}

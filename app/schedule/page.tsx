'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcClock, IcChevL, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Milestone {
  id: string
  projectId: string
  title: string
  plannedStart: string
  plannedEnd: string
  actualEnd: string | null
  status: 'planned' | 'in_progress' | 'complete' | 'slipped'
  notes: string | null
  project?: { id: string; name: string; status: string } | null
}

interface Project { id: string; name: string }

const STATUS_COLOR: Record<Milestone['status'], string> = {
  planned: '#52749a',
  in_progress: '#06b6d4',
  complete: '#10b981',
  slipped: '#ef4444',
}
const STATUS_LABEL: Record<Milestone['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  complete: 'Complete',
  slipped: 'Slipped',
}
const SF = 'var(--font-system)'
const DAY = 1000 * 60 * 60 * 24
const WEEK_PX = 70 // visual width of one week in the Gantt

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay() || 7 // Sun=0 → 7
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - (day - 1))
  return x
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}

export default function SchedulePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [weeksAhead, setWeeksAhead] = useState(12)

  const [form, setForm] = useState({
    projectId: '',
    title: '',
    plannedStart: isoDate(new Date()),
    plannedEnd: isoDate(addDays(new Date(), 7)),
    status: 'planned' as Milestone['status'],
    notes: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const ganttStart = useMemo(() => startOfWeek(addDays(today, -7)), [today])
  const ganttEnd = useMemo(() => addDays(ganttStart, weeksAhead * 7), [ganttStart, weeksAhead])

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('from', isoDate(addDays(ganttStart, -7)))
      params.set('to', isoDate(addDays(ganttEnd, 7)))
      const [msRes, pRes] = await Promise.all([
        fetch(`/api/milestones?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!msRes.ok) throw new Error('Failed to load schedule')
      const msData = await msRes.json()
      setMilestones(msData.milestones || [])
      if (pRes.ok) {
        const pd = await pRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [ganttStart, ganttEnd])

  useEffect(() => { load() }, [load])

  // Auto-flag milestones whose plannedEnd is in the past and not complete.
  const enriched = useMemo(() => milestones.map(m => {
    const end = new Date(m.plannedEnd)
    if (m.status !== 'complete' && end < today && m.status !== 'slipped') {
      return { ...m, status: 'slipped' as const }
    }
    return m
  }), [milestones, today])

  // Group by project so each row is a horizontal track.
  const grouped = useMemo(() => {
    const map = new Map<string, { project: { id: string; name: string }; items: Milestone[] }>()
    for (const m of enriched) {
      const key = m.projectId
      const projName = m.project?.name || `Project ${m.projectId.slice(0, 6)}`
      if (!map.has(key)) map.set(key, { project: { id: key, name: projName }, items: [] })
      map.get(key)!.items.push(m)
    }
    return Array.from(map.values()).sort((a, b) => a.project.name.localeCompare(b.project.name))
  }, [enriched])

  const totalDays = Math.round((ganttEnd.getTime() - ganttStart.getTime()) / DAY)
  const totalWidth = (totalDays / 7) * WEEK_PX

  const openAdd = () => {
    setForm({ projectId: projects[0]?.id || '', title: '', plannedStart: isoDate(today), plannedEnd: isoDate(addDays(today, 7)), status: 'planned', notes: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.projectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Milestone added', type: 'success' })
      setShowModal(false)
      load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (m: Milestone) => {
    const next: Milestone['status'] = m.status === 'planned' ? 'in_progress' : m.status === 'in_progress' ? 'complete' : 'planned'
    try {
      const res = await fetch(`/api/milestones/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
      load()
    } catch {
      setToast({ msg: 'Failed to update', type: 'error' })
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/milestones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null)
      load()
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
              <IcClock size={20} color="#06b6d4" /> Schedule
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {enriched.length} milestones across {grouped.length} projects · next {weeksAhead}w
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add milestone" style={{ background: '#06b6d4', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Add</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5' }}>Horizon</span>
        {[4, 8, 12, 26].map(w => (
          <button key={w} onClick={() => setWeeksAhead(w)} style={{ background: weeksAhead === w ? '#06b6d4' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '4px 10px', color: weeksAhead === w ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {w}w
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && enriched.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No milestones yet. Add one to start building the program.</div>
      )}

      {grouped.length > 0 && (
        <div style={{ overflowX: 'auto', padding: '0 16px' }}>
          <div style={{ minWidth: 200 + totalWidth }}>
            {/* week headers */}
            <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: '#06101e', zIndex: 10 }}>
              <div style={{ width: 200, flexShrink: 0, padding: '8px 10px', fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 600 }}>Project</div>
              <div style={{ display: 'flex', position: 'relative' }}>
                {Array.from({ length: weeksAhead + 1 }).map((_, i) => {
                  const wk = addDays(ganttStart, i * 7)
                  const isToday = wk.getTime() <= today.getTime() && addDays(wk, 7).getTime() > today.getTime()
                  return (
                    <div key={i} style={{ width: WEEK_PX, flexShrink: 0, padding: '8px 4px', fontFamily: SF, fontSize: 10, color: isToday ? '#06b6d4' : '#52749a', fontWeight: isToday ? 700 : 500, borderLeft: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                      {wk.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* rows */}
            {grouped.map(({ project, items }) => (
              <div key={project.id} style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.05)', minHeight: 56 }}>
                <div style={{ width: 200, flexShrink: 0, padding: '10px 10px', fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                <div style={{ position: 'relative', flex: 1 }}>
                  {/* today marker */}
                  {(() => {
                    const offset = Math.max(0, Math.round((today.getTime() - ganttStart.getTime()) / DAY))
                    const x = (offset / 7) * WEEK_PX
                    if (x < 0 || x > totalWidth) return null
                    return <div style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, background: '#06b6d4', opacity: 0.5 }} />
                  })()}
                  {items.map(m => {
                    const start = new Date(m.plannedStart); start.setHours(0, 0, 0, 0)
                    const end = new Date(m.plannedEnd); end.setHours(0, 0, 0, 0)
                    const startOffset = Math.max(0, (start.getTime() - ganttStart.getTime()) / DAY)
                    const days = Math.max(1, (end.getTime() - start.getTime()) / DAY + 1)
                    const x = (startOffset / 7) * WEEK_PX
                    const w = (days / 7) * WEEK_PX
                    if (x > totalWidth || x + w < 0) return null
                    const color = STATUS_COLOR[m.status]
                    return (
                      <button
                        key={m.id}
                        onClick={() => cycleStatus(m)}
                        title={`${m.title} · ${STATUS_LABEL[m.status]} · ${m.plannedStart.slice(0,10)} → ${m.plannedEnd.slice(0,10)}\n(tap to cycle status)`}
                        style={{ position: 'absolute', left: x, top: 10, height: 24, width: Math.max(20, w - 2), background: color + 'cc', border: `1px solid ${color}`, borderRadius: 6, padding: '0 8px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      >{m.title}</button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* delete confirm tray */}
      {confirmDelete && (
        <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, padding: 12, background: 'rgba(239,68,68,0.95)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, zIndex: 50 }}>
          <span style={{ fontFamily: SF, fontSize: 13, color: '#fff' }}>Delete this milestone?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid #fff', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => remove(confirmDelete)} style={{ background: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      )}

      {/* milestone list under the chart for accessibility */}
      <div style={{ padding: '20px 16px 0' }}>
        <h2 style={{ fontFamily: SF, fontSize: 14, color: '#8ea8c5', fontWeight: 600, marginBottom: 10 }}>All milestones</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {enriched.map(m => (
            <div key={m.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.title}
                </div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                  {m.project?.name || '—'} · {new Date(m.plannedStart).toLocaleDateString('en-GB')} → {new Date(m.plannedEnd).toLocaleDateString('en-GB')}
                </div>
              </div>
              <span style={{ background: STATUS_COLOR[m.status] + '33', border: `0.5px solid ${STATUS_COLOR[m.status]}66`, color: STATUS_COLOR[m.status], padding: '2px 7px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>
                {STATUS_LABEL[m.status]}
              </span>
              <button onClick={() => setConfirmDelete(m.id)} aria-label="Delete milestone" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                <IcTrash size={13} color="#52749a" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', width: '100%', maxHeight: '85vh', borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Add milestone</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Project *">
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Title *">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="First fix complete" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Planned start">
                  <input type="date" value={form.plannedStart} onChange={e => setForm(f => ({ ...f, plannedStart: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Planned end">
                  <input type="date" value={form.plannedEnd} onChange={e => setForm(f => ({ ...f, plannedEnd: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Status">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['planned', 'in_progress', 'complete', 'slipped'] as const).map(s => (
                    <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{ background: form.status === s ? STATUS_COLOR[s] : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.status === s ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#06b6d4', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save milestone'}
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
  return (
    <div>
      <label style={{ display: 'block', fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

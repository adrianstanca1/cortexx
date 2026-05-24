'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcHardhat, IcChevL, IcPlus, IcX, IcTrash, IcCheck } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Talk {
  id: string
  projectId: string | null
  date: string
  topic: string
  location: string | null
  deliveredBy: string | null
  attendees: string | null
  attendeeCount: number
  hazardsCovered: string | null
  notes: string | null
  signedOff: boolean
  signedAt: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const SF = 'var(--font-system)'
const niceDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const isoLocal = (d: Date) => {
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export default function ToolboxTalksPage() {
  const [talks, setTalks] = useState<Talk[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monthCount, setMonthCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [form, setForm] = useState({
    projectId: '', date: '', topic: '', location: '',
    attendees: '', hazardsCovered: '', notes: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/toolbox-talks'),
        fetch('/api/projects?status=active'),
      ])
      if (!tRes.ok) throw new Error('Failed to load')
      const td = await tRes.json()
      setTalks(td.talks || [])
      setMonthCount(td.monthCount || 0)
      if (pRes.ok) {
        const pd = await pRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ projectId: '', date: isoLocal(new Date()), topic: '', location: '', attendees: '', hazardsCovered: '', notes: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.topic.trim()) return setToast({ msg: 'Topic required', type: 'error' })
    if (!form.date) return setToast({ msg: 'Date required', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/toolbox-talks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          projectId: form.projectId || undefined,
          location: form.location || undefined,
          attendees: form.attendees || undefined,
          hazardsCovered: form.hazardsCovered || undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Talk logged', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const toggleSignOff = async (t: Talk) => {
    try {
      const res = await fetch(`/api/toolbox-talks/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedOff: !t.signedOff }),
      })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/toolbox-talks/${id}`, { method: 'DELETE' })
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
              <IcHardhat size={20} color="#f59e0b" /> Toolbox talks
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {monthCount} this month · {talks.length} total
            </p>
          </div>
          <button onClick={openAdd} aria-label="Log talk" style={{ background: '#f59e0b', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Log</span>
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && talks.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No toolbox talks yet. Log one to start your safety record.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px' }}>
        {talks.map(t => {
          const isOpen = expanded === t.id
          return (
            <div key={t.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
              <div onClick={() => setExpanded(isOpen ? null : t.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ background: '#1a2f4e', color: '#c1d2e8', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{niceDate(t.date)}</span>
                  {t.signedOff && <span style={{ color: '#10b981', fontFamily: SF, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><IcCheck size={10} color="#10b981" /> Signed</span>}
                  <span style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{t.attendeeCount} attendees</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{t.topic}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                  {t.project?.name || '—'}{t.location ? ` · ${t.location}` : ''}{t.deliveredBy ? ` · ${t.deliveredBy}` : ''}
                </div>
              </div>
              {isOpen && (
                <>
                  {t.attendees && (
                    <Section label="Attendees" body={t.attendees} />
                  )}
                  {t.hazardsCovered && (
                    <Section label="Hazards covered" body={t.hazardsCovered} />
                  )}
                  {t.notes && (
                    <Section label="Notes" body={t.notes} />
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => toggleSignOff(t)} style={pillBtn(t.signedOff ? '#1a2f4e' : '#10b981', t.signedOff ? '#c1d2e8' : '#fff')}>
                      {t.signedOff ? 'Un-sign' : 'Sign off'}
                    </button>
                    <button onClick={() => setConfirmDelete(t.id)} aria-label="Delete" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                      <IcTrash size={11} color="#fca5a5" /> Delete
                    </button>
                  </div>
                </>
              )}
              {confirmDelete === t.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this talk?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(t.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Log toolbox talk</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Project (optional)">
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">— None —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Topic *">
                  <input type="text" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} style={inputStyle} placeholder="Working at height" />
                </Field>
                <Field label="Date *">
                  <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Location">
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="Site office, block A" />
              </Field>
              <Field label="Attendees (one per line)">
                <textarea value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="John Smith\nJane Doe" />
              </Field>
              <Field label="Hazards covered">
                <textarea value={form.hazardsCovered} onChange={e => setForm(f => ({ ...f, hazardsCovered: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Fall from height, slippery surface" />
              </Field>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#f59e0b', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Log talk'}
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

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ marginTop: 10, background: '#0a1426', borderRadius: 8, padding: 10 }}>
      <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: SF, fontSize: 12, color: '#c1d2e8', whiteSpace: 'pre-wrap' }}>{body}</div>
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

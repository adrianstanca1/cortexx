'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcAlert, IcPlus, IcX, IcCheck, IcTrash, IcHardhat } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
type IncidentType = 'near_miss' | 'first_aid' | 'accident' | 'dangerous_occurrence' | 'environmental' | 'security'
type Severity = 'near_miss' | 'low' | 'medium' | 'high' | 'critical'
type Status = 'open' | 'investigating' | 'closed'

interface Incident {
  id: string
  projectId: string | null
  title: string
  description: string | null
  type: IncidentType
  severity: Severity
  status: Status
  location: string | null
  reportedBy: string | null
  injuredParty: string | null
  photoUrl: string | null
  riddorReportable: boolean
  occurredAt: string
  closedAt: string | null
  notes: string | null
  project?: Project | null
}

const SF = 'var(--font-system)'
const TYPE_LABEL: Record<IncidentType, string> = {
  near_miss: 'Near miss',
  first_aid: 'First aid',
  accident: 'Accident',
  dangerous_occurrence: 'Dangerous occurrence',
  environmental: 'Environmental',
  security: 'Security',
}
const TYPES: IncidentType[] = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security']
const SEVERITIES: Severity[] = ['near_miss', 'low', 'medium', 'high', 'critical']
const SEVERITY_COLOR: Record<Severity, string> = {
  near_miss: '#52749a',
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
}
const STATUS_COLOR: Record<Status, string> = {
  open: '#ef4444',
  investigating: '#f59e0b',
  closed: '#10b981',
}
const STATUS_LABEL: Record<Status, string> = { open: 'Open', investigating: 'Investigating', closed: 'Closed' }

export default function SafetyPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [ridorCount, setRidorCount] = useState(0)
  const [daysWithout, setDaysWithout] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [active, setActive] = useState<Incident | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', type: 'near_miss' as IncidentType, severity: 'low' as Severity,
    projectId: '', location: '', reportedBy: '', injuredParty: '', notes: '',
    occurredAt: new Date().toISOString().slice(0, 16), riddorReportable: false,
  })

  useModalEffects(showAdd || active !== null, () => { setShowAdd(false); setActive(null) })

  const load = useCallback(() => {
    const qs = filter === 'all' ? '' : `?status=${filter}`
    fetch(`/api/safety${qs}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => {
        setIncidents(d.incidents || [])
        setOpenCount(d.openCount || 0)
        setRidorCount(d.ridorCount || 0)
        setDaysWithout(d.daysWithoutIncident || 0)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setProjects((d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
  }, [filter])
  useEffect(() => { load() }, [load])

  // RIDDOR auto-suggest when type or severity changes — accident /
  // dangerous-occurrence / critical are RIDDOR-reportable in UK law.
  useEffect(() => {
    const auto = form.type === 'accident' || form.type === 'dangerous_occurrence' || form.severity === 'critical'
    if (auto && !form.riddorReportable) setForm(p => ({ ...p, riddorReportable: true }))
  }, [form.type, form.severity, form.riddorReportable])

  const create = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          projectId: form.projectId || null,
          occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ title: '', description: '', type: 'near_miss', severity: 'low', projectId: '', location: '', reportedBy: '', injuredParty: '', notes: '', occurredAt: new Date().toISOString().slice(0, 16), riddorReportable: false })
      load()
      setToast({ msg: 'Incident logged' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const changeStatus = async (i: Incident, next: Status) => {
    try {
      const res = await fetch(`/api/safety/${i.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setIncidents(prev => prev.map(x => x.id === i.id ? updated : x))
      if (active?.id === i.id) setActive(updated)
      setToast({ msg: `Marked ${STATUS_LABEL[next].toLowerCase()}` })
    } catch {
      setToast({ msg: 'Failed to update', type: 'error' })
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
      const res = await fetch(`/api/safety/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setIncidents(prev => prev.filter(x => x.id !== id))
      setActive(null)
      setToast({ msg: 'Incident deleted' })
    } catch {
      setToast({ msg: 'Failed to delete', type: 'error' })
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Safety</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>Incident register · RIDDOR-aware</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: '#ef4444', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <IcPlus size={12} color="#fff" /> Log incident
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ padding: '14px 16px 8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <KPI icon={<IcHardhat size={14} color="#10b981" />} label="Days since" value={String(daysWithout)} color="#10b981" />
        <KPI icon={<IcAlert size={14} color="#ef4444" />} label="Open" value={String(openCount)} color="#ef4444" />
        <KPI icon={<IcAlert size={14} color="#f59e0b" />} label="RIDDOR" value={String(ridorCount)} color="#f59e0b" />
      </div>

      {/* Filter chips */}
      <div style={{ padding: '4px 16px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'open', 'investigating', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ padding: '6px 12px', borderRadius: 99, background: filter === f ? '#152641' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${filter === f ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`, color: filter === f ? '#eef3fa' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', flexShrink: 0 }}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f as Status]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : incidents.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <IcHardhat size={32} color="#10b981" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#eef3fa', marginTop: 12, fontFamily: SF }}>No incidents{filter !== 'all' ? ` (${filter})` : ''}</h2>
          <p style={{ fontSize: 13, color: '#8ea8c5', marginTop: 4, fontFamily: SF }}>That&apos;s a good day on site.</p>
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incidents.map(i => (
            <button
              key={i.id}
              onClick={() => setActive(i)}
              style={{ background: '#152641', borderRadius: 12, padding: 12, border: `0.5px solid ${i.riddorReportable && i.status !== 'closed' ? '#f59e0b55' : 'rgba(255,255,255,0.07)'}`, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: `${SEVERITY_COLOR[i.severity]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcAlert size={18} color={SEVERITY_COLOR[i.severity]} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.title}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[i.status]}22`, color: STATUS_COLOR[i.status], fontFamily: SF, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>{STATUS_LABEL[i.status]}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: SF, fontSize: 11, color: SEVERITY_COLOR[i.severity], fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{i.severity.replace('_', ' ')}</span>
                  <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>·</span>
                  <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>{TYPE_LABEL[i.type]}</span>
                  {i.riddorReportable && (
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontFamily: SF, fontSize: 9, fontWeight: 700, letterSpacing: 0.4 }}>RIDDOR</span>
                  )}
                </div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 4 }}>
                  {i.project?.name || 'No project'} · {new Date(i.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <TabBar />

      {/* Add modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Log safety incident</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title — what happened?" style={inputStyle} />

            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, type: t }))}
                    style={{ padding: '6px 10px', borderRadius: 8, background: form.type === t ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${form.type === t ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.10)'}`, color: form.type === t ? '#ef4444' : '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Severity</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {SEVERITIES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, severity: s }))}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 8, background: form.severity === s ? `${SEVERITY_COLOR[s]}22` : 'rgba(255,255,255,0.04)', border: `0.5px solid ${form.severity === s ? SEVERITY_COLOR[s] : 'rgba(255,255,255,0.10)'}`, color: form.severity === s ? SEVERITY_COLOR[s] : '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4 }}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Project</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— No project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location" style={inputStyle} />
              <input value={form.injuredParty} onChange={e => setForm(p => ({ ...p, injuredParty: e.target.value }))} placeholder="Injured party (if any)" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Occurred at</label>
              <input type="datetime-local" value={form.occurredAt} onChange={e => setForm(p => ({ ...p, occurredAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What happened? Actions taken?" rows={4} style={{ ...inputStyle, fontFamily: SF, fontSize: 13, resize: 'vertical', minHeight: 80 }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: `0.5px solid ${form.riddorReportable ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.riddorReportable} onChange={e => setForm(p => ({ ...p, riddorReportable: e.target.checked }))} style={{ accentColor: '#f59e0b' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>RIDDOR reportable</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>Tick if this must be reported to HSE under the RIDDOR regulations (over-7-day injuries, hospitalised workers, dangerous occurrences).</div>
              </div>
            </label>

            <button onClick={create} disabled={saving || !form.title.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#ef4444', border: 'none', color: '#fff', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Log incident</>}
            </button>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      {active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActive(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>{active.title}</h2>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {TYPE_LABEL[active.type]} · {new Date(active.occurredAt).toLocaleString('en-GB')}
                </div>
              </div>
              <button onClick={() => setActive(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 99, background: `${SEVERITY_COLOR[active.severity]}22`, color: SEVERITY_COLOR[active.severity], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${SEVERITY_COLOR[active.severity]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{active.severity.replace('_', ' ')}</span>
              <span style={{ padding: '3px 10px', borderRadius: 99, background: `${STATUS_COLOR[active.status]}22`, color: STATUS_COLOR[active.status], fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[active.status]}</span>
              {active.riddorReportable && <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontFamily: SF, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>RIDDOR</span>}
            </div>

            {active.description && <p style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', lineHeight: 1.5, margin: 0 }}>{active.description}</p>}

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {active.project && <DetailRow label="Project" value={active.project.name} />}
              {active.location && <DetailRow label="Location" value={active.location} />}
              {active.reportedBy && <DetailRow label="Reported by" value={active.reportedBy} />}
              {active.injuredParty && <DetailRow label="Injured party" value={active.injuredParty} />}
              {active.closedAt && <DetailRow label="Closed at" value={new Date(active.closedAt).toLocaleString('en-GB')} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {active.status === 'open' && (
                <button onClick={() => changeStatus(active, 'investigating')} style={statusBtn('#f59e0b')}>Start investigation</button>
              )}
              {active.status !== 'closed' && (
                <button onClick={() => changeStatus(active, 'closed')} style={statusBtn('#10b981')}>Close</button>
              )}
              {active.status === 'closed' && (
                <button onClick={() => changeStatus(active, 'open')} style={statusBtn('#52749a')}>Reopen</button>
              )}
            </div>

            <button onClick={() => remove(active.id)} style={{ padding: '10px', borderRadius: 10, background: confirmDelete === active.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === active.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" />
              {confirmDelete === active.id ? 'Sure?' : 'Delete incident'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        <span style={{ fontFamily: SF, fontSize: 9, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, color, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 12 }}>
      <span style={{ color: '#8ea8c5' }}>{label}</span>
      <span style={{ color: '#eef3fa' }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 12px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const statusBtn = (color: string): React.CSSProperties => ({
  padding: '10px', borderRadius: 10, background: `${color}22`, border: `0.5px solid ${color}66`, color, fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})

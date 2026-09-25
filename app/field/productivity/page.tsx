'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcClock, IcLayers, IcTeam } from '@/components/ui/Icons'

type Project = { id: string; name: string }
type Log = {
  id: string
  date: string
  area: string
  elevation?: string | null
  activity: string
  unit: string
  plannedQty: number
  installedQty: number
  crewSize: number
  labourHours: number
  notes?: string | null
  createdBy?: string | null
}
type Summary = {
  plannedQty: number
  installedQty: number
  labourHours: number
  crewDays: number
  varianceQty: number
  completionPct: number | null
  qtyPerLabourHour: number | null
  labourHoursPerUnit: number | null
}

const SF = 'var(--font-system)'
const UNITS = ['m2', 'm', 'lm', 'panels', 'items', 'hours', 'tonnes', 'kg']

export default function FieldProductivityPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [logs, setLogs] = useState<Log[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0,10),
    area: '', elevation: '', activity: 'Cladding installation', unit: 'm2',
    plannedQty: '', installedQty: '', crewSize: '', labourHours: '', notes: '',
  })

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects?status=active', { cache: 'no-store' })
    const data = res.ok ? await res.json() : { projects: [] }
    const ps: Project[] = (data.projects || []).map((p: Project) => ({ id: p.id, name: p.name }))
    setProjects(ps)
    setProjectId(prev => prev || ps[0]?.id || '')
  }, [])

  const load = useCallback(async () => {
    if (!projectId) { setLogs([]); setSummary(null); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/field-production?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load production')
      setLogs(data.logs || [])
      setSummary(data.summary || null)
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load production')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!projectId || !form.area.trim() || !form.activity.trim() || saving) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/field-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          date: form.date,
          area: form.area.trim(),
          elevation: form.elevation.trim() || null,
          activity: form.activity.trim(),
          unit: form.unit,
          plannedQty: Number(form.plannedQty || 0),
          installedQty: Number(form.installedQty || 0),
          crewSize: Number(form.crewSize || 0),
          labourHours: Number(form.labourHours || 0),
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create production log')
      setForm({
        date: new Date().toISOString().slice(0,10), area: '', elevation: '',
        activity: 'Cladding installation', unit: 'm2', plannedQty: '', installedQty: '',
        crewSize: '', labourHours: '', notes: '',
      })
      setShowForm(false)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create production log')
    } finally {
      setSaving(false)
    }
  }

  const byArea = useMemo(() => {
    const map = new Map<string,{planned:number;installed:number;hours:number}>()
    for (const row of logs) {
      const key = row.elevation ? `${row.area} · ${row.elevation}` : row.area
      const current = map.get(key) || { planned: 0, installed: 0, hours: 0 }
      current.planned += row.plannedQty
      current.installed += row.installedQty
      current.hours += row.labourHours
      map.set(key, current)
    }
    return Array.from(map.entries()).map(([label,v]) => ({
      label,
      ...v,
      pct: v.planned > 0 ? Math.round((v.installed / v.planned) * 1000) / 10 : null,
      productivity: v.hours > 0 ? Math.round((v.installed / v.hours) * 1000) / 1000 : null,
    })).sort((a,b) => (a.pct ?? 0) - (b.pct ?? 0))
  }, [logs])

  return (
    <div className="module-page" style={{ minHeight: '100dvh', background: 'var(--bg0)', paddingBottom: 100 }}>
      <header style={headerStyle}>
        <Link href="/field" style={backStyle}><IcChevL size={15} color="var(--t2)" /> Field operations</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div>
            <h1 style={h1Style}>Productivity</h1>
            <p style={subStyle}>Planned vs installed output by area, elevation and crew effort.</p>
          </div>
          <button type="button" onClick={() => setShowForm(v => !v)} style={primaryBtn}>{showForm ? 'Close' : '+ Log output'}</button>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={selectStyle}>
          {!projects.length && <option value="">No active project</option>}
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </header>

      <main style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          <Metric label="Plan" value={summary ? fmt(summary.plannedQty) : '—'} color="var(--t2)" />
          <Metric label="Installed" value={summary ? fmt(summary.installedQty) : '—'} color="#10b981" />
          <Metric label="Plan hit" value={summary?.completionPct == null ? '—' : `${summary.completionPct}%`} color={(summary?.completionPct || 0) >= 100 ? '#10b981' : '#f59e0b'} />
          <Metric label="Qty / labour h" value={summary?.qtyPerLabourHour == null ? '—' : fmt(summary.qtyPerLabourHour)} color="#06b6d4" />
        </div>

        {showForm && (
          <section style={panelStyle}>
            <div style={twoCol}>
              <label style={labelStyle}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} /></label>
              <label style={labelStyle}>Unit<select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></label>
            </div>
            <div style={twoCol}>
              <TextField label="Area *" value={form.area} onChange={v => setForm(f => ({ ...f, area: v }))} placeholder="e.g. Block A" />
              <TextField label="Elevation / zone" value={form.elevation} onChange={v => setForm(f => ({ ...f, elevation: v }))} placeholder="East elevation / Level 5" />
            </div>
            <TextField label="Activity *" value={form.activity} onChange={v => setForm(f => ({ ...f, activity: v }))} placeholder="Cladding installation" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Num label="Planned" value={form.plannedQty} onChange={v => setForm(f => ({ ...f, plannedQty: v }))} />
              <Num label="Installed" value={form.installedQty} onChange={v => setForm(f => ({ ...f, installedQty: v }))} />
              <Num label="Crew" value={form.crewSize} onChange={v => setForm(f => ({ ...f, crewSize: v }))} />
              <Num label="Labour h" value={form.labourHours} onChange={v => setForm(f => ({ ...f, labourHours: v }))} />
            </div>
            <label style={labelStyle}>Notes<textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} maxLength={2000} placeholder="Reasons for variance, access, design or material effects…" style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <button type="button" disabled={saving || !form.area.trim() || !form.activity.trim()} onClick={create} style={{ ...primaryBtn, width: '100%', opacity: saving || !form.area.trim() || !form.activity.trim() ? .55 : 1 }}>{saving ? 'Saving…' : 'Save production log'}</button>
          </section>
        )}

        {message && <div style={errorStyle}>{message}</div>}

        {byArea.length > 0 && (
          <section style={panelStyle}>
            <div style={sectionTitle}>Area / elevation performance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
              {byArea.map(area => {
                const pct = area.pct ?? 0
                const tone = pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={area.label} style={{ background: '#0b1a30', borderRadius: 10, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 11.5, fontWeight: 900 }}>{area.label}</div>
                      <div style={{ color: tone, fontFamily: SF, fontSize: 11, fontWeight: 900 }}>{area.pct == null ? 'No plan' : `${area.pct}%`}</div>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-raised)', borderRadius: 99, marginTop: 7, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0,pct))}%`, background: tone }} />
                    </div>
                    <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 9.8, marginTop: 6 }}>
                      {fmt(area.installed)} installed / {fmt(area.planned)} planned{area.productivity != null ? ` · ${fmt(area.productivity)} per labour h` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {loading ? <div style={emptyStyle}>Loading production logs…</div> : logs.length === 0 ? <div style={emptyStyle}>No production logs yet. Record planned and installed output at the end of each work period.</div> : (
          <section style={panelStyle}>
            <div style={sectionTitle}>Recent production</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
              {logs.slice(0,50).map(row => {
                const pct = row.plannedQty > 0 ? Math.round((row.installedQty / row.plannedQty) * 1000) / 10 : null
                const tone = pct == null ? 'var(--t2)' : pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={row.id} style={{ background: '#0b1a30', borderRadius: 10, padding: 10, borderLeft: `3px solid ${tone}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 11.5, fontWeight: 900 }}>{row.activity}</div>
                        <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 9.8, marginTop: 3 }}>{row.area}{row.elevation ? ` · ${row.elevation}` : ''} · {new Date(row.date).toLocaleDateString('en-GB')}</div>
                      </div>
                      <div style={{ color: tone, fontFamily: SF, fontSize: 12, fontWeight: 900 }}>{pct == null ? '—' : `${pct}%`}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 8 }}>
                      <Mini icon={<IcLayers size={11} color="#10b981" />} label="Installed" value={`${fmt(row.installedQty)} ${row.unit}`} />
                      <Mini icon={<IcLayers size={11} color="var(--t2)" />} label="Plan" value={`${fmt(row.plannedQty)} ${row.unit}`} />
                      <Mini icon={<IcTeam size={11} color="#06b6d4" />} label="Crew" value={String(row.crewSize)} />
                      <Mini icon={<IcClock size={11} color="#8b5cf6" />} label="Labour h" value={fmt(row.labourHours)} />
                    </div>
                    {row.notes && <div style={{ color: '#c8d7ea', fontFamily: SF, fontSize: 10.5, marginTop: 8, lineHeight: 1.45 }}>{row.notes}</div>}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
      <TabBar />
    </div>
  )
}

function fmt(value: number) {
  return Number(value || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })
}
function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={metricStyle}><div style={{ color, fontFamily: SF, fontSize: 18, fontWeight: 900 }}>{value}</div><div style={metricLabel}>{label}</div></div>
}
function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div style={{ background: 'var(--surface-strong)', borderRadius: 8, padding: 7 }}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{icon}<span style={{ color: 'var(--t3)', fontFamily: SF, fontSize: 8.8, textTransform: 'uppercase', fontWeight: 900 }}>{label}</span></div><div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 10.5, fontWeight: 800, marginTop: 3 }}>{value}</div></div>
}
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label style={labelStyle}>{label}<input value={value} onChange={e => onChange(e.target.value)} maxLength={220} placeholder={placeholder} style={inputStyle} /></label>
}
function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label style={labelStyle}>{label}<input type="number" min="0" step="any" value={value} onChange={e => onChange(e.target.value)} style={inputStyle} /></label>
}

const headerStyle: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 30, padding: '16px 18px 13px', background: 'rgba(6,16,30,.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)' }
const backStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--t2)', textDecoration: 'none', fontFamily: SF, fontSize: 12 }
const h1Style: React.CSSProperties = { margin: 0, color: 'var(--t1)', fontFamily: SF, fontSize: 23, letterSpacing: '-.03em' }
const subStyle: React.CSSProperties = { margin: '3px 0 0', color: 'var(--t2)', fontFamily: SF, fontSize: 11 }
const selectStyle: React.CSSProperties = { marginTop: 13, width: '100%', boxSizing: 'border-box', borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', background: 'var(--surface-strong)', color: 'var(--t1)', padding: '11px 12px', fontFamily: SF, fontSize: 13 }
const panelStyle: React.CSSProperties = { background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, padding: 13, marginBottom: 14 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, fontWeight: 800, marginBottom: 10 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(255,255,255,.09)', background: '#0b1a30', color: 'var(--t1)', padding: '10px 11px', fontFamily: SF, fontSize: 12 }
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }
const primaryBtn: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '10px 12px', background: '#f59e0b', color: 'var(--bg0)', fontFamily: SF, fontSize: 11, fontWeight: 900, cursor: 'pointer' }
const metricStyle: React.CSSProperties = { borderRadius: 11, background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)', padding: 9 }
const metricLabel: React.CSSProperties = { color: 'var(--t2)', fontFamily: SF, fontSize: 8.8, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }
const sectionTitle: React.CSSProperties = { color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' }
const errorStyle: React.CSSProperties = { marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(239,68,68,.10)', color: '#ef4444', fontFamily: SF, fontSize: 11 }
const emptyStyle: React.CSSProperties = { padding: '28px 16px', borderRadius: 12, background: 'var(--surface-strong)', color: 'var(--t3)', fontFamily: SF, fontSize: 12, textAlign: 'center' }

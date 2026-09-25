'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcAlert, IcChevL, IcCheck } from '@/components/ui/Icons'

type Project = { id: string; name: string }
type Constraint = {
  id: string
  projectId: string
  category: string
  title: string
  detail?: string | null
  location?: string | null
  priority: string
  status: string
  ownerName?: string | null
  dueDate?: string | null
  resolution?: string | null
  resolvedAt?: string | null
  createdAt: string
}

const SF = 'var(--font-system)'
const CATEGORIES = ['access', 'design', 'material', 'labour', 'plant', 'client', 'weather', 'quality', 'safety', 'other']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

export default function FieldConstraintsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [renderNow] = useState(() => Date.now())
  const [form, setForm] = useState({
    title: '', category: 'access', priority: 'medium', location: '', ownerName: '', dueDate: '', detail: '',
  })

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects?status=active', { cache: 'no-store' })
    const data = res.ok ? await res.json() : { projects: [] }
    const ps: Project[] = (data.projects || []).map((p: Project) => ({ id: p.id, name: p.name }))
    setProjects(ps)
    setProjectId(prev => prev || ps[0]?.id || '')
  }, [])

  const loadConstraints = useCallback(async () => {
    if (!projectId) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/field-constraints?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load constraints')
      setItems(data.constraints || [])
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load constraints')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => { void loadConstraints() }, [loadConstraints])

  const openCount = items.filter(i => i.status !== 'resolved').length
  const critical = items.filter(i => i.status !== 'resolved' && i.priority === 'critical').length
  const overdue = useMemo(
    () => items.filter(i => i.status !== 'resolved' && i.dueDate && new Date(i.dueDate).getTime() < renderNow).length,
    [items, renderNow],
  )

  const create = async () => {
    if (!form.title.trim() || !projectId || saving) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/field-constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: form.title.trim(),
          category: form.category,
          priority: form.priority,
          location: form.location.trim() || null,
          ownerName: form.ownerName.trim() || null,
          dueDate: form.dueDate || null,
          detail: form.detail.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create constraint')
      setForm({ title: '', category: 'access', priority: 'medium', location: '', ownerName: '', dueDate: '', detail: '' })
      setShowForm(false)
      await loadConstraints()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create constraint')
    } finally {
      setSaving(false)
    }
  }

  const transition = async (item: Constraint, status: 'open' | 'mitigating' | 'resolved') => {
    let resolution = item.resolution || ''
    if (status === 'resolved') {
      const answer = window.prompt('Resolution / action taken', resolution)
      if (answer === null) return
      resolution = answer
    }
    const res = await fetch(`/api/field-constraints/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.error || 'Failed to update constraint')
      return
    }
    await loadConstraints()
  }

  return (
    <div className="module-page" style={{ minHeight: '100dvh', background: 'var(--bg0)', paddingBottom: 100 }}>
      <header style={headerStyle}>
        <Link href="/field" style={backStyle}><IcChevL size={15} color="var(--t2)" /> Field operations</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div>
            <h1 style={h1Style}>Constraints</h1>
            <p style={subStyle}>Blockers, owners, due dates and resolution status.</p>
          </div>
          <button type="button" onClick={() => setShowForm(v => !v)} style={primaryBtn}>{showForm ? 'Close' : '+ Raise'}</button>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={selectStyle}>
          {!projects.length && <option value="">No active project</option>}
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </header>

      <main style={{ padding: '14px 16px 0' }}>
        <div style={metricGrid}>
          <Metric label="Open" value={openCount} color="#f59e0b" />
          <Metric label="Critical" value={critical} color={critical ? '#ef4444' : '#10b981'} />
          <Metric label="Overdue" value={overdue} color={overdue ? '#ef4444' : '#10b981'} />
        </div>

        {showForm && (
          <section style={panelStyle}>
            <TextField label="Constraint title *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Scaffold not handed over on East elevation" />
            <div style={twoCol}>
              <label style={labelStyle}>Category<select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
              <label style={labelStyle}>Priority<select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
            </div>
            <div style={twoCol}>
              <TextField label="Location" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="Level / grid / elevation" />
              <TextField label="Owner" value={form.ownerName} onChange={v => setForm(f => ({ ...f, ownerName: v }))} placeholder="Person / company" />
            </div>
            <label style={labelStyle}>Target date<input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inputStyle} /></label>
            <label style={labelStyle}>Detail<textarea value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} rows={3} maxLength={2000} placeholder="What is blocked, impact, decision required…" style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <button type="button" disabled={saving || !form.title.trim()} onClick={create} style={{ ...primaryBtn, width: '100%', opacity: saving || !form.title.trim() ? .55 : 1 }}>{saving ? 'Saving…' : 'Create constraint'}</button>
          </section>
        )}

        {message && <div style={errorStyle}>{message}</div>}
        {loading ? <div style={emptyStyle}>Loading constraints…</div> : items.length === 0 ? <div style={emptyStyle}>No active constraints recorded for this project.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map(item => {
              const tone = item.status === 'resolved' ? '#10b981' : item.priority === 'critical' ? '#ef4444' : item.priority === 'high' ? '#f59e0b' : '#06b6d4'
              const isOverdue = item.status !== 'resolved' && !!item.dueDate && new Date(item.dueDate).getTime() < renderNow
              return (
                <section key={item.id} style={{ ...panelStyle, borderColor: tone + '55', marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                        <Badge label={item.category} color="#8b5cf6" />
                        <Badge label={item.priority} color={tone} />
                        <Badge label={item.status.replace('_', ' ')} color={item.status === 'resolved' ? '#10b981' : '#06b6d4'} />
                        {isOverdue && <Badge label="overdue" color="#ef4444" />}
                      </div>
                      <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 14, fontWeight: 900 }}>{item.title}</div>
                      <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, marginTop: 4 }}>
                        {item.location || 'No location'}{item.ownerName ? ` · Owner: ${item.ownerName}` : ''}{item.dueDate ? ` · Due ${new Date(item.dueDate).toLocaleDateString('en-GB')}` : ''}
                      </div>
                    </div>
                    <IcAlert size={18} color={tone} />
                  </div>
                  {item.detail && <p style={bodyStyle}>{item.detail}</p>}
                  {item.resolution && <div style={{ ...bodyStyle, color: '#a7f3d0' }}>Resolution: {item.resolution}</div>}
                  <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                    {item.status === 'open' && <SmallButton label="Mitigating" onClick={() => transition(item, 'mitigating')} color="#06b6d4" />}
                    {item.status !== 'resolved' && <SmallButton label="Resolve" onClick={() => transition(item, 'resolved')} color="#10b981" icon />}
                    {item.status === 'resolved' && <SmallButton label="Reopen" onClick={() => transition(item, 'open')} color="#f59e0b" />}
                    {item.status === 'mitigating' && <SmallButton label="Back to open" onClick={() => transition(item, 'open')} color="var(--t3)" />}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
      <TabBar />
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={metricStyle}><div style={{ color, fontFamily: SF, fontSize: 21, fontWeight: 900 }}>{value}</div><div style={metricLabel}>{label}</div></div>
}
function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ padding: '3px 7px', borderRadius: 999, background: color + '1f', color, fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase' }}>{label}</span>
}
function SmallButton({ label, onClick, color, icon }: { label: string; onClick: () => void; color: string; icon?: boolean }) {
  return <button type="button" onClick={onClick} style={{ border: `1px solid ${color}55`, background: color + '18', color, borderRadius: 9, padding: '7px 10px', fontFamily: SF, fontSize: 10.5, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}>{icon && <IcCheck size={11} color={color} />}{label}</button>
}
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label style={labelStyle}>{label}<input value={value} onChange={e => onChange(e.target.value)} maxLength={220} placeholder={placeholder} style={inputStyle} /></label>
}

const headerStyle: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 30, padding: '16px 18px 13px', background: 'rgba(6,16,30,.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)' }
const backStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--t2)', textDecoration: 'none', fontFamily: SF, fontSize: 12 }
const h1Style: React.CSSProperties = { margin: 0, color: 'var(--t1)', fontFamily: SF, fontSize: 23, letterSpacing: '-.03em' }
const subStyle: React.CSSProperties = { margin: '3px 0 0', color: 'var(--t2)', fontFamily: SF, fontSize: 11 }
const selectStyle: React.CSSProperties = { marginTop: 13, width: '100%', boxSizing: 'border-box', borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', background: 'var(--surface-strong)', color: 'var(--t1)', padding: '11px 12px', fontFamily: SF, fontSize: 13 }
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }
const metricStyle: React.CSSProperties = { borderRadius: 11, background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)', padding: 10 }
const metricLabel: React.CSSProperties = { color: 'var(--t2)', fontFamily: SF, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }
const panelStyle: React.CSSProperties = { background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, padding: 13, marginBottom: 14 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, fontWeight: 800, marginBottom: 10 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(255,255,255,.09)', background: '#0b1a30', color: 'var(--t1)', padding: '10px 11px', fontFamily: SF, fontSize: 12 }
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }
const primaryBtn: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '10px 12px', background: '#f59e0b', color: 'var(--bg0)', fontFamily: SF, fontSize: 11, fontWeight: 900, cursor: 'pointer' }
const bodyStyle: React.CSSProperties = { margin: '8px 0 0', color: '#c8d7ea', fontFamily: SF, fontSize: 11, lineHeight: 1.5 }
const errorStyle: React.CSSProperties = { marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(239,68,68,.10)', color: '#ef4444', fontFamily: SF, fontSize: 11 }
const emptyStyle: React.CSSProperties = { padding: '28px 16px', borderRadius: 12, background: 'var(--surface-strong)', color: 'var(--t3)', fontFamily: SF, fontSize: 12, textAlign: 'center' }

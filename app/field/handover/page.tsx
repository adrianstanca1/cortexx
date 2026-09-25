'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcCheck, IcClock, IcDoc } from '@/components/ui/Icons'

type Project = { id: string; name: string }
type OpenItem = { id: string; title: string; owner?: string | null; dueDate?: string | null; status: string }
type Handover = {
  id: string
  projectId: string
  shiftDate: string
  shiftType: string
  outgoingBy?: string | null
  incomingBy?: string | null
  summary?: string | null
  completedWork?: string | null
  nextShiftPlan?: string | null
  safetyNotes?: string | null
  qualityNotes?: string | null
  materialsNotes?: string | null
  plantNotes?: string | null
  openItems?: OpenItem[]
  acceptedBy?: string | null
  acceptedAt?: string | null
  createdAt: string
}

const SF = 'var(--font-system)'
const SHIFT_TYPES = ['day', 'night', 'weekend', 'other']

export default function FieldHandoverPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<Handover[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    shiftType: 'day', incomingBy: '', summary: '', completedWork: '', nextShiftPlan: '',
    safetyNotes: '', qualityNotes: '', materialsNotes: '', plantNotes: '', openItems: '',
  })

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects?status=active', { cache: 'no-store' })
    const data = res.ok ? await res.json() : { projects: [] }
    const ps: Project[] = (data.projects || []).map((p: Project) => ({ id: p.id, name: p.name }))
    setProjects(ps)
    setProjectId(prev => prev || ps[0]?.id || '')
  }, [])

  const load = useCallback(async () => {
    if (!projectId) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/field-handovers?projectId=${encodeURIComponent(projectId)}&take=30`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to load handovers')
      setItems(data.handovers || [])
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load handovers')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!projectId || saving) return
    setSaving(true)
    setMessage('')
    const openItems = form.openItems.split('\n').map((line, index) => line.trim()).filter(Boolean).map((title, index) => ({ id: `line-${index}`, title, status: 'open' }))
    try {
      const res = await fetch('/api/field-handovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          shiftDate: new Date().toISOString(),
          shiftType: form.shiftType,
          incomingBy: form.incomingBy.trim() || null,
          summary: form.summary.trim() || null,
          completedWork: form.completedWork.trim() || null,
          nextShiftPlan: form.nextShiftPlan.trim() || null,
          safetyNotes: form.safetyNotes.trim() || null,
          qualityNotes: form.qualityNotes.trim() || null,
          materialsNotes: form.materialsNotes.trim() || null,
          plantNotes: form.plantNotes.trim() || null,
          openItems,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create handover')
      setForm({ shiftType: 'day', incomingBy: '', summary: '', completedWork: '', nextShiftPlan: '', safetyNotes: '', qualityNotes: '', materialsNotes: '', plantNotes: '', openItems: '' })
      setShowForm(false)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create handover')
    } finally {
      setSaving(false)
    }
  }

  const accept = async (item: Handover) => {
    const acceptedBy = window.prompt('Accept handover as', item.incomingBy || '')
    if (acceptedBy === null) return
    const res = await fetch(`/api/field-handovers/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accept: true, acceptedBy }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(data?.error || 'Failed to accept handover')
      return
    }
    await load()
  }

  const pending = items.filter(i => !i.acceptedAt).length

  return (
    <div style={{ minHeight: '100dvh', background: '#06101e', paddingBottom: 100 }}>
      <header style={headerStyle}>
        <Link href="/field" style={backStyle}><IcChevL size={15} color="#8ea8c5" /> Field operations</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div>
            <h1 style={h1Style}>Shift handover</h1>
            <p style={subStyle}>Pass work, risks and priorities cleanly between site shifts.</p>
          </div>
          <button type="button" onClick={() => setShowForm(v => !v)} style={primaryBtn}>{showForm ? 'Close' : '+ Handover'}</button>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={selectStyle}>
          {!projects.length && <option value="">No active project</option>}
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </header>

      <main style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <Metric label="Recent handovers" value={items.length} color="#06b6d4" />
          <Metric label="Awaiting acceptance" value={pending} color={pending ? '#f59e0b' : '#10b981'} />
        </div>

        {showForm && (
          <section style={panelStyle}>
            <div style={twoCol}>
              <label style={labelStyle}>Shift<select value={form.shiftType} onChange={e => setForm(f => ({ ...f, shiftType: e.target.value }))} style={inputStyle}>{SHIFT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <TextField label="Incoming supervisor" value={form.incomingBy} onChange={v => setForm(f => ({ ...f, incomingBy: v }))} placeholder="Name / role" />
            </div>
            <Area label="Shift summary" value={form.summary} onChange={v => setForm(f => ({ ...f, summary: v }))} placeholder="Overall state of the site at handover" />
            <Area label="Work completed" value={form.completedWork} onChange={v => setForm(f => ({ ...f, completedWork: v }))} placeholder="What was completed this shift" />
            <Area label="Next shift plan" value={form.nextShiftPlan} onChange={v => setForm(f => ({ ...f, nextShiftPlan: v }))} placeholder="Priority work for the next shift" />
            <div style={twoCol}>
              <Area label="Safety notes" value={form.safetyNotes} onChange={v => setForm(f => ({ ...f, safetyNotes: v }))} placeholder="Hazards, permits, isolations…" compact />
              <Area label="Quality notes" value={form.qualityNotes} onChange={v => setForm(f => ({ ...f, qualityNotes: v }))} placeholder="Hold points, defects, inspections…" compact />
            </div>
            <div style={twoCol}>
              <Area label="Materials / deliveries" value={form.materialsNotes} onChange={v => setForm(f => ({ ...f, materialsNotes: v }))} placeholder="Shortages, deliveries, storage…" compact />
              <Area label="Plant / access" value={form.plantNotes} onChange={v => setForm(f => ({ ...f, plantNotes: v }))} placeholder="Plant status, scaffold, access…" compact />
            </div>
            <Area label="Open items — one per line" value={form.openItems} onChange={v => setForm(f => ({ ...f, openItems: v }))} placeholder={'Await scaffold handover\nArchitect response to RFI-014\nReplace damaged panel'} />
            <button type="button" disabled={saving} onClick={create} style={{ ...primaryBtn, width: '100%', opacity: saving ? .55 : 1 }}>{saving ? 'Saving…' : 'Create handover'}</button>
          </section>
        )}

        {message && <div style={errorStyle}>{message}</div>}
        {loading ? <div style={emptyStyle}>Loading handovers…</div> : items.length === 0 ? <div style={emptyStyle}>No shift handovers recorded yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map(item => (
              <section key={item.id} style={{ ...panelStyle, marginBottom: 0, borderColor: item.acceptedAt ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.30)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Badge label={item.shiftType} color="#06b6d4" />
                      <Badge label={item.acceptedAt ? 'accepted' : 'pending acceptance'} color={item.acceptedAt ? '#10b981' : '#f59e0b'} />
                    </div>
                    <div style={{ color: '#eef3fa', fontFamily: SF, fontSize: 14, fontWeight: 900, marginTop: 7 }}>
                      {new Date(item.shiftDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10.5, marginTop: 3 }}>
                      Out: {item.outgoingBy || '—'}{item.incomingBy ? ` · In: ${item.incomingBy}` : ''}
                    </div>
                  </div>
                  {item.acceptedAt ? <IcCheck size={20} color="#10b981" /> : <IcClock size={20} color="#f59e0b" />}
                </div>
                {item.summary && <FieldBlock label="Summary" text={item.summary} />}
                {item.completedWork && <FieldBlock label="Completed" text={item.completedWork} />}
                {item.nextShiftPlan && <FieldBlock label="Next shift" text={item.nextShiftPlan} />}
                {(item.openItems || []).length > 0 && (
                  <div style={{ marginTop: 9 }}>
                    <div style={sectionLabel}>Open items</div>
                    {(item.openItems || []).map(open => <div key={open.id} style={openItemStyle}>• {open.title}</div>)}
                  </div>
                )}
                {!item.acceptedAt && <button type="button" onClick={() => accept(item)} style={{ ...primaryBtn, background: '#10b981', marginTop: 11 }}><IcCheck size={12} color="#06101e" /> Accept handover</button>}
                {item.acceptedAt && <div style={{ color: '#10b981', fontFamily: SF, fontSize: 10.5, marginTop: 9 }}>Accepted by {item.acceptedBy || 'incoming shift'} · {new Date(item.acceptedAt).toLocaleString('en-GB')}</div>}
              </section>
            ))}
          </div>
        )}

        <div style={{ ...panelStyle, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><IcDoc size={15} color="#8b5cf6" /><strong style={{ color: '#eef3fa', fontFamily: SF, fontSize: 11.5 }}>Handover becomes project evidence</strong></div>
          <p style={{ ...bodyStyle, marginBottom: 0 }}>Every handover and acceptance writes to the project activity stream so site management has a dated continuity record.</p>
        </div>
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
function FieldBlock({ label, text }: { label: string; text: string }) {
  return <div style={{ marginTop: 9 }}><div style={sectionLabel}>{label}</div><div style={bodyStyle}>{text}</div></div>
}
function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label style={labelStyle}>{label}<input value={value} onChange={e => onChange(e.target.value)} maxLength={220} placeholder={placeholder} style={inputStyle} /></label>
}
function Area({ label, value, onChange, placeholder, compact }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; compact?: boolean }) {
  return <label style={labelStyle}>{label}<textarea value={value} onChange={e => onChange(e.target.value)} rows={compact ? 2 : 3} maxLength={3000} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' }} /></label>
}

const headerStyle: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 30, padding: '16px 18px 13px', background: 'rgba(6,16,30,.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)' }
const backStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#8ea8c5', textDecoration: 'none', fontFamily: SF, fontSize: 12 }
const h1Style: React.CSSProperties = { margin: 0, color: '#eef3fa', fontFamily: SF, fontSize: 23, letterSpacing: '-.03em' }
const subStyle: React.CSSProperties = { margin: '3px 0 0', color: '#8ea8c5', fontFamily: SF, fontSize: 11 }
const selectStyle: React.CSSProperties = { marginTop: 13, width: '100%', boxSizing: 'border-box', borderRadius: 11, border: '1px solid rgba(255,255,255,.09)', background: '#102039', color: '#eef3fa', padding: '11px 12px', fontFamily: SF, fontSize: 13 }
const panelStyle: React.CSSProperties = { background: '#102039', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, padding: 13, marginBottom: 14 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, color: '#8ea8c5', fontFamily: SF, fontSize: 10.5, fontWeight: 800, marginBottom: 10 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(255,255,255,.09)', background: '#0b1a30', color: '#eef3fa', padding: '10px 11px', fontFamily: SF, fontSize: 12 }
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }
const primaryBtn: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '10px 12px', background: '#f59e0b', color: '#06101e', fontFamily: SF, fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }
const metricStyle: React.CSSProperties = { borderRadius: 11, background: '#102039', border: '1px solid rgba(255,255,255,.07)', padding: 10 }
const metricLabel: React.CSSProperties = { color: '#8ea8c5', fontFamily: SF, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }
const bodyStyle: React.CSSProperties = { color: '#c8d7ea', fontFamily: SF, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap' }
const sectionLabel: React.CSSProperties = { color: '#52749a', fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }
const openItemStyle: React.CSSProperties = { color: '#fbbf24', fontFamily: SF, fontSize: 10.5, marginTop: 5 }
const errorStyle: React.CSSProperties = { marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(239,68,68,.10)', color: '#ef4444', fontFamily: SF, fontSize: 11 }
const emptyStyle: React.CSSProperties = { padding: '28px 16px', borderRadius: 12, background: '#102039', color: '#52749a', fontFamily: SF, fontSize: 12, textAlign: 'center' }

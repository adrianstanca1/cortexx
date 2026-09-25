'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcEdit, IcPlus, IcTrash, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type Member = { id: string; name: string; email?: string | null; role?: string }
type Activity = {
  id: string; code?: string | null; title: string; description?: string | null
  baselineStart: string; baselineEnd: string; plannedStart: string; plannedEnd: string
  actualStart?: string | null; actualEnd?: string | null; progress: number; status: string
  responsibleMemberId?: string | null; responsibleMember?: Member | null; location?: string | null
  notes?: string | null; sortOrder: number
}
type Dependency = { id: string; predecessorId: string; successorId: string; type: string; lagDays: number }
type Baseline = { id: string; revision: number; label?: string | null; reason: string; status: string; effectiveAt: string; createdAt: string; createdByUserId?: string | null }
type DelayEvent = { id: string; activityId?: string | null; activity?: { id: string; code?: string | null; title: string } | null; title: string; category: string; cause?: string | null; impact?: string | null; startDate: string; endDate?: string | null; delayDays: number; status: string; decisionNotes?: string | null; decidedAt?: string | null; closedAt?: string | null }
type CpmRow = { id: string; durationDays: number; totalFloatDays: number; critical: boolean }
type ProgrammeSummary = {
  progressPct: number; totalActivities: number; complete: number; overdue: number; blocked: number; lookaheadCount: number
  lookahead: Activity[]; overdueActivities: Activity[]
  dependencyViolations: Array<{ dependencyId: string; predecessorId: string; successorId: string; type: string; shortfallDays: number }>
  criticalPath: { hasCycle: boolean; projectDurationDays: number; criticalActivityIds: string[]; activities: CpmRow[] }
}
type Payload = {
  project: { id: string; name: string; startDate?: string | null; endDate?: string | null; progress: number }
  activities: Activity[]; dependencies: Dependency[]; team: Member[]; summary: ProgrammeSummary
  baselines: Baseline[]; delays: DelayEvent[]; baselineLocked: boolean; latestBaseline?: Baseline | null
  permissions: { plan: boolean; progress: boolean }
}

type ActivityForm = {
  title: string; code: string; plannedStart: string; plannedEnd: string; baselineStart: string; baselineEnd: string
  responsibleMemberId: string; location: string; description: string; notes: string
}

const blankForm: ActivityForm = { title: '', code: '', plannedStart: '', plannedEnd: '', baselineStart: '', baselineEnd: '', responsibleMemberId: '', location: '', description: '', notes: '' }
const statusLabel: Record<string,string> = { not_started: 'Not started', in_progress: 'In progress', complete: 'Complete', blocked: 'Blocked' }
const statusColor: Record<string,string> = { not_started: '#52749a', in_progress: '#2563eb', complete: '#10b981', blocked: '#ef4444' }
const dateOnly = (v?: string | null) => v ? new Date(v).toISOString().slice(0, 10) : ''
const prettyDate = (v: string) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function ProgrammePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(21)
  const [showActivity, setShowActivity] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form, setForm] = useState<ActivityForm>(blankForm)
  const [saving, setSaving] = useState(false)
  const [showDependency, setShowDependency] = useState(false)
  const [depForm, setDepForm] = useState({ predecessorId: '', successorId: '', type: 'FS', lagDays: '0' })
  const [showBaseline, setShowBaseline] = useState(false)
  const [baselineForm, setBaselineForm] = useState({ label: '', reason: '', effectiveAt: '' })
  const [showDelay, setShowDelay] = useState(false)
  const [delayForm, setDelayForm] = useState({ title: '', category: 'other', activityId: '', startDate: '', endDate: '', delayDays: '0', cause: '', impact: '' })
  const [message, setMessage] = useState<string | null>(null)

  useModalEffects(showActivity, () => setShowActivity(false))
  useModalEffects(showDependency, () => setShowDependency(false))
  useModalEffects(showBaseline, () => setShowBaseline(false))
  useModalEffects(showDelay, () => setShowDelay(false))

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/projects/${id}/programme?days=${days}`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Programme unavailable')
      setData(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Programme unavailable')
    } finally { setLoading(false) }
  }, [id, days])

  useEffect(() => { load() }, [load])

  const critical = useMemo(() => new Set(data?.summary.criticalPath.criticalActivityIds || []), [data])
  const byId = useMemo(() => new Map((data?.activities || []).map(a => [a.id, a])), [data])
  const cpmById = useMemo(() => new Map((data?.summary.criticalPath.activities || []).map(a => [a.id, a])), [data])

  const openCreate = () => {
    const start = data?.project.startDate ? dateOnly(data.project.startDate) : new Date().toISOString().slice(0, 10)
    setEditing(null)
    setForm({ ...blankForm, plannedStart: start, plannedEnd: start, baselineStart: start, baselineEnd: start })
    setShowActivity(true)
  }
  const openEdit = (activity: Activity) => {
    setEditing(activity)
    setForm({
      title: activity.title, code: activity.code || '', plannedStart: dateOnly(activity.plannedStart), plannedEnd: dateOnly(activity.plannedEnd),
      baselineStart: dateOnly(activity.baselineStart), baselineEnd: dateOnly(activity.baselineEnd), responsibleMemberId: activity.responsibleMemberId || '',
      location: activity.location || '', description: activity.description || '', notes: activity.notes || '',
    })
    setShowActivity(true)
  }
  const saveActivity = async () => {
    if (!form.title.trim() || !form.plannedStart || !form.plannedEnd) return
    setSaving(true); setMessage(null)
    try {
      const url = editing ? `/api/projects/${id}/programme/${editing.id}` : `/api/projects/${id}/programme`
      const payload = { ...form, responsibleMemberId: form.responsibleMemberId || null } as Record<string, unknown>
      if (data?.baselineLocked) { delete payload.baselineStart; delete payload.baselineEnd }
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to save activity')
      setShowActivity(false); setEditing(null); setMessage(editing ? 'Activity updated' : 'Activity added'); await load()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Failed to save activity') }
    finally { setSaving(false) }
  }
  const patchActivity = async (activity: Activity, patch: Record<string, unknown>) => {
    setMessage(null)
    const res = await fetch(`/api/projects/${id}/programme/${activity.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to update activity'); return }
    await load()
  }
  const removeActivity = async (activity: Activity) => {
    if (!window.confirm(`Delete programme activity “${activity.title}”?`)) return
    const res = await fetch(`/api/projects/${id}/programme/${activity.id}`, { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to delete activity'); return }
    setMessage('Activity deleted'); await load()
  }
  const createDependency = async () => {
    if (!depForm.predecessorId || !depForm.successorId) return
    const res = await fetch(`/api/projects/${id}/programme/dependencies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...depForm, lagDays: Number(depForm.lagDays) || 0 }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to add dependency'); return }
    setShowDependency(false); setDepForm({ predecessorId: '', successorId: '', type: 'FS', lagDays: '0' }); setMessage('Dependency added'); await load()
  }
  const removeDependency = async (dep: Dependency) => {
    const res = await fetch(`/api/projects/${id}/programme/dependencies/${dep.id}`, { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to remove dependency'); return }
    await load()
  }
  const openBaseline = () => {
    const nextRevision = (data?.latestBaseline?.revision || 0) + 1
    setBaselineForm({ label: `Revision ${nextRevision}`, reason: '', effectiveAt: new Date().toISOString().slice(0, 10) })
    setShowBaseline(true)
  }
  const createBaseline = async () => {
    if (!baselineForm.reason.trim()) return
    if (!window.confirm('Create a new immutable baseline from the current planned dates? Existing active baseline history will be preserved.')) return
    const res = await fetch(`/api/projects/${id}/programme/baselines`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(baselineForm) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to create baseline'); return }
    setShowBaseline(false); setMessage(`Baseline Rev ${body.revision} created`); await load()
  }
  const openDelay = () => {
    setDelayForm({ title: '', category: 'other', activityId: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', delayDays: '0', cause: '', impact: '' })
    setShowDelay(true)
  }
  const createDelay = async () => {
    if (!delayForm.title.trim() || !delayForm.startDate) return
    const res = await fetch(`/api/projects/${id}/programme/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...delayForm, activityId: delayForm.activityId || null, endDate: delayForm.endDate || null, delayDays: Number(delayForm.delayDays) || 0 }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to create delay event'); return }
    setShowDelay(false); setMessage('Delay event recorded'); await load()
  }
  const transitionDelay = async (delay: DelayEvent, status: string) => {
    const decisionNotes = window.prompt(status === 'closed' ? 'Closeout note (optional)' : `${status === 'accepted' ? 'Acceptance' : 'Rejection'} note (optional)`, delay.decisionNotes || '')
    if (decisionNotes === null) return
    const res = await fetch(`/api/projects/${id}/programme/delays/${delay.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, decisionNotes }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to update delay event'); return }
    setMessage(`Delay marked ${status}`); await load()
  }
  const removeDelay = async (delay: DelayEvent) => {
    if (!window.confirm(`Delete open delay event “${delay.title}”?`)) return
    const res = await fetch(`/api/projects/${id}/programme/delays/${delay.id}`, { method: 'DELETE' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMessage(body.error || 'Failed to delete delay event'); return }
    setMessage('Delay event deleted'); await load()
  }

  if (loading) return <Shell><div style={centerStyle}>Loading programme…</div></Shell>
  if (error || !data) return <Shell><div style={centerStyle}><p style={{ color: '#ef4444' }}>{error || 'Programme unavailable'}</p><Link href={`/projects/${id}`} style={{ color: '#f59e0b' }}>Back to project</Link></div></Shell>

  return (
    <Shell>
      <header style={headerStyle}>
        <Link href={`/projects/${id}`} aria-label="Back to project" style={{ width: 36, height: 36, borderRadius: 9, background: '#152641', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcChevL size={18} color="#8ea8c5" /></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={eyebrow}>PROJECT PROGRAMME</div>
          <h1 style={{ margin: 0, color: '#eef3fa', fontSize: 20, fontFamily: 'var(--font-system)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.project.name}</h1>
        </div>
        {data.permissions.plan && <button onClick={openCreate} style={primaryButton}><IcPlus size={14} color="#fff" /> Activity</button>}
      </header>

      <main style={{ padding: '14px 16px 96px', maxWidth: 1100, margin: '0 auto' }}>
        {message && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontSize: 12, fontFamily: 'var(--font-system)' }}>{message}</div>}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
          <Kpi label="Progress" value={`${data.summary.progressPct}%`} color="#10b981" />
          <Kpi label="Activities" value={String(data.summary.totalActivities)} color="#eef3fa" />
          <Kpi label={`${days}d look-ahead`} value={String(data.summary.lookaheadCount)} color="#2563eb" />
          <Kpi label="Critical" value={String(data.summary.criticalPath.criticalActivityIds.length)} color="#f59e0b" />
          <Kpi label="Overdue" value={String(data.summary.overdue)} color={data.summary.overdue ? '#ef4444' : '#52749a'} />
          <Kpi label="Blocked" value={String(data.summary.blocked)} color={data.summary.blocked ? '#ef4444' : '#52749a'} />
        </section>

        <section style={panelStyle}>
          <div style={sectionHeader}>
            <div><div style={eyebrow}>LOOK-AHEAD</div><div style={{ color: '#eef3fa', fontWeight: 700, marginTop: 2 }}>Upcoming site work</div></div>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={selectStyle}><option value={14}>2 weeks</option><option value={21}>3 weeks</option><option value={28}>4 weeks</option><option value={42}>6 weeks</option></select>
          </div>
          {data.summary.lookahead.length === 0 ? <Empty text="No open activities in this window." /> : data.summary.lookahead.map(a => <CompactActivity key={a.id} activity={a} critical={critical.has(a.id)} />)}
        </section>

        {(data.summary.dependencyViolations.length > 0 || data.summary.criticalPath.hasCycle) && <section style={{ ...panelStyle, borderColor: 'rgba(239,68,68,0.35)' }}>
          <div style={{ ...eyebrow, color: '#ef4444' }}>PROGRAMME WARNINGS</div>
          {data.summary.criticalPath.hasCycle && <p style={warningStyle}>Dependency cycle detected. Remove a circular link before using critical-path dates.</p>}
          {data.summary.dependencyViolations.map(v => <p key={v.dependencyId} style={warningStyle}>{byId.get(v.predecessorId)?.title || 'Predecessor'} → {byId.get(v.successorId)?.title || 'Successor'} ({v.type}) is {v.shortfallDays}d inside its required constraint.</p>)}
        </section>}

        <section style={panelStyle}>
          <div style={sectionHeader}>
            <div><div style={eyebrow}>CHANGE CONTROL</div><div style={{ color: '#eef3fa', fontWeight: 700, marginTop: 2 }}>{data.latestBaseline ? `Baseline Rev ${data.latestBaseline.revision}` : 'No committed baseline'} · {data.delays.filter(d => d.status === 'open').length} open delays</div></div>
            {data.permissions.plan && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button onClick={openBaseline} disabled={data.activities.length === 0} style={secondaryButton}>+ Baseline</button><button onClick={openDelay} style={secondaryButton}>+ Delay</button></div>}
          </div>
          {data.latestBaseline && <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b style={{ color: '#eef3fa', fontSize: 12 }}>Rev {data.latestBaseline.revision}{data.latestBaseline.label ? ` · ${data.latestBaseline.label}` : ''}</b><span style={{ color: '#52749a', fontSize: 10 }}>{prettyDate(data.latestBaseline.effectiveAt)}</span></div><div style={{ color: '#8ea8c5', fontSize: 11, marginTop: 4 }}>{data.latestBaseline.reason}</div></div>}
          {data.baselines.length > 1 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{data.baselines.slice(1, 5).map(b => <span key={b.id} style={{ ...codeBadge, color: b.status === 'active' ? '#10b981' : '#8ea8c5' }}>Rev {b.revision} · {b.status}</span>)}</div>}
          {data.delays.length === 0 ? <Empty text="No programme delay events recorded." /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>{data.delays.slice(0, 12).map(delay => <div key={delay.id} style={{ background: '#0d1b2d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}><div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ color: '#eef3fa', fontSize: 12 }}>{delay.title}</b><span style={codeBadge}>{delay.category}</span><span style={{ ...codeBadge, color: delay.status === 'open' ? '#f59e0b' : delay.status === 'accepted' ? '#10b981' : delay.status === 'rejected' ? '#ef4444' : '#8ea8c5' }}>{delay.status}</span></div><div style={{ color: '#52749a', fontSize: 10, marginTop: 4 }}>{prettyDate(delay.startDate)}{delay.endDate ? ` → ${prettyDate(delay.endDate)}` : ''} · {delay.delayDays}d{delay.activity?.title ? ` · ${delay.activity.title}` : ''}</div>{delay.impact && <div style={{ color: '#8ea8c5', fontSize: 11, marginTop: 4 }}>{delay.impact}</div>}{delay.decisionNotes && <div style={{ color: '#8ea8c5', fontSize: 10, marginTop: 4 }}>Decision: {delay.decisionNotes}</div>}</div>{data.permissions.plan && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{delay.status === 'open' && <><button onClick={() => transitionDelay(delay, 'accepted')} style={miniButton}>Accept</button><button onClick={() => transitionDelay(delay, 'rejected')} style={{ ...miniButton, color: '#ef4444' }}>Reject</button><button onClick={() => removeDelay(delay)} aria-label={`Delete ${delay.title}`} style={iconButton}><IcTrash size={13} color="#ef4444" /></button></>}{delay.status === 'accepted' && <button onClick={() => transitionDelay(delay, 'closed')} style={miniButton}>Close</button>}</div>}</div></div>)}</div>}
        </section>

        <section style={panelStyle}>
          <div style={sectionHeader}>
            <div><div style={eyebrow}>MASTER PROGRAMME</div><div style={{ color: '#eef3fa', fontWeight: 700, marginTop: 2 }}>{data.activities.length} activities · {data.summary.criticalPath.projectDurationDays} network days</div></div>
            {data.permissions.plan && <button onClick={() => setShowDependency(true)} disabled={data.activities.length < 2} style={secondaryButton}>+ Dependency</button>}
          </div>
          {data.activities.length === 0 ? <Empty text="Build the project programme by adding the first activity." /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.activities.map(activity => {
              const cpm = cpmById.get(activity.id)
              const sc = statusColor[activity.status] || '#52749a'
              return <article key={activity.id} style={{ background: '#0d1b2d', borderRadius: 12, padding: 12, border: `1px solid ${critical.has(activity.id) ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)'}` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 5, alignSelf: 'stretch', borderRadius: 4, background: critical.has(activity.id) ? '#f59e0b' : sc, minHeight: 58 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                      {activity.code && <span style={codeBadge}>{activity.code}</span>}
                      {critical.has(activity.id) && <span style={{ ...codeBadge, color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }}>CRITICAL</span>}
                      <span style={{ ...codeBadge, color: sc, background: `${sc}18` }}>{statusLabel[activity.status] || activity.status}</span>
                      {cpm && !cpm.critical && <span style={{ fontSize: 10, color: '#52749a', fontFamily: 'var(--font-system)' }}>{Math.round(cpm.totalFloatDays)}d float</span>}
                    </div>
                    <div style={{ color: '#eef3fa', fontWeight: 700, fontSize: 14, marginTop: 6, fontFamily: 'var(--font-system)' }}>{activity.title}</div>
                    <div style={{ color: '#8ea8c5', fontSize: 11, marginTop: 4, fontFamily: 'var(--font-system)' }}>{prettyDate(activity.plannedStart)} → {prettyDate(activity.plannedEnd)}{activity.responsibleMember?.name ? ` · ${activity.responsibleMember.name}` : ''}{activity.location ? ` · ${activity.location}` : ''}</div>
                  </div>
                  {data.permissions.plan && <div style={{ display: 'flex', gap: 5 }}><button onClick={() => openEdit(activity)} aria-label={`Edit ${activity.title}`} style={iconButton}><IcEdit size={13} color="#f59e0b" /></button><button onClick={() => removeActivity(activity)} aria-label={`Delete ${activity.title}`} style={iconButton}><IcTrash size={13} color="#ef4444" /></button></div>}
                </div>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) auto', gap: 10, alignItems: 'center' }}>
                  <div><div style={{ height: 7, borderRadius: 5, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}><div style={{ width: `${activity.progress}%`, height: '100%', background: sc }} /></div><div style={{ marginTop: 3, fontSize: 10, color: '#52749a', fontFamily: 'var(--font-system)' }}>{activity.progress}% complete</div></div>
                  {data.permissions.progress && <div style={{ display: 'flex', gap: 6 }}><select value={activity.status} onChange={e => patchActivity(activity, { status: e.target.value })} aria-label={`Status for ${activity.title}`} style={compactSelect}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select><select value={String(activity.progress)} onChange={e => patchActivity(activity, { progress: Number(e.target.value) })} aria-label={`Progress for ${activity.title}`} style={compactSelect}>{[0,10,25,50,75,90,100].map(v => <option key={v} value={v}>{v}%</option>)}</select></div>}
                </div>
              </article>
            })}
          </div>}
        </section>

        {data.dependencies.length > 0 && <section style={panelStyle}>
          <div style={eyebrow}>DEPENDENCIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>{data.dependencies.map(dep => <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-system)', fontSize: 12 }}><span style={{ flex: 1, color: '#8ea8c5' }}><b style={{ color: '#eef3fa' }}>{byId.get(dep.predecessorId)?.title || 'Activity'}</b> → <b style={{ color: '#eef3fa' }}>{byId.get(dep.successorId)?.title || 'Activity'}</b> · {dep.type}{dep.lagDays ? ` ${dep.lagDays > 0 ? '+' : ''}${dep.lagDays}d` : ''}</span>{data.permissions.plan && <button onClick={() => removeDependency(dep)} aria-label="Remove dependency" style={{ background: 'none', border: 0, cursor: 'pointer' }}><IcX size={13} color="#ef4444" /></button>}</div>)}</div>
        </section>}
      </main>
      <TabBar />

      {showActivity && <Modal onClose={() => setShowActivity(false)} title={editing ? 'Edit programme activity' : 'Add programme activity'}>
        <Field label="Title *"><input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} /></Field>
        <div style={twoCol}><Field label="Code"><input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="A120" style={inputStyle} /></Field><Field label="Responsible"><select value={form.responsibleMemberId} onChange={e => setForm(p => ({ ...p, responsibleMemberId: e.target.value }))} style={inputStyle}><option value="">Unassigned</option>{data.team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field></div>
        <div style={twoCol}><Field label="Planned start *"><input type="date" value={form.plannedStart} onChange={e => setForm(p => ({ ...p, plannedStart: e.target.value }))} style={inputStyle} /></Field><Field label="Planned end *"><input type="date" value={form.plannedEnd} onChange={e => setForm(p => ({ ...p, plannedEnd: e.target.value }))} style={inputStyle} /></Field></div>
        {data.baselineLocked ? <div style={{ padding: '9px 10px', borderRadius: 9, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontSize: 11, lineHeight: 1.5 }}>Baseline Rev {data.latestBaseline?.revision} is locked. Change planned dates here, then create a new baseline revision from Change control.</div> : <div style={twoCol}><Field label="Baseline start"><input type="date" value={form.baselineStart} onChange={e => setForm(p => ({ ...p, baselineStart: e.target.value }))} style={inputStyle} /></Field><Field label="Baseline end"><input type="date" value={form.baselineEnd} onChange={e => setForm(p => ({ ...p, baselineEnd: e.target.value }))} style={inputStyle} /></Field></div>}
        <Field label="Location"><input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Level 03 / East elevation" style={inputStyle} /></Field>
        <Field label="Description"><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <button onClick={saveActivity} disabled={saving || !form.title.trim() || !form.plannedStart || !form.plannedEnd} style={{ ...primaryButton, width: '100%', justifyContent: 'center', padding: '12px 14px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add activity'}</button>
      </Modal>}

      {showDependency && <Modal onClose={() => setShowDependency(false)} title="Add dependency">
        <Field label="Predecessor"><select value={depForm.predecessorId} onChange={e => setDepForm(p => ({ ...p, predecessorId: e.target.value }))} style={inputStyle}><option value="">Select activity</option>{data.activities.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.title}</option>)}</select></Field>
        <Field label="Successor"><select value={depForm.successorId} onChange={e => setDepForm(p => ({ ...p, successorId: e.target.value }))} style={inputStyle}><option value="">Select activity</option>{data.activities.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.title}</option>)}</select></Field>
        <div style={twoCol}><Field label="Type"><select value={depForm.type} onChange={e => setDepForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}><option value="FS">Finish → Start</option><option value="SS">Start → Start</option><option value="FF">Finish → Finish</option><option value="SF">Start → Finish</option></select></Field><Field label="Lag days"><input type="number" min={-365} max={365} value={depForm.lagDays} onChange={e => setDepForm(p => ({ ...p, lagDays: e.target.value }))} style={inputStyle} /></Field></div>
        <button onClick={createDependency} disabled={!depForm.predecessorId || !depForm.successorId} style={{ ...primaryButton, width: '100%', justifyContent: 'center', padding: '12px 14px' }}>Add dependency</button>
      </Modal>}

      {showBaseline && <Modal onClose={() => setShowBaseline(false)} title="Create programme baseline">
        <div style={{ padding: '9px 10px', borderRadius: 9, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontSize: 11, lineHeight: 1.5 }}>Current planned dates and dependencies will be captured as an immutable revision. Activity baseline dates will then adopt the current planned dates.</div>
        <Field label="Label"><input value={baselineForm.label} onChange={e => setBaselineForm(p => ({ ...p, label: e.target.value }))} placeholder="Client agreed Rev B" style={inputStyle} /></Field>
        <Field label="Reason *"><textarea value={baselineForm.reason} onChange={e => setBaselineForm(p => ({ ...p, reason: e.target.value }))} rows={3} placeholder="Approved programme revision following design release" style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <Field label="Effective date"><input type="date" value={baselineForm.effectiveAt} onChange={e => setBaselineForm(p => ({ ...p, effectiveAt: e.target.value }))} style={inputStyle} /></Field>
        <button onClick={createBaseline} disabled={!baselineForm.reason.trim()} style={{ ...primaryButton, width: '100%', justifyContent: 'center', padding: '12px 14px' }}>Commit baseline revision</button>
      </Modal>}

      {showDelay && <Modal onClose={() => setShowDelay(false)} title="Record programme delay">
        <Field label="Title *"><input autoFocus value={delayForm.title} onChange={e => setDelayForm(p => ({ ...p, title: e.target.value }))} placeholder="Cladding delivery delayed" style={inputStyle} /></Field>
        <div style={twoCol}><Field label="Category"><select value={delayForm.category} onChange={e => setDelayForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}><option value="weather">Weather</option><option value="client">Client</option><option value="design">Design</option><option value="supply">Supply</option><option value="labour">Labour</option><option value="access">Access</option><option value="other">Other</option></select></Field><Field label="Activity"><select value={delayForm.activityId} onChange={e => setDelayForm(p => ({ ...p, activityId: e.target.value }))} style={inputStyle}><option value="">Whole project</option>{data.activities.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.title}</option>)}</select></Field></div>
        <div style={twoCol}><Field label="Start *"><input type="date" value={delayForm.startDate} onChange={e => setDelayForm(p => ({ ...p, startDate: e.target.value }))} style={inputStyle} /></Field><Field label="End"><input type="date" value={delayForm.endDate} onChange={e => setDelayForm(p => ({ ...p, endDate: e.target.value }))} style={inputStyle} /></Field></div>
        <Field label="Delay days"><input type="number" min={0} max={3650} value={delayForm.delayDays} onChange={e => setDelayForm(p => ({ ...p, delayDays: e.target.value }))} style={inputStyle} /></Field>
        <Field label="Cause"><textarea value={delayForm.cause} onChange={e => setDelayForm(p => ({ ...p, cause: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <Field label="Impact"><textarea value={delayForm.impact} onChange={e => setDelayForm(p => ({ ...p, impact: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <button onClick={createDelay} disabled={!delayForm.title.trim() || !delayForm.startDate} style={{ ...primaryButton, width: '100%', justifyContent: 'center', padding: '12px 14px' }}>Record delay event</button>
      </Modal>}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) { return <div style={{ minHeight: '100dvh', background: '#06101e', color: '#eef3fa' }}>{children}</div> }
function Kpi({ label, value, color }: { label: string; value: string; color: string }) { return <div style={{ background: '#152641', borderRadius: 12, padding: '11px 12px', border: '1px solid rgba(255,255,255,0.06)' }}><div style={{ ...eyebrow, fontSize: 9 }}>{label}</div><div style={{ color, fontSize: 21, fontWeight: 800, marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>{value}</div></div> }
function CompactActivity({ activity, critical }: { activity: Activity; critical: boolean }) { return <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><div style={{ width: 7, height: 7, borderRadius: 7, background: critical ? '#f59e0b' : statusColor[activity.status] || '#52749a' }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ color: '#eef3fa', fontSize: 12, fontWeight: 650, fontFamily: 'var(--font-system)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activity.title}</div><div style={{ color: '#52749a', fontSize: 10, marginTop: 2, fontFamily: 'var(--font-system)' }}>{prettyDate(activity.plannedStart)} → {prettyDate(activity.plannedEnd)} · {activity.progress}%</div></div></div> }
function Empty({ text }: { text: string }) { return <div style={{ padding: '24px 8px', color: '#52749a', fontSize: 12, textAlign: 'center', fontFamily: 'var(--font-system)' }}>{text}</div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: 'block' }}><span style={{ ...eyebrow, display: 'block', marginBottom: 5 }}>{label}</span>{children}</label> }
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) { return <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}><div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} /><div style={{ position: 'relative', width: '100%', maxWidth: 620, maxHeight: '92dvh', overflowY: 'auto', background: '#152641', borderRadius: '20px 20px 0 0', padding: '22px 18px 34px', display: 'flex', flexDirection: 'column', gap: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-system)' }}>{title}</h2><button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 0, cursor: 'pointer' }}><IcX size={20} color="#8ea8c5" /></button></div>{children}</div></div> }

const headerStyle: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(6,16,30,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }
const panelStyle: React.CSSProperties = { background: '#152641', borderRadius: 14, padding: 14, border: '1px solid rgba(255,255,255,0.07)', marginTop: 12 }
const sectionHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }
const eyebrow: React.CSSProperties = { color: '#52749a', fontSize: 10, fontWeight: 800, letterSpacing: 0.7, fontFamily: 'var(--font-system)' }
const primaryButton: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 9, background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 750, padding: '8px 11px', cursor: 'pointer', fontFamily: 'var(--font-system)' }
const secondaryButton: React.CSSProperties = { border: '1px solid rgba(245,158,11,0.22)', borderRadius: 9, background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '7px 9px', cursor: 'pointer', fontFamily: 'var(--font-system)' }
const miniButton: React.CSSProperties = { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, background: 'rgba(255,255,255,0.04)', color: '#10b981', fontSize: 10, fontWeight: 700, padding: '5px 7px', cursor: 'pointer', fontFamily: 'var(--font-system)' }
const iconButton: React.CSSProperties = { width: 29, height: 29, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#06101e', color: '#eef3fa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 11px', fontFamily: 'var(--font-system)', fontSize: 13 }
const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '7px 8px', fontSize: 11 }
const compactSelect: React.CSSProperties = { ...inputStyle, width: 'auto', padding: '6px 7px', fontSize: 10 }
const codeBadge: React.CSSProperties = { borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: '#8ea8c5', padding: '2px 5px', fontSize: 9, fontWeight: 800, fontFamily: 'ui-monospace, monospace' }
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }
const centerStyle: React.CSSProperties = { minHeight: '70dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }
const warningStyle: React.CSSProperties = { margin: '8px 0 0', color: '#fca5a5', fontSize: 11, lineHeight: 1.5, fontFamily: 'var(--font-system)' }

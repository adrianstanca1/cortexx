'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import {
  IcAlert, IcCamera, IcCheck, IcClock, IcDoc, IcHardhat, IcLayers,
  IcMic, IcPin, IcTeam, IcTruck, IcWrench,
} from '@/components/ui/Icons'

type Project = {
  id: string
  name: string
  status?: string
  assignments?: Array<{ id: string }>
}

type Task = {
  id: string
  title: string
  status: string
  priority?: string
  projectId?: string | null
  project?: { id?: string; name?: string } | null
  assignee?: { name?: string } | null
}

type DashboardPayload = {
  projects?: Project[]
  tasks?: Task[]
  activities?: Array<{ id: string; action: string; createdAt: string }>
  stats?: { hoursThisWeek?: number; activeSites?: number }
}

type LiveCheckin = {
  id: string
  checkedInAt: string
  member?: { id?: string; name?: string; role?: string } | null
}

type FieldEvent = {
  id: string
  actorName: string
  type: string
  title: string
  detail?: string | null
  location?: string | null
  severity: string
  occurredAt: string
}

type FieldPulse = {
  activePermits: number
  expiredPermits: number
  expiringPermits: number
  openInspections: number
  failedInspections: number
  openSnags: number
  highSnags: number
  overdueChecks: number
  openRfis: number
  overdueRfis: number
  openConstraints: number
  criticalConstraints: number
  pendingQaPoints: number
  pendingHandovers: number
  planHit: number | null
}

type ReadinessAlert = {
  id: string
  tone: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  href: string
}

type FieldReadiness = {
  score: number
  status: 'ready' | 'attention' | 'action_required'
  hardStops: number
  alerts: ReadinessAlert[]
}

const EMPTY_PULSE: FieldPulse = {
  activePermits: 0, expiredPermits: 0, expiringPermits: 0, openInspections: 0, failedInspections: 0,
  openSnags: 0, highSnags: 0, overdueChecks: 0, openRfis: 0, overdueRfis: 0,
  openConstraints: 0, criticalConstraints: 0, pendingQaPoints: 0, pendingHandovers: 0, planHit: null,
}

const EMPTY_READINESS: FieldReadiness = {
  score: 100,
  status: 'ready',
  hardStops: 0,
  alerts: [],
}

type Action = {
  label: string
  sub: string
  href: string
  color: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
}

const SF = 'var(--font-system)'
const EVENT_TYPES = ['progress', 'delay', 'delivery', 'instruction', 'access', 'labour', 'quality', 'safety', 'weather', 'other'] as const
const EVENT_LABEL: Record<string, string> = {
  progress: 'Progress', delay: 'Delay', delivery: 'Delivery', instruction: 'Instruction',
  access: 'Access', labour: 'Labour', quality: 'Quality', safety: 'Safety', weather: 'Weather', other: 'Other',
}

const START_SHIFT: Action[] = [
  { label: 'Check in / out', sub: 'GPS-backed attendance', href: '/check-in?new=1', color: '#45d18a', Icon: IcPin },
  { label: 'RAMS', sub: 'Review method statements', href: '/rams', color: '#45d18a', Icon: IcHardhat },
  { label: 'Permits', sub: 'Check permits before work', href: '/permits', color: 'var(--accent)', Icon: IcAlert },
  { label: 'Toolbox talk', sub: 'Brief team and record attendance', href: '/toolbox-talks', color: 'var(--accent)', Icon: IcTeam },
]

const WORK: Action[] = [
  { label: 'Progress capture', sub: 'Photo + GPS evidence', href: '/capture?type=photo', color: '#64a8ff', Icon: IcCamera },
  { label: 'Tasks', sub: 'Today, assigned and urgent work', href: '/tasks', color: '#48d8ff', Icon: IcCheck },
  { label: 'Drawings', sub: 'Latest revisions on site', href: '/drawings', color: '#a58bff', Icon: IcLayers },
  { label: 'Voice RFI', sub: 'Raise an RFI hands-free', href: '/capture?type=voice', color: '#48d8ff', Icon: IcMic },
  { label: 'Deliveries', sub: 'Expected, received and delivery evidence', href: '/field/deliveries', color: 'var(--accent)', Icon: IcTruck },
  { label: 'Productivity', sub: 'Planned vs installed by area/elevation', href: '/field/productivity', color: '#45d18a', Icon: IcLayers },
  { label: 'Materials', sub: 'Materials and site requirements', href: '/materials', color: 'var(--accent)', Icon: IcTruck },
  { label: 'Requisitions', sub: 'Request what the site needs', href: '/requisitions', color: '#a58bff', Icon: IcDoc },
]

const QA_SAFETY: Action[] = [
  { label: 'Inspections', sub: 'Inspections, hold and witness points', href: '/inspections', color: '#45d18a', Icon: IcCheck },
  { label: 'Constraints', sub: 'Blockers, owners, dates and resolution', href: '/field/constraints', color: '#ff6565', Icon: IcAlert },
  { label: 'Snags', sub: 'Defects with photo evidence', href: '/snags', color: '#ff6565', Icon: IcAlert },
  { label: 'Observations', sub: 'Good practice and concerns', href: '/observations', color: '#45d18a', Icon: IcCheck },
  { label: 'Equipment checks', sub: 'Pre-use and recurring checks', href: '/equipment-checks', color: 'var(--accent)', Icon: IcWrench },
  { label: 'Safety', sub: 'Incidents and investigations', href: '/safety', color: '#ff6565', Icon: IcHardhat },
  { label: 'Live status', sub: 'See who is currently on site', href: '/live-status', color: '#48d8ff', Icon: IcTeam },
]

const CLOSE_SHIFT: Action[] = [
  { label: 'Close shift', sub: 'Run close-out checks and create evidence', href: '/field/closeout', color: 'var(--accent)', Icon: IcCheck },
  { label: 'Shift handover', sub: 'Pass priorities, risks and open items', href: '/field/handover', color: 'var(--accent)', Icon: IcTeam },
  { label: 'Site diary', sub: 'Progress, delays and evidence', href: '/site-diary', color: '#45d18a', Icon: IcDoc },
  { label: 'Timesheet', sub: 'Check and submit hours', href: '/timesheets', color: '#a58bff', Icon: IcClock },
  { label: 'Photos', sub: 'Review today’s evidence', href: '/photos', color: '#64a8ff', Icon: IcCamera },
  { label: 'Report incident', sub: 'Record before leaving site', href: '/safety?new=1', color: '#ff6565', Icon: IcAlert },
]

export default function FieldOperationsPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [projectId, setProjectId] = useState('')
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [pulse, setPulse] = useState<FieldPulse>(EMPTY_PULSE)
  const [readiness, setReadiness] = useState<FieldReadiness>(EMPTY_READINESS)
  const [note, setNote] = useState('')
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>('progress')
  const [eventSeverity, setEventSeverity] = useState('info')
  const [fieldEvents, setFieldEvents] = useState<FieldEvent[]>([])
  const [crew, setCrew] = useState<LiveCheckin[]>([])
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteStatus, setNoteStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load field overview')
      const next = await res.json() as DashboardPayload
      setData(next)
      setProjectId(prev => prev || next.projects?.find(p => p.status === 'active')?.id || next.projects?.[0]?.id || '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine)
    refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])

  useEffect(() => {
    if (!projectId || !online) {
      setPulse(EMPTY_PULSE)
      setReadiness(EMPTY_READINESS)
      setCrew([])
      setFieldEvents([])
      return
    }

    let cancelled = false
    fetch(`/api/field-command?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'Failed to load field command brief')
        return payload
      })
      .then(payload => {
        if (cancelled) return
        setPulse({ ...EMPTY_PULSE, ...(payload?.pulse || {}) })
        setReadiness({ ...EMPTY_READINESS, ...(payload?.readiness || {}) })
        setCrew(Array.isArray(payload?.crew) ? payload.crew : [])
        setFieldEvents(Array.isArray(payload?.events) ? payload.events : [])
      })
      .catch(() => {
        if (cancelled) return
        setPulse(EMPTY_PULSE)
        setReadiness({
          ...EMPTY_READINESS,
          status: 'attention',
          score: 0,
          alerts: [{ id: 'brief-unavailable', tone: 'warning', title: 'Command brief unavailable', detail: 'Live readiness data could not be refreshed. Existing field tools remain available.', href: '/field' }],
        })
        setCrew([])
        setFieldEvents([])
      })

    return () => { cancelled = true }
  }, [projectId, online])

  const selected = data?.projects?.find(p => p.id === projectId) || null
  const tasks = useMemo(
    () => (data?.tasks || []).filter(t => !projectId || t.projectId === projectId || t.project?.id === projectId).slice(0, 6),
    [data?.tasks, projectId],
  )
  const openTasks = tasks.filter(t => t.status !== 'done')
  const urgentTasks = openTasks.filter(t => ['high', 'critical'].includes(String(t.priority || '').toLowerCase()))
  const peopleOnSite = crew.length
  const readinessColor = readiness.status === 'action_required' ? '#ef4444' : readiness.status === 'attention' ? '#f59e0b' : '#10b981'
  const readinessLabel = readiness.status === 'action_required' ? 'Action required' : readiness.status === 'attention' ? 'Attention' : 'Ready'

  const saveSiteNote = async () => {
    const detail = note.trim()
    if (!detail || !projectId || noteSaving) return
    setNoteSaving(true)
    setNoteStatus('')
    try {
      const res = await fetch('/api/field-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          type: eventType,
          severity: eventSeverity,
          title: detail.slice(0, 120),
          detail,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'Failed to save event')
      setNote('')
      setNoteStatus(`${EVENT_LABEL[eventType]} logged`)
      if (payload?.event) setFieldEvents(current => [payload.event, ...current].slice(0, 6))
      await load()
    } catch {
      setNoteStatus('Could not save field event')
    } finally {
      setNoteSaving(false)
    }
  }

  const toggleTask = async (task: Task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setTaskBusy(task.id)
    setData(current => current ? {
      ...current,
      tasks: current.tasks?.map(t => t.id === task.id ? { ...t, status: nextStatus } : t),
    } : current)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('Task update failed')
    } catch {
      await load()
    } finally {
      setTaskBusy(null)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 108 }}>
      <header className="surface-glass" style={{
        position: 'sticky', top: 0, zIndex: 40,
        borderLeft: 0, borderRight: 0, borderTop: 0,
      }}>
        <div style={{
          width: 'min(100%, 1180px)', margin: '0 auto',
          padding: '17px clamp(16px, 3vw, 30px) 14px',
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(180px,300px)',
          gap: 16, alignItems: 'end',
        }}>
          <div>
            <div className="section-kicker">Live site command</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
              <h1 className="display-title" style={{ margin: 0, color: 'var(--t1)', fontSize: 'clamp(27px,4vw,40px)' }}>Field operations</h1>
              <div style={{
                padding: '5px 9px', borderRadius: 999,
                background: online ? 'rgba(69,209,138,.10)' : 'rgba(255,157,77,.10)',
                border: `1px solid ${online ? 'rgba(69,209,138,.24)' : 'rgba(255,157,77,.24)'}`,
                color: online ? 'var(--green)' : 'var(--orange)',
                fontFamily: SF, fontWeight: 900, fontSize: 9.5, letterSpacing: '.08em',
              }}>
                {online ? '● LIVE' : '● OFFLINE'}
              </div>
            </div>
            <p style={{ margin: '7px 0 0', color: 'var(--t2)', fontFamily: SF, fontSize: 12.5 }}>
              Readiness, production, QA and site evidence organised around the working shift.
            </p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ color: 'var(--t3)', fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>Active worksite</span>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{
              width: '100%', background: 'var(--surface-raised)', color: 'var(--t1)',
              border: '1px solid var(--hairMid)', borderRadius: 12,
              padding: '11px 12px', fontFamily: SF, fontSize: 13, fontWeight: 750,
              outline: 'none',
            }}>
              {(data?.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              {!data?.projects?.length && <option value="">No active project</option>}
            </select>
          </label>
        </div>
      </header>

      <main style={{ width: 'min(100%, 1180px)', margin: '0 auto', padding: '16px clamp(14px, 3vw, 30px) 0' }}>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <Metric label="Open jobs" value={loading ? '—' : String(openTasks.length)} color="#f59e0b" />
          <Metric label="Urgent" value={loading ? '—' : String(urgentTasks.length)} color={urgentTasks.length ? '#ef4444' : '#10b981'} />
          <Metric label="On site" value={loading ? '—' : String(peopleOnSite)} color="#06b6d4" />
        </section>

        {!online && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.08)', color: '#fbbf24', fontFamily: SF, fontSize: 12, lineHeight: 1.45 }}>
            No signal. Keep working in the mobile app for queued writes; sync will resume automatically when the connection returns.
          </div>
        )}

        <section style={{ marginBottom: 18 }}>
          <SectionTitle title="Field command brief" />
          <div style={{ borderRadius: 16, border: `1px solid ${readinessColor}44`, background: `linear-gradient(135deg, ${readinessColor}12, var(--surface-strong))`, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 13, alignItems: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, display: 'grid', placeItems: 'center', background: `${readinessColor}16`, border: `1px solid ${readinessColor}55` }}>
                <div style={{ textAlign: 'center', fontFamily: SF }}>
                  <div style={{ color: readinessColor, fontSize: 21, lineHeight: 1, fontWeight: 950 }}>{readiness.score}</div>
                  <div style={{ color: 'var(--t3)', fontSize: 8, fontWeight: 900, letterSpacing: '.08em', marginTop: 3 }}>SCORE</div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 15 }}>{readinessLabel}</strong>
                  <span style={{ padding: '4px 7px', borderRadius: 999, background: `${readinessColor}14`, border: `1px solid ${readinessColor}44`, color: readinessColor, fontFamily: SF, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {readiness.hardStops > 0 ? `${readiness.hardStops} critical exception${readiness.hardStops === 1 ? '' : 's'}` : 'No critical exceptions'}
                  </span>
                </div>
                <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 11, lineHeight: 1.45, marginTop: 4 }}>
                  {readiness.status === 'action_required'
                    ? 'Resolve the affected permit, QA, inspection or constraint items before the related work proceeds.'
                    : readiness.status === 'attention'
                      ? 'Work can continue with active warnings that need ownership during the shift.'
                      : 'Current readiness signals show no immediate exception for the selected worksite.'}
                </div>
              </div>
            </div>
            {readiness.alerts.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginTop: 11 }}>
                {readiness.alerts.slice(0, 4).map(alert => {
                  const tone = alert.tone === 'critical' ? '#ef4444' : alert.tone === 'warning' ? '#f59e0b' : '#10b981'
                  return (
                    <Link key={alert.id} href={alert.href} style={{ textDecoration: 'none', borderRadius: 10, padding: '9px 10px', border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.025)', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, marginTop: 4, borderRadius: 999, background: tone, boxShadow: `0 0 0 3px ${tone}18`, flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', color: 'var(--t1)', fontFamily: SF, fontSize: 11.5, fontWeight: 850 }}>{alert.title}</span>
                        <span style={{ display: 'block', color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, lineHeight: 1.4, marginTop: 2 }}>{alert.detail}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <SectionTitle title="Live readiness" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 9 }}>
            <PulseCard href="/permits" label="Active permits" value={pulse.activePermits} alert={pulse.expiredPermits > 0 || pulse.expiringPermits > 0} sub={pulse.expiredPermits ? `${pulse.expiredPermits} past validity` : pulse.expiringPermits ? `${pulse.expiringPermits} expiring soon` : 'No expiry alerts'} />
            <PulseCard href="/inspections" label="Open inspections" value={pulse.openInspections} alert={pulse.failedInspections > 0} sub={pulse.failedInspections ? `${pulse.failedInspections} failed` : 'No failed inspections'} />
            <PulseCard href="/snags" label="Open snags" value={pulse.openSnags} alert={pulse.highSnags > 0} sub={pulse.highSnags ? `${pulse.highSnags} high / critical` : 'No high-priority defects'} />
            <PulseCard href="/equipment-checks?status=overdue" label="Checks overdue" value={pulse.overdueChecks} alert={pulse.overdueChecks > 0} sub="Equipment / plant" />
            <PulseCard href="/rfis" label="Open RFIs" value={pulse.openRfis} alert={pulse.overdueRfis > 0} sub={pulse.overdueRfis ? `${pulse.overdueRfis} overdue` : 'No overdue RFIs'} />
            <PulseCard href="/field/constraints" label="Open constraints" value={pulse.openConstraints} alert={pulse.criticalConstraints > 0} sub={pulse.criticalConstraints ? `${pulse.criticalConstraints} critical` : 'No critical blockers'} />
            <PulseCard href="/inspections" label="QA release waiting" value={pulse.pendingQaPoints} alert={pulse.pendingQaPoints > 0} sub="Hold / witness points" />
            <PulseCard href="/field/handover" label="Handover waiting" value={pulse.pendingHandovers} alert={pulse.pendingHandovers > 0} sub="Awaiting incoming acceptance" />
            <PulseCard href="/field/productivity" label="7-day plan" value={pulse.planHit == null ? 0 : Math.round(pulse.planHit)} alert={pulse.planHit != null && pulse.planHit < 80} sub={pulse.planHit == null ? 'No production logged' : `${pulse.planHit.toFixed(1)}% of planned quantity`} suffix={pulse.planHit == null ? '' : '%'} />
          </div>
        </section>

        <ActionSection title="1 · Start shift" actions={START_SHIFT} />
        <ActionSection title="2 · Execute work" actions={WORK} />

        <section style={{ marginBottom: 18 }}>
          <SectionTitle title="Today’s work" href="/tasks" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!loading && tasks.length === 0 && <Empty text="No assigned work for this site." />}
            {tasks.map(task => {
              const done = task.status === 'done'
              return (
                <button type="button" key={task.id} onClick={() => toggleTask(task)} disabled={taskBusy === task.id} style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, background: 'var(--surface-strong)', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: taskBusy === task.id ? .6 : 1 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${done ? '#10b981' : 'var(--t3)'}`, background: done ? '#10b981' : 'transparent', color: 'var(--bg0)', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 900 }}>{done ? '✓' : ''}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', color: done ? 'var(--t3)' : 'var(--t1)', fontFamily: SF, fontSize: 14, fontWeight: 700, textDecoration: done ? 'line-through' : 'none' }}>{task.title}</span>
                    <span style={{ display: 'block', marginTop: 3, color: ['high', 'critical'].includes(String(task.priority || '').toLowerCase()) ? '#f59e0b' : 'var(--t2)', fontFamily: SF, fontSize: 11, textTransform: 'capitalize' }}>{task.priority || 'normal'}{task.assignee?.name ? ` · ${task.assignee.name}` : ''}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section style={{ marginBottom: 18 }}>
          <SectionTitle title="Log field event" />
          <div style={{ borderRadius: 14, background: 'linear-gradient(180deg, var(--surface-raised), var(--surface-strong))', border: '1px solid var(--hair)', padding: 12 }}>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8 }}>
              {EVENT_TYPES.map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setEventType(type)}
                  style={{
                    flexShrink: 0, borderRadius: 999, padding: '7px 10px',
                    border: `1px solid ${eventType === type ? '#f59e0b' : 'rgba(255,255,255,.09)'}`,
                    background: eventType === type ? 'rgba(245,158,11,.16)' : 'var(--bg1)',
                    color: eventType === type ? '#fbbf24' : 'var(--t2)',
                    fontFamily: SF, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  {EVENT_LABEL[type]}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 9 }}>
              {[
                ['info', 'Info', '#10b981'],
                ['attention', 'Attention', '#f59e0b'],
                ['urgent', 'Urgent', '#ef4444'],
              ].map(([value, label, color]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setEventSeverity(value)}
                  style={{
                    borderRadius: 9, padding: '8px 6px',
                    border: `1px solid ${eventSeverity === value ? color : 'rgba(255,255,255,.08)'}`,
                    background: eventSeverity === value ? `${color}18` : 'var(--bg1)',
                    color: eventSeverity === value ? color : 'var(--t2)',
                    fontFamily: SF, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={e => { setNote(e.target.value); setNoteStatus('') }}
              placeholder="What happened? Add enough detail for the site record…"
              maxLength={500}
              rows={3}
              style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.09)', borderRadius: 11, background: 'var(--bg1)', color: 'var(--t1)', padding: 11, fontFamily: SF, fontSize: 13, lineHeight: 1.45 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 9 }}>
              <span style={{ color: noteStatus.includes('Could not') ? '#ef4444' : noteStatus ? '#10b981' : 'var(--t3)', fontFamily: SF, fontSize: 10.5 }}>
                {noteStatus || `${note.length}/500`}
              </span>
              <button
                type="button"
                onClick={saveSiteNote}
                disabled={!note.trim() || !projectId || noteSaving || !online}
                style={{ border: 'none', borderRadius: 10, padding: '9px 12px', background: '#f59e0b', color: 'var(--bg0)', fontFamily: SF, fontSize: 11, fontWeight: 900, opacity: (!note.trim() || !projectId || noteSaving || !online) ? .45 : 1, cursor: 'pointer' }}
              >
                {noteSaving ? 'Saving…' : 'Log event'}
              </button>
            </div>
          </div>
          {fieldEvents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9 }}>
              {fieldEvents.map(event => {
                const tone = event.severity === 'urgent' ? '#ef4444' : event.severity === 'attention' ? '#f59e0b' : '#10b981'
                return (
                  <div key={event.id} style={{ borderRadius: 11, border: '1px solid rgba(255,255,255,.07)', background: '#0d1c31', padding: '10px 11px', borderLeft: `3px solid ${tone}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 12, fontWeight: 800 }}>{event.title}</span>
                      <span style={{ color: tone, fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', flexShrink: 0 }}>{EVENT_LABEL[event.type] || event.type}</span>
                    </div>
                    <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, marginTop: 4 }}>
                      {event.actorName} · {new Date(event.occurredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <ActionSection title="3 · QA & safety" actions={QA_SAFETY} />
        <ActionSection title="4 · Close shift" actions={CLOSE_SHIFT} />

        <section style={{ marginBottom: 18 }}>
          <SectionTitle title="Site pulse" href="/activity" />
          <div style={{ borderRadius: 14, background: 'linear-gradient(180deg, var(--surface-raised), var(--surface-strong))', border: '1px solid var(--hair)', padding: 14 }}>
            <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 14, fontWeight: 800 }}>{selected?.name || 'Select a project'}</div>
            <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 12, marginTop: 5 }}>
              {(data?.activities || []).length} recent activity events · {(data?.stats?.hoursThisWeek || 0).toFixed(1)}h logged this week
            </div>
            {crew.length > 0 && (
              <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {crew.slice(0, 8).map(checkin => (
                  <span key={checkin.id} style={{ padding: '6px 8px', borderRadius: 999, background: 'rgba(6,182,212,.10)', border: '1px solid rgba(6,182,212,.22)', color: '#67e8f9', fontFamily: SF, fontSize: 10.5, fontWeight: 800 }}>
                    {checkin.member?.name || 'Team member'}
                  </span>
                ))}
                {crew.length > 8 && <span style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, alignSelf: 'center' }}>+{crew.length - 8} more</span>}
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <QuickLink href="/site-diary" label="Daily record" />
              <QuickLink href="/photos" label="Evidence" />
              <QuickLink href="/rfis" label="RFIs" />
              <QuickLink href="/drawings" label="Drawings" />
            </div>
          </div>
        </section>
      </main>

      <TabBar />
    </div>
  )
}

function ActionSection({ title, actions }: { title: string; actions: Action[] }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <SectionTitle title={title} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {actions.map((action, index) => (
          <Link key={action.label} href={action.href} className="command-card" style={{ minHeight: 122, textDecoration: 'none', padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${action.color}18`, border: `1px solid ${action.color}30` }}>
                <action.Icon size={19} color={action.color} />
              </div>
              <span style={{ color: 'var(--t3)', fontFamily: 'ui-monospace, monospace', fontSize: 9, fontWeight: 800 }}>0{index + 1}</span>
            </div>
            <div style={{ marginTop: 14, color: 'var(--t1)', fontFamily: SF, fontSize: 14, fontWeight: 850 }}>{action.label}</div>
            <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, marginTop: 4, lineHeight: 1.45 }}>{action.sub}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 3px 8px' }}>
      <h2 style={{ margin: 0, color: 'var(--t2)', fontFamily: SF, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{title}</h2>
      {href && <Link href={href} style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: SF, fontSize: 11, fontWeight: 800 }}>Open</Link>}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, var(--surface-raised), var(--surface-strong))', border: '1px solid var(--hair)', borderRadius: 12, padding: '11px 10px' }}>
      <div style={{ color, fontFamily: SF, fontSize: 20, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 2, color: 'var(--t2)', fontFamily: SF, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '18px 14px', borderRadius: 12, background: 'var(--surface-strong)', color: 'var(--t3)', textAlign: 'center', fontFamily: SF, fontSize: 12 }}>{text}</div>
}

function PulseCard({ href, label, value, sub, alert, suffix = '' }: { href: string; label: string; value: number; sub: string; alert?: boolean; suffix?: string }) {
  const color = alert ? '#f59e0b' : '#10b981'
  return (
    <Link href={href} style={{ minHeight: 82, textDecoration: 'none', borderRadius: 12, background: 'var(--surface-strong)', border: `1px solid ${alert ? 'rgba(245,158,11,.28)' : 'rgba(255,255,255,.07)'}`, padding: 11 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 12, fontWeight: 800 }}>{label}</span>
        <span style={{ color, fontFamily: SF, fontSize: 20, fontWeight: 900 }}>{value}{suffix}</span>
      </div>
      <div style={{ color: alert ? '#fbbf24' : 'var(--t2)', fontFamily: SF, fontSize: 10.5, marginTop: 7 }}>{sub}</div>
    </Link>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} style={{ padding: '7px 10px', borderRadius: 9, background: 'var(--surface-raised)', color: '#c8d7ea', textDecoration: 'none', fontFamily: SF, fontSize: 11, fontWeight: 700 }}>{label}</Link>
}

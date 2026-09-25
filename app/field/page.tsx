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
  expiringPermits: number
  openInspections: number
  failedInspections: number
  openSnags: number
  overdueChecks: number
  openRfis: number
  overdueRfis: number
}

const EMPTY_PULSE: FieldPulse = {
  activePermits: 0, expiringPermits: 0, openInspections: 0, failedInspections: 0,
  openSnags: 0, overdueChecks: 0, openRfis: 0, overdueRfis: 0,
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
  { label: 'Check in / out', sub: 'GPS-backed attendance', href: '/check-in?new=1', color: '#10b981', Icon: IcPin },
  { label: 'RAMS', sub: 'Review method statements', href: '/rams', color: '#22c55e', Icon: IcHardhat },
  { label: 'Permits', sub: 'Check permits before work', href: '/permits', color: '#f59e0b', Icon: IcAlert },
  { label: 'Toolbox talk', sub: 'Brief team and record attendance', href: '/toolbox-talks', color: '#f59e0b', Icon: IcTeam },
]

const WORK: Action[] = [
  { label: 'Progress capture', sub: 'Photo + GPS evidence', href: '/capture?type=photo', color: '#2563eb', Icon: IcCamera },
  { label: 'Tasks', sub: 'Today, assigned and urgent work', href: '/tasks', color: '#06b6d4', Icon: IcCheck },
  { label: 'Drawings', sub: 'Latest revisions on site', href: '/drawings', color: '#8b5cf6', Icon: IcLayers },
  { label: 'Voice RFI', sub: 'Raise an RFI hands-free', href: '/capture?type=voice', color: '#06b6d4', Icon: IcMic },
  { label: 'Deliveries', sub: 'Expected and received materials', href: '/field/deliveries', color: '#f59e0b', Icon: IcTruck },
  { label: 'Materials', sub: 'Materials and site requirements', href: '/materials', color: '#f59e0b', Icon: IcTruck },
  { label: 'Requisitions', sub: 'Request what the site needs', href: '/requisitions', color: '#8b5cf6', Icon: IcDoc },
]

const QA_SAFETY: Action[] = [
  { label: 'Inspections', sub: 'Quality checks and sign-off', href: '/inspections', color: '#10b981', Icon: IcCheck },
  { label: 'Snags', sub: 'Defects with photo evidence', href: '/snags', color: '#ef4444', Icon: IcAlert },
  { label: 'Observations', sub: 'Good practice and concerns', href: '/observations', color: '#22c55e', Icon: IcCheck },
  { label: 'Equipment checks', sub: 'Pre-use and recurring checks', href: '/equipment-checks', color: '#f59e0b', Icon: IcWrench },
  { label: 'Safety', sub: 'Incidents and investigations', href: '/safety', color: '#ef4444', Icon: IcHardhat },
  { label: 'Live status', sub: 'See who is currently on site', href: '/live-status', color: '#06b6d4', Icon: IcTeam },
]

const CLOSE_SHIFT: Action[] = [
  { label: 'Site diary', sub: 'Progress, delays and evidence', href: '/site-diary', color: '#10b981', Icon: IcDoc },
  { label: 'Timesheet', sub: 'Check and submit hours', href: '/timesheets', color: '#8b5cf6', Icon: IcClock },
  { label: 'Photos', sub: 'Review today’s evidence', href: '/photos', color: '#2563eb', Icon: IcCamera },
  { label: 'Report incident', sub: 'Record before leaving site', href: '/safety?new=1', color: '#ef4444', Icon: IcAlert },
]

export default function FieldOperationsPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [projectId, setProjectId] = useState('')
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [pulse, setPulse] = useState<FieldPulse>(EMPTY_PULSE)
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
      return
    }
    let cancelled = false
    const read = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { cache: 'no-store' })
      return (response.ok ? await response.json() : {}) as T
    }
    Promise.all([
      read<{ activeCount?: number; expiringSoon?: number }>(`/api/permits?projectId=${encodeURIComponent(projectId)}`),
      read<{ openCount?: number; failedCount?: number }>(`/api/inspections?projectId=${encodeURIComponent(projectId)}`),
      read<{ openCount?: number }>(`/api/snags?projectId=${encodeURIComponent(projectId)}&take=1`),
      read<{ checks?: Array<{ project?: { id?: string } | null }> }>('/api/equipment-checks/overdue'),
      read<{ openCount?: number; overdueCount?: number }>(`/api/rfis?projectId=${encodeURIComponent(projectId)}&take=1`),
    ]).then(([permits, inspections, snags, equipment, rfis]) => {
      if (cancelled) return
      const overdueChecks = Array.isArray(equipment?.checks)
        ? equipment.checks.filter((c: { project?: { id?: string } | null }) => c.project?.id === projectId).length
        : 0
      setPulse({
        activePermits: Number(permits?.activeCount || 0),
        expiringPermits: Number(permits?.expiringSoon || 0),
        openInspections: Number(inspections?.openCount || 0),
        failedInspections: Number(inspections?.failedCount || 0),
        openSnags: Number(snags?.openCount || 0),
        overdueChecks,
        openRfis: Number(rfis?.openCount || 0),
        overdueRfis: Number(rfis?.overdueCount || 0),
      })
    }).catch(() => {
      if (!cancelled) setPulse(EMPTY_PULSE)
    })
    return () => { cancelled = true }
  }, [projectId, online])

  useEffect(() => {
    if (!projectId || !online) {
      setCrew([])
      return
    }
    let cancelled = false
    fetch('/api/live-status', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { byProject: [] })
      .then(payload => {
        if (cancelled) return
        const group = (payload?.byProject || []).find((entry: { project?: { id?: string }; checkins?: LiveCheckin[] }) => entry.project?.id === projectId)
        setCrew(group?.checkins || [])
      })
      .catch(() => { if (!cancelled) setCrew([]) })
    return () => { cancelled = true }
  }, [projectId, online])

  useEffect(() => {
    if (!projectId || !online) {
      setFieldEvents([])
      return
    }
    let cancelled = false
    fetch(`/api/field-events?projectId=${encodeURIComponent(projectId)}&take=6`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { events: [] })
      .then(payload => { if (!cancelled) setFieldEvents(payload?.events || []) })
      .catch(() => { if (!cancelled) setFieldEvents([]) })
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
    <div style={{ minHeight: '100dvh', background: '#06101e', paddingBottom: 100 }}>
      <header style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 40, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: '#f59e0b', fontFamily: SF, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Field mode</p>
            <h1 style={{ margin: '3px 0 0', color: '#eef3fa', fontFamily: SF, fontSize: 24, letterSpacing: '-0.03em' }}>Field operations</h1>
            <p style={{ margin: '4px 0 0', color: '#8ea8c5', fontFamily: SF, fontSize: 12 }}>One screen for the working day on site.</p>
          </div>
          <div style={{ padding: '6px 10px', borderRadius: 999, background: online ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', color: online ? '#10b981' : '#f59e0b', fontFamily: SF, fontWeight: 800, fontSize: 11 }}>
            {online ? '● LIVE' : '● OFFLINE'}
          </div>
        </div>

        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ marginTop: 14, width: '100%', background: '#102039', color: '#eef3fa', border: '1px solid rgba(255,255,255,.09)', borderRadius: 12, padding: '12px 13px', fontFamily: SF, fontSize: 14 }}>
          {(data?.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          {!data?.projects?.length && <option value="">No active project</option>}
        </select>
      </header>

      <main style={{ padding: '14px 16px 0' }}>
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
          <SectionTitle title="Live readiness" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <PulseCard href="/permits" label="Active permits" value={pulse.activePermits} alert={pulse.expiringPermits > 0} sub={pulse.expiringPermits ? `${pulse.expiringPermits} expiring soon` : 'No expiry alerts'} />
            <PulseCard href="/inspections" label="Open inspections" value={pulse.openInspections} alert={pulse.failedInspections > 0} sub={pulse.failedInspections ? `${pulse.failedInspections} failed` : 'No failed inspections'} />
            <PulseCard href="/snags" label="Open snags" value={pulse.openSnags} alert={pulse.openSnags > 0} sub="Outstanding defects" />
            <PulseCard href="/equipment-checks?status=overdue" label="Checks overdue" value={pulse.overdueChecks} alert={pulse.overdueChecks > 0} sub="Equipment / plant" />
            <PulseCard href="/rfis" label="Open RFIs" value={pulse.openRfis} alert={pulse.overdueRfis > 0} sub={pulse.overdueRfis ? `${pulse.overdueRfis} overdue` : 'No overdue RFIs'} />
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
                <button type="button" key={task.id} onClick={() => toggleTask(task)} disabled={taskBusy === task.id} style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(255,255,255,.07)', borderRadius: 13, background: '#102039', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: taskBusy === task.id ? .6 : 1 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, border: `1.5px solid ${done ? '#10b981' : '#52749a'}`, background: done ? '#10b981' : 'transparent', color: '#06101e', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 900 }}>{done ? '✓' : ''}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', color: done ? '#52749a' : '#eef3fa', fontFamily: SF, fontSize: 14, fontWeight: 700, textDecoration: done ? 'line-through' : 'none' }}>{task.title}</span>
                    <span style={{ display: 'block', marginTop: 3, color: ['high', 'critical'].includes(String(task.priority || '').toLowerCase()) ? '#f59e0b' : '#8ea8c5', fontFamily: SF, fontSize: 11, textTransform: 'capitalize' }}>{task.priority || 'normal'}{task.assignee?.name ? ` · ${task.assignee.name}` : ''}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section style={{ marginBottom: 18 }}>
          <SectionTitle title="Log field event" />
          <div style={{ borderRadius: 14, background: '#102039', border: '1px solid rgba(255,255,255,.07)', padding: 12 }}>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8 }}>
              {EVENT_TYPES.map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setEventType(type)}
                  style={{
                    flexShrink: 0, borderRadius: 999, padding: '7px 10px',
                    border: `1px solid ${eventType === type ? '#f59e0b' : 'rgba(255,255,255,.09)'}`,
                    background: eventType === type ? 'rgba(245,158,11,.16)' : '#0b1a30',
                    color: eventType === type ? '#fbbf24' : '#8ea8c5',
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
                    background: eventSeverity === value ? `${color}18` : '#0b1a30',
                    color: eventSeverity === value ? color : '#8ea8c5',
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
              style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,.09)', borderRadius: 11, background: '#0b1a30', color: '#eef3fa', padding: 11, fontFamily: SF, fontSize: 13, lineHeight: 1.45 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 9 }}>
              <span style={{ color: noteStatus.includes('Could not') ? '#ef4444' : noteStatus ? '#10b981' : '#52749a', fontFamily: SF, fontSize: 10.5 }}>
                {noteStatus || `${note.length}/500`}
              </span>
              <button
                type="button"
                onClick={saveSiteNote}
                disabled={!note.trim() || !projectId || noteSaving || !online}
                style={{ border: 'none', borderRadius: 10, padding: '9px 12px', background: '#f59e0b', color: '#06101e', fontFamily: SF, fontSize: 11, fontWeight: 900, opacity: (!note.trim() || !projectId || noteSaving || !online) ? .45 : 1, cursor: 'pointer' }}
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
                      <span style={{ color: '#eef3fa', fontFamily: SF, fontSize: 12, fontWeight: 800 }}>{event.title}</span>
                      <span style={{ color: tone, fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', flexShrink: 0 }}>{EVENT_LABEL[event.type] || event.type}</span>
                    </div>
                    <div style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10.5, marginTop: 4 }}>
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
          <div style={{ borderRadius: 14, background: '#102039', border: '1px solid rgba(255,255,255,.07)', padding: 14 }}>
            <div style={{ color: '#eef3fa', fontFamily: SF, fontSize: 14, fontWeight: 800 }}>{selected?.name || 'Select a project'}</div>
            <div style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 12, marginTop: 5 }}>
              {(data?.activities || []).length} recent activity events · {(data?.stats?.hoursThisWeek || 0).toFixed(1)}h logged this week
            </div>
            {crew.length > 0 && (
              <div style={{ marginTop: 9, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {crew.slice(0, 8).map(checkin => (
                  <span key={checkin.id} style={{ padding: '6px 8px', borderRadius: 999, background: 'rgba(6,182,212,.10)', border: '1px solid rgba(6,182,212,.22)', color: '#67e8f9', fontFamily: SF, fontSize: 10.5, fontWeight: 800 }}>
                    {checkin.member?.name || 'Team member'}
                  </span>
                ))}
                {crew.length > 8 && <span style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10.5, alignSelf: 'center' }}>+{crew.length - 8} more</span>}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {actions.map(action => (
          <Link key={action.label} href={action.href} style={{ minHeight: 104, textDecoration: 'none', borderRadius: 14, background: '#102039', border: '1px solid rgba(255,255,255,.07)', padding: 13 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${action.color}20`, marginBottom: 10 }}>
              <action.Icon size={19} color={action.color} />
            </div>
            <div style={{ color: '#eef3fa', fontFamily: SF, fontSize: 14, fontWeight: 800 }}>{action.label}</div>
            <div style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10.5, marginTop: 3, lineHeight: 1.35 }}>{action.sub}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 3px 8px' }}>
      <h2 style={{ margin: 0, color: '#8ea8c5', fontFamily: SF, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>{title}</h2>
      {href && <Link href={href} style={{ color: '#f59e0b', textDecoration: 'none', fontFamily: SF, fontSize: 11, fontWeight: 800 }}>Open</Link>}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#102039', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '11px 10px' }}>
      <div style={{ color, fontFamily: SF, fontSize: 20, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 2, color: '#8ea8c5', fontFamily: SF, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: '18px 14px', borderRadius: 12, background: '#102039', color: '#52749a', textAlign: 'center', fontFamily: SF, fontSize: 12 }}>{text}</div>
}

function PulseCard({ href, label, value, sub, alert }: { href: string; label: string; value: number; sub: string; alert?: boolean }) {
  const color = alert ? '#f59e0b' : '#10b981'
  return (
    <Link href={href} style={{ minHeight: 82, textDecoration: 'none', borderRadius: 12, background: '#102039', border: `1px solid ${alert ? 'rgba(245,158,11,.28)' : 'rgba(255,255,255,.07)'}`, padding: 11 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: '#eef3fa', fontFamily: SF, fontSize: 12, fontWeight: 800 }}>{label}</span>
        <span style={{ color, fontFamily: SF, fontSize: 20, fontWeight: 900 }}>{value}</span>
      </div>
      <div style={{ color: alert ? '#fbbf24' : '#8ea8c5', fontFamily: SF, fontSize: 10.5, marginTop: 7 }}>{sub}</div>
    </Link>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} style={{ padding: '7px 10px', borderRadius: 9, background: '#152641', color: '#c8d7ea', textDecoration: 'none', fontFamily: SF, fontSize: 11, fontWeight: 700 }}>{label}</Link>
}

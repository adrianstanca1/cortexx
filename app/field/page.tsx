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

type Action = {
  label: string
  sub: string
  href: string
  color: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
}

const SF = 'var(--font-system)'

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

  const selected = data?.projects?.find(p => p.id === projectId) || null
  const tasks = useMemo(
    () => (data?.tasks || []).filter(t => !projectId || t.projectId === projectId || t.project?.id === projectId).slice(0, 6),
    [data?.tasks, projectId],
  )
  const openTasks = tasks.filter(t => t.status !== 'done')
  const urgentTasks = openTasks.filter(t => ['high', 'critical'].includes(String(t.priority || '').toLowerCase()))
  const peopleOnSite = selected?.assignments?.length || 0

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

        <ActionSection title="3 · QA & safety" actions={QA_SAFETY} />
        <ActionSection title="4 · Close shift" actions={CLOSE_SHIFT} />

        <section style={{ marginBottom: 18 }}>
          <SectionTitle title="Site pulse" href="/activity" />
          <div style={{ borderRadius: 14, background: '#102039', border: '1px solid rgba(255,255,255,.07)', padding: 14 }}>
            <div style={{ color: '#eef3fa', fontFamily: SF, fontSize: 14, fontWeight: 800 }}>{selected?.name || 'Select a project'}</div>
            <div style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 12, marginTop: 5 }}>
              {(data?.activities || []).length} recent activity events · {(data?.stats?.hoursThisWeek || 0).toFixed(1)}h logged this week
            </div>
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

function QuickLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} style={{ padding: '7px 10px', borderRadius: 9, background: '#152641', color: '#c8d7ea', textDecoration: 'none', fontFamily: SF, fontSize: 11, fontWeight: 700 }}>{label}</Link>
}

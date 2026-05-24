'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcClock, IcChevL, IcChevR } from '@/components/ui/Icons'

interface Project { id: string; name: string }
interface Member { id: string; name: string; avatarColor: string }
interface Task {
  id: string
  title: string
  status: string
  priority: string
  projectId: string | null
  assigneeId: string | null
  dueDate: string | null
  project?: Project | null
  assignee?: Member | null
}
interface Data {
  start: string
  end: string
  weeks: number
  tasks: Task[]
  projects: Project[]
  totalsByProject: Record<string, number>
}

const SF = 'var(--font-system)'

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#52749a',
}
const STATUS_BG: Record<string, string> = {
  done: 'rgba(34,197,94,0.15)',
  in_progress: 'rgba(245,158,11,0.18)',
  todo: 'rgba(59,130,246,0.18)',
}

function startOfWeek(d: Date): Date {
  const next = new Date(d)
  const day = next.getDay() || 7
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - (day - 1))
  return next
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function SchedulePage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [start, setStart] = useState(() => startOfWeek(new Date()))
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8)
  const [projectFilter, setProjectFilter] = useState<string | null>(null)

  const fromIso = useMemo(() => start.toISOString().slice(0, 10), [start])

  const load = useCallback(() => {
    const params = new URLSearchParams({ from: fromIso, weeks: String(weeks) })
    if (projectFilter) params.set('projectId', projectFilter)
    fetch(`/api/schedule?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setData(d); setError(null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [fromIso, weeks, projectFilter])
  useEffect(() => { load() }, [load])

  const shift = (delta: number) => {
    const d = new Date(start)
    d.setDate(d.getDate() + delta * 7)
    setStart(d)
  }
  const jumpToToday = () => setStart(startOfWeek(new Date()))
  const today = dayKey(new Date())

  // Build the day grid headers
  const days: Date[] = useMemo(() => {
    const out: Date[] = []
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      out.push(d)
    }
    return out
  }, [start, weeks])

  // Group tasks by project for the rows
  const rows: { project: Project | null; tasks: Task[] }[] = useMemo(() => {
    if (!data) return []
    const byProj: Record<string, { project: Project | null; tasks: Task[] }> = {}
    for (const p of data.projects) byProj[p.id] = { project: p, tasks: [] }
    byProj['_unassigned'] = { project: null, tasks: [] }
    for (const t of data.tasks) {
      const key = t.projectId || '_unassigned'
      if (!byProj[key]) byProj[key] = { project: t.project || null, tasks: [] }
      byProj[key].tasks.push(t)
    }
    return Object.values(byProj).filter(r => r.tasks.length > 0 || (r.project && !projectFilter))
  }, [data, projectFilter])

  // Width of one day column in px — keeps things responsive
  const colWidth = weeks === 4 ? 36 : weeks === 8 ? 22 : 16
  const labelWidth = 180

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Schedule</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {data ? <>{data.tasks.length} task{data.tasks.length === 1 ? '' : 's'} · {weeks} weeks</> : 'Loading…'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([4, 8, 12] as const).map(w => (
              <button key={w} onClick={() => setWeeks(w)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: weeks === w ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: weeks === w ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{w}w</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button onClick={() => shift(-1)} aria-label="Previous week" style={navBtn}><IcChevL size={16} color="#8ea8c5" /></button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>
            {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(start.getTime() + (weeks * 7 - 1) * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <button onClick={() => shift(1)} aria-label="Next week" style={navBtn}><IcChevR size={16} color="#8ea8c5" /></button>
          <button onClick={jumpToToday} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(6,182,212,0.15)', border: '0.5px solid rgba(6,182,212,0.35)', color: '#06b6d4', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Today</button>
        </div>

        {data && data.projects.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => setProjectFilter(null)} style={chip(!projectFilter)}>All projects</button>
            {data.projects.map(p => (
              <button key={p.id} onClick={() => setProjectFilter(p.id)} style={chip(projectFilter === p.id)}>{p.name}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : !data ? null : data.tasks.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcClock size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No tasks scheduled in this window</p>
          <p style={{ marginTop: 4, fontSize: 12 }}>Tasks need a due date to appear on the schedule.</p>
          <Link href="/tasks" style={{ display: 'inline-block', marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', textDecoration: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>Open tasks</Link>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 20 }}>
          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            {/* Day header — one cell per day, week boundary marks Monday */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, background: '#06101e', zIndex: 5, borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: labelWidth, flexShrink: 0, padding: '6px 8px', fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Project</div>
              {days.map((d, i) => {
                const isMonday = d.getDay() === 1
                const isToday = dayKey(d) === today
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                return (
                  <div key={i} style={{ width: colWidth, flexShrink: 0, padding: '2px 0', borderLeft: isMonday ? '1px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(255,255,255,0.04)', background: isToday ? 'rgba(6,182,212,0.12)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent', textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 9, color: isToday ? '#06b6d4' : isWeekend ? '#52749a' : '#8ea8c5' }}>
                    {d.getDate()}
                  </div>
                )
              })}
            </div>

            {/* Rows: one per project + per-row task bars */}
            {rows.map(row => (
              <div key={row.project?.id || '_'} style={{ display: 'flex', flexDirection: 'column', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', minHeight: 36 }}>
                  <div style={{ width: labelWidth, flexShrink: 0, padding: '6px 10px', fontFamily: SF, fontSize: 12, fontWeight: 600, color: '#eef3fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#06101e', zIndex: 4, borderRight: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {row.project?.name || 'Unassigned'}
                    <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 1 }}>{row.tasks.length} task{row.tasks.length === 1 ? '' : 's'}</div>
                  </div>
                  <div style={{ position: 'relative', flex: 1, minHeight: 36 }}>
                    {/* Day grid background */}
                    <div style={{ display: 'flex', position: 'absolute', inset: 0 }}>
                      {days.map((d, i) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6
                        const isToday = dayKey(d) === today
                        const isMonday = d.getDay() === 1
                        return (
                          <div key={i} style={{ width: colWidth, flexShrink: 0, borderLeft: isMonday ? '1px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(255,255,255,0.03)', background: isToday ? 'rgba(6,182,212,0.06)' : isWeekend ? 'rgba(255,255,255,0.015)' : 'transparent' }} />
                        )
                      })}
                    </div>
                    {/* Task bars */}
                    <div style={{ position: 'relative', padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {row.tasks.map((t, ti) => {
                        if (!t.dueDate) return null
                        const due = new Date(t.dueDate)
                        const dueKey = dayKey(due)
                        const idx = days.findIndex(d => dayKey(d) === dueKey)
                        if (idx < 0) return null
                        const left = idx * colWidth
                        const bg = STATUS_BG[t.status] || STATUS_BG.todo
                        const fg = PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium
                        return (
                          <Link key={t.id} href={`/tasks?focus=${t.id}`} style={{ display: 'block', textDecoration: 'none', marginLeft: left, marginRight: 4, padding: '4px 8px', borderRadius: 6, background: bg, borderLeft: `3px solid ${fg}`, color: '#eef3fa', fontFamily: SF, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: Math.max(colWidth * 4, 140) }}>
                            {t.title}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', fontFamily: SF, fontSize: 11, color: '#52749a' }}>
            {(['critical', 'high', 'medium', 'low'] as const).map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: PRIORITY_COLOR[p], display: 'inline-block' }} />
                <span style={{ textTransform: 'capitalize' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const chip = (active: boolean): React.CSSProperties => ({
  flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none',
  background: active ? '#06b6d4' : 'rgba(255,255,255,0.06)',
  color: active ? '#fff' : '#52749a',
  fontFamily: SF, fontSize: 11, fontWeight: active ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
})

'use client'

/**
 * My day — personal daily agenda. Combines the current user's tasks
 * due today, time entries for today, and meetings on the calendar.
 * Single-screen "what does my day look like" view.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcCheck, IcClock, IcAlert } from '@/components/ui/Icons'

interface Task { id: string; title: string; status: string; priority: string; dueDate?: string | null; project?: { name: string } | null }
interface TimeEntry { id: string; hours: number; date: string; project?: { name: string } | null }
interface Meeting { id: string; title: string; startsAt: string; project?: { name: string } | null }

function isSameDay(iso: string | null | undefined, target: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  return d.getFullYear() === target.getFullYear()
    && d.getMonth() === target.getMonth()
    && d.getDate() === target.getDate()
}

export default function MyDayPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [time, setTime] = useState<TimeEntry[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    // The underlying APIs don't take date filters yet — pull a reasonable
    // page and filter client-side. Worth re-evaluating if any workspace
    // routinely has 100+ open tasks / day.
    Promise.all([
      fetch('/api/tasks?status=open&take=100').then(r => r.ok ? r.json() : { tasks: [] }),
      fetch('/api/timeentries?take=100').then(r => r.ok ? r.json() : { entries: [] }),
      fetch('/api/meetings?take=50').then(r => r.ok ? r.json() : { meetings: [] }),
    ])
      .then(([t, te, m]) => {
        const dueToday = (t.tasks || []).filter((x: Task) =>
          x.status !== 'done' && (isSameDay(x.dueDate, today) || !x.dueDate),
        ).slice(0, 8)
        setTasks(dueToday)
        setTime((te.entries || []).filter((x: TimeEntry) => isSameDay(x.date, today)))
        setMeetings((m.meetings || []).filter((x: Meeting) => isSameDay(x.startsAt, today)))
      })
      .finally(() => setLoading(false))
  }, [])

  const totalHoursToday = time.reduce((sum, t) => sum + (t.hours || 0), 0)
  const now = new Date()

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          My day
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}{loading ? '' : ` · ${tasks.length} tasks · ${meetings.length} meetings · ${totalHoursToday.toFixed(1)}h logged`}
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading && <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>}

        {!loading && meetings.length > 0 && (
          <Section title="Meetings today" color="#06b6d4">
            {meetings.map(m => (
              <Link key={m.id} href="/meetings" style={card}>
                <IcClock size={14} color="#06b6d4" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardTitle}>{m.title}</div>
                  <div style={cardSub}>{new Date(m.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{m.project ? ` · ${m.project.name}` : ''}</div>
                </div>
              </Link>
            ))}
          </Section>
        )}

        {!loading && tasks.length > 0 && (
          <Section title="Tasks due" color="#f59e0b">
            {tasks.map(t => (
              <Link key={t.id} href="/tasks" style={card}>
                <IcCheck size={14} color={t.priority === 'critical' ? '#ef4444' : t.priority === 'high' ? '#f59e0b' : '#52749a'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardTitle}>{t.title}</div>
                  <div style={cardSub}>{t.project?.name || 'No project'} · {t.status}</div>
                </div>
              </Link>
            ))}
          </Section>
        )}

        {!loading && time.length > 0 && (
          <Section title="Time logged" color="#10b981">
            {time.map(t => (
              <div key={t.id} style={card}>
                <IcClock size={14} color="#10b981" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardTitle}>{t.hours}h</div>
                  <div style={cardSub}>{t.project?.name || 'No project'}</div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {!loading && tasks.length === 0 && meetings.length === 0 && time.length === 0 && (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcAlert size={32} color="#52749a" />
            <p style={{ marginTop: 12 }}>Nothing scheduled today.<br />Add a task or meeting to plan your day.</p>
          </div>
        )}
      </div>

      <TabBar />
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  )
}

const card: React.CSSProperties = {
  background: '#152641',
  borderRadius: 10,
  padding: '10px 12px',
  border: '0.5px solid rgba(255,255,255,0.07)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  fontFamily: 'var(--font-system)',
}
const cardTitle: React.CSSProperties = { fontSize: 13, color: '#eef3fa', fontWeight: 600 }
const cardSub: React.CSSProperties = { fontSize: 11, color: '#8ea8c5', marginTop: 2 }

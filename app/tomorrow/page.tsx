'use client'

/**
 * Tomorrow — forward-looking schedule. What's on the calendar for the
 * next 24 hours: meetings, tasks coming due, time slots. Useful for
 * end-of-day planning ("what should I prep for tomorrow?").
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcClock, IcCheck } from '@/components/ui/Icons'

interface Task { id: string; title: string; status: string; priority: string; dueDate?: string | null; project?: { name: string } | null }
interface Meeting { id: string; title: string; startsAt: string; project?: { name: string } | null }

export default function TomorrowPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowISO = tomorrow.toISOString().slice(0, 10)
    const dayAfter = new Date(tomorrow.getTime() + 86400000).toISOString()
    Promise.all([
      fetch(`/api/tasks?dueBefore=${encodeURIComponent(dayAfter)}&dueAfter=${encodeURIComponent(tomorrow.toISOString())}`).then(r => r.ok ? r.json() : { tasks: [] }),
      fetch(`/api/meetings?on=${tomorrowISO}`).then(r => r.ok ? r.json() : { meetings: [] }),
    ])
      .then(([t, m]) => {
        setTasks((t.tasks || []).slice(0, 10))
        setMeetings((m.meetings || []).slice(0, 10))
      })
      .finally(() => setLoading(false))
  }, [])

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          Tomorrow
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          {tomorrow.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}{loading ? '' : ` · ${tasks.length} tasks · ${meetings.length} meetings`}
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading && <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>}

        {!loading && meetings.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font-system)' }}>Meetings</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {meetings.map(m => (
                <Link key={m.id} href="/meetings" style={card}>
                  <IcClock size={14} color="#06b6d4" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={cardTitle}>{m.title}</div>
                    <div style={cardSub}>{new Date(m.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{m.project ? ` · ${m.project.name}` : ''}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && tasks.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font-system)' }}>Tasks due</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map(t => (
                <Link key={t.id} href="/tasks" style={card}>
                  <IcCheck size={14} color={t.priority === 'critical' ? '#ef4444' : t.priority === 'high' ? '#f59e0b' : '#52749a'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={cardTitle}>{t.title}</div>
                    <div style={cardSub}>{t.project?.name || 'No project'} · {t.status}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && tasks.length === 0 && meetings.length === 0 && (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcClock size={32} color="#52749a" />
            <p style={{ marginTop: 12 }}>Nothing scheduled for tomorrow yet.<br />Looks like a clear day.</p>
          </div>
        )}
      </div>

      <TabBar />
    </div>
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

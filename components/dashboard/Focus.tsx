'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardData } from '@/lib/types'

interface FocusProps {
  accent?: string
  data?: DashboardData | null
}

export default function Focus({ accent = '#10b981', data }: FocusProps) {
  const router = useRouter()
  const [snoozed, setSnoozed] = useState(false)
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!snoozeUntil) return
    // Math.max so an already-expired snooze still flushes via setTimeout(0)
    // rather than syncing setState inside the effect body.
    const remaining = Math.max(0, snoozeUntil - Date.now())
    const t = setTimeout(() => { setSnoozed(false); setSnoozeUntil(null) }, remaining)
    return () => clearTimeout(t)
  }, [snoozeUntil])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()

  const tasks = data?.tasks || []
  const focusTask = tasks.find(t => t.priority === 'critical') || tasks.find(t => t.priority === 'high') || tasks[0]
  const upcomingTasks = tasks.slice(1, 3)

  const handleStart = async () => {
    setStarted(true)
    if (focusTask?.projectId) {
      try {
        await fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: focusTask.projectId,
            actorName: 'You',
            actorType: 'user',
            action: `started: ${focusTask.title}`,
            iconType: 'check',
          }),
        })
      } catch {
        // non-critical
      }
      setTimeout(() => router.push(`/projects/${focusTask.projectId}`), 600)
    }
  }

  if (snoozed) {
    return (
      <div style={{ padding: '0 0 100px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 640, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 32, color: '#eef3fa', fontWeight: 600 }}>😴</div>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 18, color: '#8ea8c5', marginTop: 12 }}>Snoozed for 30 min</div>
        <button onClick={() => setSnoozed(false)} style={{ marginTop: 24, background: 'transparent', color: '#52749a', border: '0.5px solid rgba(255,255,255,0.13)', borderRadius: 14, padding: '12px 20px', fontFamily: 'var(--font-system)', fontSize: 14, cursor: 'pointer' }}>Wake up</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 100px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 640 }}>
      <div style={{ padding: '16px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', letterSpacing: 1 }}>{timeStr} · {dateStr}</div>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: started ? '#f59e0b' : accent, boxShadow: `0 0 8px ${started ? '#f59e0b' : accent}` }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px' }}>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>◇ Focus on</div>
        {focusTask ? (
          <>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 34, fontWeight: 600, color: '#eef3fa', letterSpacing: -1, lineHeight: 1.05 }}>
              {focusTask.title}
            </div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 16, color: '#8ea8c5', marginTop: 16, lineHeight: 1.5 }}>
              {focusTask.project?.name && <span style={{ color: '#eef3fa' }}>{focusTask.project.name}.</span>}{' '}
              {focusTask.assignee && <span>Assigned to {focusTask.assignee.name}.</span>}{' '}
              {focusTask.dueDate && <span style={{ color: '#52749a' }}>Due {new Date(focusTask.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</span>}
            </div>
            <div style={{ marginTop: 36, display: 'flex', gap: 10 }}>
              <button onClick={handleStart} style={{ flex: 1, background: started ? '#f59e0b' : accent, color: '#06101e', border: 'none', borderRadius: 14, padding: '16px 18px', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 8px 24px ${accent}55` }}>
                {started ? 'On it…' : 'Start now'}
              </button>
                      <button onClick={() => { setSnoozed(true); setSnoozeUntil(Date.now() + 30 * 60 * 1000) }} style={{ background: 'transparent', color: '#8ea8c5', border: '0.5px solid rgba(255,255,255,0.13)', borderRadius: 14, padding: '16px 20px', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Snooze
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 34, fontWeight: 600, color: '#eef3fa', letterSpacing: -1, lineHeight: 1.05 }}>
              All clear.
            </div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 16, color: '#8ea8c5', marginTop: 16, lineHeight: 1.5 }}>
              No urgent tasks right now. <span style={{ color: '#52749a' }}>Enjoy the quiet.</span>
            </div>
          </>
        )}

        {upcomingTasks.length > 0 && (
          <div style={{ marginTop: 36, paddingTop: 20, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>After this</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#8ea8c5', lineHeight: 1.6 }}>
              {upcomingTasks.map((t, i) => (
                <span key={t.id}>
                  <span style={{ color: '#eef3fa' }}>{t.title}</span>
                  {t.project && <span> · {t.project.name}</span>}
                  {i < upcomingTasks.length - 1 && ',\n'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 24px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#52749a', letterSpacing: 0.5 }}>
          {tasks.length > 0 ? `${tasks.length} open task${tasks.length !== 1 ? 's' : ''} total` : 'No open tasks'}
        </div>
      </div>
    </div>
  )
}

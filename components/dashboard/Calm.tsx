'use client'

import { useRouter } from 'next/navigation'
import { IcBot } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface CalmProps {
  accent?: string
  data?: DashboardData | null
}

export default function Calm({ accent = '#f59e0b', data }: CalmProps) {
  const router = useRouter()
  const today = new Date()
  const dayName = today.toLocaleDateString('en-GB', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  const tasks = (data?.tasks || []).slice(0, 3)
  const activeSites = data?.stats?.activeSites ?? 0

  const threeThings = tasks.length > 0
    ? tasks.map((t, i) => ({
        num: i + 1,
        label: t.title,
        sub: [t.project?.name, t.assignee?.name].filter(Boolean).join(' · ') || (t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'No due date'),
        projectId: t.projectId,
      }))
    : [{ num: 1, label: 'No urgent tasks', sub: 'Everything is on track', projectId: null }]

  return (
    <div style={{ padding: '40px 28px 100px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Big date */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 13, color: '#52749a', fontFamily: 'var(--font-system)', letterSpacing: '0.04em' }}>{dayName.toUpperCase()}</p>
        <h2 style={{ fontSize: 36, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.04em', fontFamily: 'var(--font-system)', lineHeight: 1.1, marginTop: 4 }}>{dateStr}</h2>
      </div>

      {/* Three things hero */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 20 }}>
          {tasks.length > 0 ? `${tasks.length} things today` : 'All clear today'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {threeThings.map((item) => (
            <div key={item.num} onClick={() => item.projectId && router.push(`/projects/${item.projectId}`)} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', cursor: item.projectId ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: `${accent}44`, letterSpacing: '-0.05em', fontFamily: 'var(--font-system)', lineHeight: 1, width: 32, flexShrink: 0 }}>{item.num}</span>
              <div>
                <p style={{ fontSize: 17, fontWeight: 600, color: '#eef3fa', fontFamily: 'var(--font-system)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: '#52749a', marginTop: 3, fontFamily: 'var(--font-system)' }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 28 }} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IcBot size={16} color="#60a5fa" />
        </div>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', flex: 1 }}>
          Cortex is watching{' '}
          <span style={{ color: '#eef3fa', fontWeight: 600 }}>{activeSites} active site{activeSites !== 1 ? 's' : ''}</span>
        </p>
      </div>
    </div>
  )
}

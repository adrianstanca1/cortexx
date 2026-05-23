'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { IcArrowRight } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface CalmProps {
  accent?: string
  data?: DashboardData | null
}

/**
 * Variant 3 — Calm: less data, more whitespace.
 * Matches project/lib/dashboards.jsx DashV3_Calm.
 */
export default function Calm({ accent = '#2563eb', data }: CalmProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const today = new Date()
  const dayDate = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = (session?.user?.name || 'there').split(' ')[0]

  const tasks = (data?.tasks || []).slice(0, 3)
  const count = tasks.length

  // Soft summary describing what's there
  const summary = (() => {
    if (count === 0) return ''
    const sites = new Set(tasks.map(t => t.projectId).filter(Boolean)).size
    const critical = tasks.filter(t => t.priority === 'critical').length
    if (critical > 0) return `${critical} critical, ${count - critical} other.`
    if (sites === 1) return `All on one site.\nNothing on fire.`
    return `Across ${sites} site${sites === 1 ? '' : 's'}.\nNothing on fire.`
  })()

  const SF = 'var(--font-system)'
  const SFMono = 'ui-monospace, "SF Mono", "JetBrains Mono", monospace'

  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ padding: '8px 24px 4px' }}>
        <div style={{ fontFamily: SF, fontSize: 13, color: '#52749a', fontWeight: 500 }}>{dayDate}</div>
      </div>
      <div style={{ padding: '0 24px 28px' }}>
        <div style={{ fontFamily: SF, fontSize: 30, fontWeight: 600, color: '#eef3fa', letterSpacing: -0.8, lineHeight: 1.1 }}>
          {greeting},<br />{firstName}.
        </div>
      </div>

      {/* Single hero stat */}
      <div style={{ padding: '0 24px 32px' }}>
        <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2 }}>Today</div>
        <div style={{ fontFamily: SF, fontSize: 44, fontWeight: 600, color: '#eef3fa', marginTop: 6, letterSpacing: -1.2, lineHeight: 1 }}>
          {count === 0 ? 'All clear' : `${count} thing${count === 1 ? '' : 's'}`}
        </div>
        {summary && (
          <div style={{ fontFamily: SF, fontSize: 14, color: '#8ea8c5', marginTop: 8, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {summary}
          </div>
        )}
      </div>

      {/* Three things — numbered list with hairlines */}
      {count > 0 && (
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          {tasks.map((t, i, arr) => {
            const num = String(i + 1).padStart(2, '0')
            const sub = [
              t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null,
              t.project?.name,
              t.assignee?.name,
            ].filter(Boolean).join(' · ') || 'No due date'
            return (
              <div
                key={t.id}
                onClick={() => t.projectId && router.push(`/projects/${t.projectId}`)}
                style={{
                  padding: '20px 0',
                  borderBottom: i === arr.length - 1 ? 'none' : '0.5px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                  cursor: t.projectId ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  fontFamily: SFMono, fontSize: 11, color: accent, fontWeight: 600,
                  marginTop: 2, letterSpacing: 0.3, width: 18, flexShrink: 0,
                }}>{num}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 500, color: '#eef3fa', lineHeight: 1.3, letterSpacing: -0.2 }}>{t.title}</div>
                  <div style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', marginTop: 4 }}>{sub}</div>
                </div>
                <div style={{ color: '#52749a', marginTop: 4 }}>
                  <IcArrowRight size={16} color="#52749a" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

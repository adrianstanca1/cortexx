'use client'

import { IcPin, IcWrench, IcCheck, IcClock, IcTruck, IcHardhat, IcCamera } from '../ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
import type { DashboardData } from '@/lib/types'

interface TimelineProps {
  accent?: string
  data?: DashboardData | null
}

const iconForActivity = (iconType: string) => {
  if (iconType === 'check') return 'check'
  if (iconType === 'delivery' || iconType === 'truck') return 'truck'
  if (iconType === 'pin' || iconType === 'site') return 'pin'
  if (iconType === 'hardhat') return 'hardhat'
  if (iconType === 'camera' || iconType === 'photo') return 'camera'
  return 'wrench'
}

const colorForActor = (actorType: string) => {
  if (actorType === 'ai') return '#8b5cf6'
  if (actorType === 'system') return '#52749a'
  return '#2563eb'
}

export default function Timeline({ accent = '#f59e0b', data }: TimelineProps) {
  const { activities, connected } = useRealtimeActivity(data?.activities || [])

  const events = activities.map((a, i) => ({
    time: new Date(a.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    label: a.action,
    sub: [a.actorName, a.project?.name, a.detail].filter(Boolean).join(' · '),
    done: i > 0,
    isNow: i === 0,
    icon: iconForActivity(a.iconType),
    color: colorForActor(a.actorType),
  }))

  if (events.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>
        No activity recorded today
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const nowCount = events.filter(e => e.isNow).length

  return (
    <div style={{ padding: '8px 20px 100px' }}>
      <div style={{ padding: '8px 0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em' }}>Today</div>
          <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 8px #10b98166' : 'none', transition: 'all 0.3s' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', marginTop: 2 }}>
          {today} · {events.length} event{events.length === 1 ? '' : 's'}{nowCount > 0 ? ` · ${nowCount} now` : ''}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 42, top: 10, bottom: 10, width: 1, background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map((ev, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 20, opacity: ev.done && !ev.isNow ? 0.45 : 1, position: 'relative' }}>
              <span style={{ width: 42, fontSize: 11, fontWeight: 600, color: ev.isNow ? accent : '#52749a', fontFamily: 'var(--font-system)', flexShrink: 0, paddingTop: 8 }}>
                {ev.time}
              </span>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: ev.isNow ? accent : ev.done ? '#1a2f4e' : 'rgba(255,255,255,0.15)', border: `2px solid ${ev.isNow ? accent : 'rgba(255,255,255,0.2)'}`, flexShrink: 0, marginTop: 10, position: 'relative', zIndex: 1 }}>
                {ev.isNow && (
                  <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', background: `${accent}33`, animation: 'ping 1.5s ease infinite' }} />
                )}
              </div>
              <div style={{ flex: 1, padding: '8px 14px', borderRadius: 14, background: ev.isNow ? `${accent}15` : 'rgba(255,255,255,0.03)', border: ev.isNow ? `1px solid ${accent}44` : '1px solid rgba(255,255,255,0.06)' }}>
                {ev.isNow && <span style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-system)' }}>● LATEST</span>}
                <p style={{ fontSize: 13, fontWeight: 600, color: ev.isNow ? '#eef3fa' : ev.done ? '#8ea8c5' : '#eef3fa', fontFamily: 'var(--font-system)', textDecoration: ev.done && !ev.isNow ? 'line-through' : 'none', marginTop: ev.isNow ? 2 : 0 }}>
                  {ev.label}
                </p>
                <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>{ev.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes ping { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.8); opacity: 0; } }`}</style>
    </div>
  )
}

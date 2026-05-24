'use client'

import { IcFire } from '../ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
import type { DashboardData } from '@/lib/types'

interface RingsProps {
  accent?: string
  data?: DashboardData | null
}

const ringSize = 220
const stroke = 22
const radii = [88, 64, 40]

export default function Rings({ accent = '#2563eb', data }: RingsProps) {
  const { connected } = useRealtimeActivity(data?.activities || [])
  const hoursThisWeek = data?.stats?.hoursThisWeek ?? 0
  const activeSites = data?.stats?.activeSites ?? 0
  const projects = data?.projects || []
  const avgMargin = projects.length > 0
    ? projects.filter(p => p.budget > 0).reduce((s, p) => s + Math.round(((p.budget - p.spent) / p.budget) * 100), 0) / Math.max(projects.filter(p => p.budget > 0).length, 1)
    : 0
  const avgCompletion = projects.length > 0
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0

  const rings = [
    { l: 'Billable', v: Math.min(hoursThisWeek, 60), max: 60, c: '#ff375f', u: 'h', raw: hoursThisWeek },
    { l: 'Margin', v: Math.min(Math.max(avgMargin, 0), 40), max: 40, c: '#a8ff35', u: '%', raw: Math.round(avgMargin) },
    { l: 'Sites', v: activeSites, max: 6, c: '#00d4ff', u: '', raw: activeSites },
  ]

  return (
    <div style={{ padding: '0 0 100px' }}>
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)' }}>This week</h2>
          <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 8px #10b98166' : 'none', transition: 'all 0.3s' }} />
        </div>
        <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>
          Mon — Sun · Week {Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000))}
        </p>
      </div>

      {/* Concentric rings */}
      <div style={{ padding: '8px 0 14px', display: 'flex', justifyContent: 'center' }}>
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          {rings.map((r, i) => {
            const radius = radii[i]
            const circ = 2 * Math.PI * radius
            const pct = r.max > 0 ? Math.min(r.v / r.max, 1) : 0
            return (
              <g key={i} transform={`translate(${ringSize / 2},${ringSize / 2}) rotate(-90)`}>
                <circle r={radius} fill="none" stroke={`${r.c}25`} strokeWidth={stroke} />
                <circle r={radius} fill="none" stroke={r.c} strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={`${circ * pct} ${circ}`} />
              </g>
            )
          })}
          <text x={ringSize / 2} y={ringSize / 2 - 6} textAnchor="middle" fill="#eef3fa" fontSize="28" fontWeight="700" fontFamily="ui-monospace, monospace">{avgCompletion}%</text>
          <text x={ringSize / 2} y={ringSize / 2 + 18} textAnchor="middle" fill="#52749a" fontSize="11" fontFamily="-apple-system, system-ui">avg completion</text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rings.map((r, i) => (
          <div key={i} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: r.c, boxShadow: `0 0 8px ${r.c}88`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', fontWeight: 600 }}>{r.l}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, color: '#eef3fa', fontWeight: 700, marginTop: 1, letterSpacing: -0.4 }}>
                {r.raw}{r.u} <span style={{ color: '#52749a', fontSize: 13 }}>/ {r.max}{r.u}</span>
              </div>
            </div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, color: r.c, fontWeight: 700 }}>{r.max > 0 ? Math.round((r.v / r.max) * 100) : 0}%</div>
          </div>
        ))}
      </div>

      {/* Streak */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(239,68,68,0.13))', border: '0.5px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <IcFire size={24} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{activeSites} active sites</div>
            <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5' }}>{hoursThisWeek}h billed this week across all sites</div>
          </div>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: '#f59e0b', fontWeight: 700 }}>{activeSites}</span>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { IcFilter, IcPlus } from '../ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
import type { DashboardData } from '@/lib/types'

interface SiteMapProps {
  accent?: string
  data?: DashboardData | null
}

const statusColor: Record<string, string> = {
  active: '#10b981', snagging: '#f59e0b', quoting: '#8b5cf6', complete: '#52749a'
}

const SF = '-apple-system, "SF Pro Text", system-ui, sans-serif'
const Mono = 'ui-monospace, monospace'

// Map pin positions (fixed layout for up to 6 projects)
const pinPositions = [
  { x: 145, y: 90 }, { x: 230, y: 110 }, { x: 165, y: 220 },
  { x: 175, y: 75 }, { x: 80, y: 160 }, { x: 260, y: 180 },
]

export default function SiteMap({ accent = '#2563eb', data }: SiteMapProps) {
  const router = useRouter()
  const { connected } = useRealtimeActivity(data?.activities || [])
  const projects = data?.projects || []
  const activeCount = projects.filter(p => p.status === 'active' || p.status === 'snagging').length

  return (
    <div style={{ padding: '0 0 100px' }}>
      <div style={{ padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: SF }}>Sites</h2>
            <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 8px #10b98166' : 'none', transition: 'all 0.3s' }} />
          </div>
          <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{projects.length} site{projects.length !== 1 ? 's' : ''} · {activeCount} active</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/projects')} style={{ width: 36, height: 36, borderRadius: 10, background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcFilter size={16} color="#8ea8c5" />
          </button>
          <button onClick={() => router.push('/projects')} style={{ width: 36, height: 36, borderRadius: 10, background: accent, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={16} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#0d1a2e', border: '0.5px solid rgba(255,255,255,0.07)', height: 300 }}>
          <svg width="100%" height="100%" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="mapgrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapgrid)" />
            <path d="M -10 200 Q 80 180 140 200 T 280 195 Q 340 200 380 185" fill="none" stroke="rgba(6,182,212,0.35)" strokeWidth="14" strokeLinecap="round" />
            <path d="M -10 200 Q 80 180 140 200 T 280 195 Q 340 200 380 185" fill="none" stroke="rgba(6,182,212,0.6)" strokeWidth="2" strokeLinecap="round" />
            {['M 60 0 L 80 300', 'M 200 0 L 220 300', 'M 0 60 L 360 80', 'M 0 140 L 360 130', 'M 0 260 L 360 270'].map((d, i) =>
              <path key={i} d={d} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" fill="none" />
            )}
            {projects.slice(0, 6).map((p, i) => {
              const pos = pinPositions[i]
              const c = statusColor[p.status] || '#52749a'
              const sz = 10
              return (
                <g key={p.id} transform={`translate(${pos.x},${pos.y})`} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${p.id}`)}>
                  <circle r={sz + 8} fill={c} opacity="0.15" />
                  <circle r={sz} fill={c} opacity="0.4" />
                  <circle r={sz - 4} fill={c} />
                  {(p.status === 'active' || p.status === 'snagging') && (
                    <circle r={sz + 4} fill="none" stroke={c} strokeWidth="1">
                      <animate attributeName="r" values={`${sz};${sz + 12}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <text x="0" y={-sz - 6} fontSize="10" fontFamily={SF} fontWeight="600" fill="#eef3fa" textAnchor="middle">{p.name.split(' ')[0]}</text>
                  <text x="0" y={-sz - 17} fontSize="8" fontFamily={Mono} fill={c} textAnchor="middle">{p.progress}%</text>
                </g>
              )
            })}
            {projects.length > 0 && (
              <g transform={`translate(${pinPositions[0].x},${pinPositions[0].y})`}>
                <circle r="6" fill={accent} stroke="#fff" strokeWidth="2" />
                <circle r="14" fill={accent} opacity="0.25">
                  <animate attributeName="r" values="6;20" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </svg>
          {/* Legend overlay */}
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(6,16,30,0.8)', backdropFilter: 'blur(12px)', borderRadius: 8, padding: '6px 10px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: Mono, fontSize: 10, color: '#8ea8c5', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div><span style={{ color: '#10b981' }}>●</span> active</div>
            <div><span style={{ color: '#f59e0b' }}>●</span> snagging</div>
            <div><span style={{ color: '#8b5cf6' }}>●</span> quoting</div>
          </div>
          {projects[0] && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(6,16,30,0.8)', backdropFilter: 'blur(12px)', borderRadius: 8, padding: '6px 10px', border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: Mono, fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>
              {projects[0].name.split(' ')[0]}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.6 }}>All sites</p>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {projects.map((p) => {
          const c = statusColor[p.status] || '#52749a'
          return (
            <div key={p.id} onClick={() => router.push(`/projects/${p.id}`)} style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: '#eef3fa' }}>{p.name}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>{p.postcode}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, background: `${c}22`, color: c, padding: '3px 7px', borderRadius: 5 }}>{p.progress}%</span>
            </div>
          )
        })}
        {projects.length === 0 && <p style={{ fontSize: 13, color: '#52749a', fontFamily: SF, textAlign: 'center', padding: '20px 0' }}>No sites found</p>}
      </div>
    </div>
  )
}

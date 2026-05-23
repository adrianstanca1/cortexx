'use client'

import { useRouter } from 'next/navigation'
import ProgressBar from '../ui/ProgressBar'
import { IcLayers, IcTrend, IcReceipt, IcArrowRight } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface StatusBoardProps {
  accent?: string
  data?: DashboardData | null
}

/**
 * Variant 2 — Status Board: live blueprint readout + telemetry.
 * Matches project/lib/dashboards.jsx DashV2_StatusBoard.
 */
export default function StatusBoard({ accent = '#2563eb', data }: StatusBoardProps) {
  const router = useRouter()
  const projects = data?.projects || []
  const activeSites = data?.stats?.activeSites ?? projects.filter(p => p.status === 'active').length
  const owed = data?.stats?.owed ?? 0
  const owedK = Math.round(owed / 1000)
  const onTime = projects.length > 0 ? Math.round((projects.filter(p => p.progress >= 50).length / projects.length) * 100) : 0
  // Pick the most-recently-active project as the "live readout" hero
  const heroProject = projects.find(p => p.status === 'active') || projects[0]

  const kpis = [
    { l: 'Active', v: String(activeSites), s: 'sites',    c: accent,     I: IcLayers },
    { l: 'On time', v: String(onTime), u: '%', s: 'avg',  c: '#10b981',  I: IcTrend },
    { l: 'Owed',  v: String(owedK), u: 'k',   s: '£', this_wk: true, c: '#f59e0b', I: IcReceipt },
  ] as const

  const SF = 'var(--font-system)'
  const SFMono = 'ui-monospace, "SF Mono", "JetBrains Mono", monospace'

  return (
    <div style={{ padding: '8px 0 100px' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em' }}>Site Status</div>
        <div style={{ fontFamily: SFMono, fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: 600 }}>
          ● LIVE · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.toUpperCase() || 'BST'}
        </div>
      </div>

      {/* Blueprint hero — live floorplan readout */}
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)',
        }}>
          <svg width="100%" height="160" style={{ display: 'block', background: '#0a1830' }}>
            <defs>
              <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={accent} strokeWidth="0.4" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bp-grid)" />
            {/* floorplan */}
            <g transform="translate(60,20)" stroke={accent} strokeWidth="1.5" fill="none">
              <rect x="0" y="0" width="180" height="120" opacity="0.7" />
              <line x1="80" y1="0" x2="80" y2="60" opacity="0.7" />
              <line x1="80" y1="60" x2="180" y2="60" opacity="0.7" />
              <line x1="0" y1="80" x2="80" y2="80" opacity="0.7" />
            </g>
            {/* live dots — one per active site */}
            {activeSites > 0 && (
              <>
                <circle cx="140" cy="80" r="4" fill="#10b981">
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="140" cy="80" r="10" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" />
              </>
            )}
            {activeSites >= 2 && (
              <circle cx="220" cy="120" r="4" fill="#f59e0b">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin="0.5s" />
              </circle>
            )}
            {activeSites >= 3 && (
              <circle cx="110" cy="140" r="4" fill="#10b981">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin="1s" />
              </circle>
            )}
            {activeSites >= 4 && (
              <circle cx="240" cy="60" r="4" fill="#06b6d4">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin="1.5s" />
              </circle>
            )}
          </svg>
          {heroProject && (
            <div
              onClick={() => router.push(`/projects/${heroProject.id}`)}
              style={{ padding: '10px 14px', borderTop: '0.5px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{heroProject.name}</div>
                <div style={{ fontFamily: SFMono, fontSize: 11, color: '#10b981' }}>
                  ● {heroProject.onSiteCount || 0} ON SITE · {heroProject.progress}% complete
                </div>
              </div>
              <IcArrowRight size={16} color="#52749a" />
            </div>
          )}
        </div>
      </div>

      {/* KPI strip — telemetry */}
      <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {kpis.map(k => (
          <div key={k.l} style={{
            background: '#152641', borderRadius: 12, padding: 12,
            border: '0.5px solid rgba(255,255,255,0.07)', position: 'relative',
          }}>
            <div style={{ color: k.c, opacity: 0.7, marginBottom: 4 }}>
              <k.I size={14} color={k.c} />
            </div>
            <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</div>
            <div style={{ fontFamily: SFMono, fontSize: 22, fontWeight: 700, color: k.c, marginTop: 2, letterSpacing: -0.5, lineHeight: 1 }}>
              {'s' in k && k.s === '£' && <span style={{ fontSize: 13, color: '#8ea8c5', marginRight: 1 }}>£</span>}
              {k.v}
              {'u' in k && k.u && <span style={{ fontSize: 13, color: '#8ea8c5' }}>{k.u}</span>}
            </div>
            <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 2 }}>
              {'this_wk' in k ? 'this wk' : k.s}
            </div>
          </div>
        ))}
      </div>

      {/* All sites — compact telemetry rows */}
      <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.6 }}>All sites</span>
        <span style={{ fontFamily: SFMono, fontSize: 11, color: '#10b981' }}>
          {'●'.repeat(activeSites)}{'○'.repeat(Math.max(0, projects.length - activeSites))} live
        </span>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {projects.map(p => {
          const c = p.status === 'active' ? '#10b981' : p.status === 'snagging' ? '#f59e0b' : p.status === 'quoting' ? '#8b5cf6' : '#52749a'
          const stLabel = p.status.toUpperCase()
          return (
            <div
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              style={{
                background: '#152641', borderRadius: 10, padding: '10px 12px',
                border: '0.5px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: '#eef3fa' }}>{p.name}</span>
                  <span style={{ fontFamily: SFMono, fontSize: 10, color: '#52749a' }}>
                    {p.postcode?.split(' ')[0] || ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <ProgressBar value={p.progress} color={c} height={3} />
                  </div>
                  <span style={{ fontFamily: SFMono, fontSize: 10, color: c, fontWeight: 600 }}>{p.progress}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 600 }}>{p.onSiteCount || 0} on site</div>
                <div style={{ fontFamily: SFMono, fontSize: 9, color: c, fontWeight: 700, marginTop: 2, letterSpacing: 0.3 }}>{stLabel}</div>
              </div>
            </div>
          )
        })}
        {projects.length === 0 && (
          <p style={{ fontFamily: SF, fontSize: 13, color: '#52749a', padding: '20px 0', textAlign: 'center' }}>No projects yet</p>
        )}
      </div>
    </div>
  )
}

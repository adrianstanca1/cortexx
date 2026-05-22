'use client'

import { useRouter } from 'next/navigation'
import ProgressBar from '../ui/ProgressBar'
import Pill from '../ui/Pill'
import type { DashboardData } from '@/lib/types'

interface StatusBoardProps {
  accent?: string
  data?: DashboardData | null
}

export default function StatusBoard({ accent = '#f59e0b', data }: StatusBoardProps) {
  const router = useRouter()
  const projects = data?.projects || []
  const activeSites = data?.stats?.activeSites ?? projects.filter(p => p.status === 'active').length
  const owed = data?.stats?.owed ?? 0
  const owedLabel = owed >= 1000 ? `£${Math.round(owed / 1000)}k` : owed > 0 ? `£${owed}` : '£0'
  const onTime = projects.length > 0 ? Math.round((projects.filter(p => p.progress >= 50).length / projects.length) * 100) : 0

  const kpis = [
    { label: 'Active sites', value: String(activeSites), color: '#10b981' },
    { label: 'On track', value: `${onTime}%`, color: '#2563eb' },
    { label: '£ owed', value: owedLabel, color: '#f59e0b' },
  ]

  return (
    <div style={{ padding: '20px 0 100px' }}>
      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 0, padding: '0 20px', marginBottom: 20 }}>
        {kpis.map((kpi, i) => (
          <div key={kpi.label} style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderRight: i < kpis.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: 'rgba(255,255,255,0.03)', borderRadius: i === 0 ? '14px 0 0 14px' : i === kpis.length - 1 ? '0 14px 14px 0' : 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em', fontFamily: 'var(--font-system)' }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Blueprint SVG */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ borderRadius: 18, background: 'rgba(21,38,65,0.8)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative', height: 180 }}>
          <svg width="100%" height="100%" viewBox="0 0 340 180" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(96,165,250,0.08)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="340" height="180" fill="url(#grid)" />
            <rect x="40" y="30" width="120" height="80" fill="none" stroke="rgba(96,165,250,0.4)" strokeWidth="1.5" />
            <rect x="100" y="30" width="60" height="35" fill="rgba(96,165,250,0.06)" stroke="rgba(96,165,250,0.3)" strokeWidth="1" />
            <rect x="40" y="65" width="60" height="45" fill="rgba(96,165,250,0.06)" stroke="rgba(96,165,250,0.3)" strokeWidth="1" />
            <rect x="160" y="30" width="80" height="120" fill="none" stroke="rgba(96,165,250,0.4)" strokeWidth="1.5" />
            <rect x="160" y="80" width="80" height="70" fill="rgba(96,165,250,0.04)" stroke="rgba(96,165,250,0.25)" strokeWidth="1" />
            <path d="M 100 65 A 20 20 0 0 1 80 65" fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="1" />
            <path d="M 160 80 A 20 20 0 0 0 160 60" fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="1" />
            <circle cx="70" cy="50" r="6" fill="rgba(16,185,129,0.3)">
              <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="70" cy="50" r="4" fill="#10b981" />
            <circle cx="200" cy="60" r="6" fill="rgba(37,99,235,0.3)">
              <animate attributeName="r" values="5;8;5" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="200" cy="60" r="4" fill="#2563eb" />
            {activeSites >= 3 && (
              <>
                <circle cx="130" cy="100" r="6" fill="rgba(245,158,11,0.3)">
                  <animate attributeName="r" values="5;8;5" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx="130" cy="100" r="4" fill="#f59e0b" />
              </>
            )}
            {projects[0] && <text x="40" y="125" fill="rgba(96,165,250,0.5)" fontSize="8" fontFamily="monospace">{projects[0].name.toUpperCase().slice(0, 12)}</text>}
            {projects[1] && <text x="160" y="160" fill="rgba(96,165,250,0.5)" fontSize="8" fontFamily="monospace">{projects[1].name.toUpperCase().slice(0, 12)}</text>}
          </svg>
          <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 10, fontWeight: 700, color: 'rgba(96,165,250,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            Site Overview · {projects.length} projects
          </div>
        </div>
      </div>

      {/* Site list */}
      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 10 }}>
          Sites
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map((project) => (
            <div key={project.id} onClick={() => router.push(`/projects/${project.id}`)} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{project.name}</span>
                <Pill label={project.status} />
              </div>
              <ProgressBar value={project.progress} color={project.status === 'active' ? accent : project.status === 'snagging' ? '#10b981' : '#8b5cf6'} animated />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)' }}>{project.onSiteCount} on site</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: accent, fontFamily: 'var(--font-system)' }}>{project.progress}%</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && <p style={{ fontSize: 13, color: '#52749a', fontFamily: 'var(--font-system)', padding: '20px 0', textAlign: 'center' }}>No projects yet</p>}
        </div>
      </div>
    </div>
  )
}

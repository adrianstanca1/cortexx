'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { DashboardData } from '@/lib/types'

interface SiteNoticeProps {
  accent?: string
  data?: DashboardData | null
}

const V15 = {
  bg: '#0e0e10',
  bg2: '#1a1a1e',
  hi: '#ffd60a',
  hi2: '#fbe34a',
  hiDk: '#a98700',
  fg: '#fafafa',
  mute: '#9b9b9f',
  ink: '#0a0a0c',
  green: '#33d17a',
  red: '#ff3b30',
  rule: 'rgba(255,255,255,0.12)',
}

const TITLE = '"Archivo Black", "Anton", Impact, sans-serif'
const SANS = '"Inter Tight", -apple-system, system-ui, sans-serif'
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace'
const HAZARD = `repeating-linear-gradient(45deg, ${V15.hi} 0 14px, ${V15.ink} 14px 28px)`

/**
 * Variant 15 — Site Notice: hazard-tape / construction-noticeboard aesthetic.
 * Ported from cortexx-pwa/dist/dashboards-v5.js (DashV15_SiteNotice).
 */
export default function SiteNotice({ data }: SiteNoticeProps) {
  const router = useRouter()

  useEffect(() => {
    if (document.getElementById('v15-fonts')) return
    const l = document.createElement('link')
    l.id = 'v15-fonts'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter+Tight:wght@400;600;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap'
    document.head.appendChild(l)
  }, [])

  const projects = data?.projects || []
  const tasks = data?.tasks || []
  const todo = tasks.filter(t => t.status !== 'done')
  const high = todo.filter(t => t.priority === 'critical' || t.priority === 'high')
  const onSite = projects.reduce((s, p) => s + (p.onSiteCount || 0), 0)
  const active = projects.filter(p => p.status === 'active')
  const focus = todo[0] || null
  const outstanding = data?.stats?.owed ?? 0
  const pipeline = projects.reduce((s, p) => s + (p.budget || 0), 0)

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayNo = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  return (
    <div style={{
      background: V15.bg, color: V15.fg, minHeight: '100dvh', overflowY: 'auto',
      fontFamily: SANS, paddingBottom: 110,
    }}>
      {/* Hazard tape top bar */}
      <div style={{ height: 16, background: HAZARD }} />

      {/* Folio: notice no. + datestamp */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO, fontSize: 10, color: V15.mute, letterSpacing: 1.4 }}>
        <span>NOTICE №{String(dayNo).padStart(3, '0')}</span>
        <span>{dateStr} · {timeStr}</span>
      </div>

      {/* Big SITE NOTICE banner */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: V15.hi, color: V15.ink,
          padding: '14px 16px 12px',
          border: `3px solid ${V15.ink}`,
          boxShadow: `4px 4px 0 ${V15.hiDk}`,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.6, marginBottom: 4 }}>
            ⚠ POSTED BY THE DESK
          </div>
          <div style={{ fontFamily: TITLE, fontSize: 36, letterSpacing: -1.5, lineHeight: 0.92, textTransform: 'uppercase' }}>
            Site Notice
          </div>
          <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, marginTop: 4, color: V15.ink }}>
            {high.length > 0 ? `${high.length} HIGH-PRIORITY ITEM${high.length === 1 ? '' : 'S'}` : 'NO HIGH-PRIORITY ITEMS'}
            {' · '}{onSite} ON SITE
          </div>
        </div>
      </div>

      {/* TODAY'S FOCUS card */}
      {focus && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{
            background: V15.bg2, border: `2px solid ${V15.hi}`,
            padding: '14px 16px 12px',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: V15.hi, marginBottom: 8 }}>
              ★ FIRST ON YOUR LIST
            </div>
            <div style={{ fontFamily: TITLE, fontSize: 24, lineHeight: 1.05, letterSpacing: -0.5, marginBottom: 6 }}>
              {focus.title}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: V15.mute, marginBottom: 10 }}>
              {focus.project?.name || 'Unassigned'}
              {focus.assignee ? ` · ${focus.assignee.name}` : ''}
              {focus.priority === 'critical' ? ' · CRITICAL' : focus.priority === 'high' ? ' · HIGH PRIORITY' : ''}
            </div>
            <button
              onClick={() => focus.projectId && router.push(`/projects/${focus.projectId}`)}
              style={{
                background: V15.hi, color: V15.ink, border: 'none',
                fontFamily: TITLE, fontSize: 14, letterSpacing: 0.5,
                padding: '10px 16px', cursor: 'pointer', textTransform: 'uppercase',
                boxShadow: `3px 3px 0 ${V15.hiDk}`,
              }}
            >
              Take It On
            </button>
          </div>
        </div>
      )}

      {/* WORKS IN PROGRESS — site rows */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: V15.hi, marginBottom: 10 }}>
          ▣ WORKS IN PROGRESS · {active.length}
        </div>
        {active.length === 0 && (
          <div style={{ fontFamily: SANS, fontSize: 13, color: V15.mute, padding: '20px 0', textAlign: 'center' }}>
            No active sites
          </div>
        )}
        {active.slice(0, 5).map(p => (
          <SiteRow
            key={p.id}
            label={(p.postcode?.split(' ')[0] || '—').toUpperCase()}
            rightLabel={p.status.toUpperCase()}
            value={p.name}
            pct={p.progress}
            onClick={() => router.push(`/projects/${p.id}`)}
          />
        ))}
      </div>

      {/* LEDGER (financials) */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: V15.hi, marginBottom: 10 }}>
          ₤ LEDGER
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <LedgerCell label="PIPELINE" value={`£${Math.round(pipeline / 1000)}k`} note="LIVE" />
          <LedgerCell label="OUTSTANDING" value={`£${Math.round(outstanding / 1000)}k`} note={outstanding > 0 ? 'CHASE' : 'CLEAR'} flag={outstanding > 0} />
        </div>
      </div>

      {/* Bottom hazard tape */}
      <div style={{ height: 16, background: HAZARD, marginTop: 24 }} />
    </div>
  )
}

function SiteRow({ label, rightLabel, value, pct, onClick }: { label: string; rightLabel: string; value: string; pct: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderBottom: `1px solid ${V15.rule}`,
        padding: '12px 16px', cursor: 'pointer', marginBottom: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: V15.mute }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: V15.mute, letterSpacing: 1.2 }}>{rightLabel}</span>
      </div>
      <div style={{ fontFamily: TITLE, fontSize: 24, color: V15.fg, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 8, position: 'relative', height: 6, background: V15.bg, border: `1px solid ${V15.rule}` }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: V15.hi }} />
      </div>
      <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 10, color: V15.hi, fontWeight: 700, letterSpacing: 1.4 }}>{pct}%</div>
    </div>
  )
}

function LedgerCell({ label, value, note, flag }: { label: string; value: string; note: string; flag?: boolean }) {
  return (
    <div style={{
      background: flag ? V15.hi : V15.bg2,
      color: flag ? V15.ink : V15.fg,
      border: `2px solid ${flag ? V15.ink : V15.rule}`,
      padding: '12px 14px',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: TITLE, fontSize: 26, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4, marginTop: 6, color: flag ? V15.ink : V15.hi }}>{note}</div>
    </div>
  )
}

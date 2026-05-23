'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { DashboardData } from '@/lib/types'

interface BroadsheetProps {
  accent?: string
  data?: DashboardData | null
}

const V14 = {
  paper: '#f4ecdc',
  paperLo: '#ede4ce',
  paperHi: '#faf4e6',
  ink: '#1a1814',
  ink2: '#3d3a32',
  ink3: '#6e6759',
  ink4: '#a89d83',
  rule: 'rgba(26,24,20,0.18)',
  ruleMid: 'rgba(26,24,20,0.35)',
  ruleStr: 'rgba(26,24,20,0.7)',
  red: '#8a1c1c',
  green: '#3d5a3d',
  gold: '#7d6b3a',
}

const DISPLAY = '"Playfair Display", "Times New Roman", Georgia, serif'
const BODY = 'Spectral, "Iowan Old Style", Georgia, serif'
const DATA = '"IBM Plex Mono", "SF Mono", ui-monospace, monospace'

/**
 * Variant 14 — Broadsheet: a newspaper-style dashboard.
 * Ported from cortexx-pwa/dist/dashboards-v4.js (DashV14_Broadsheet).
 */
export default function Broadsheet({ data }: BroadsheetProps) {
  const router = useRouter()

  // Load broadsheet fonts on mount (Playfair / Spectral / IBM Plex Mono)
  useEffect(() => {
    if (document.getElementById('v14-fonts')) return
    const l = document.createElement('link')
    l.id = 'v14-fonts'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Spectral:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;700&display=swap'
    document.head.appendChild(l)
  }, [])

  const projects = data?.projects || []
  const tasks = data?.tasks || []
  const todo = tasks.filter(t => t.status !== 'done')
  const onSite = (data?.projects || []).reduce((s, p) => s + (p.onSiteCount || 0), 0)
  const active = projects.filter(p => p.status === 'active').slice(0, 4)
  const focus = todo[0] || null
  const pipeline = projects.reduce((s, p) => s + (p.budget || 0), 0)
  const outstanding = data?.stats?.owed ?? 0
  const cashflow = data?.stats?.cashflow ?? 0

  const today = new Date()
  const dateline = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  const volNo = `VOL. ${(today.getFullYear() - 2020).toString().padStart(2, '0')} · NO. ${dayOfYear}`

  const leadHeadline = focus
    ? (focus.title.length > 60 ? focus.title.slice(0, 58) + '…' : focus.title)
    : 'A quiet day on the books'
  const leadDeck = focus
    ? `${focus.priority === 'critical' || focus.priority === 'high' ? 'High-priority' : focus.priority === 'medium' ? 'Routine' : 'Backlog'} item awaits attention · ${onSite} hand${onSite === 1 ? '' : 's'} on site this morning`
    : `${onSite} hand${onSite === 1 ? '' : 's'} on site, ${todo.length} item${todo.length === 1 ? '' : 's'} in the queue, business as usual`

  const chipBtn = (): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontFamily: DATA, fontSize: 9, letterSpacing: 1.4, fontWeight: 700,
    background: 'transparent', border: `1px solid ${V14.ruleStr}`,
    color: V14.ink, padding: '3px 8px', borderRadius: 2, cursor: 'pointer',
  })

  return (
    <div style={{
      background: `radial-gradient(at 80% 10%, ${V14.paperHi}, ${V14.paper} 40%, ${V14.paperLo})`,
      color: V14.ink, minHeight: '100dvh', overflowY: 'auto',
      fontFamily: BODY, fontSize: 14, lineHeight: 1.5, paddingBottom: 110, position: 'relative',
    }}>
      {/* Paper texture — subtle noise overlay */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22, pointerEvents: 'none', mixBlendMode: 'multiply' }}>
        <defs>
          <filter id="v14-noise">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves={2} stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.5 0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#v14-noise)" />
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top folio: dateline + volume */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ borderTop: `4px double ${V14.ink}`, borderBottom: `1px solid ${V14.ink}`, paddingTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: DATA, fontSize: 9, letterSpacing: 1.4, color: V14.ink2, paddingBottom: 2, textTransform: 'uppercase' }}>
              <span>{dateline}</span>
              <span>{volNo}</span>
            </div>
          </div>

          {/* Masthead */}
          <div style={{ borderBottom: `2px solid ${V14.ink}`, paddingTop: 6, paddingBottom: 2 }}>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 52, letterSpacing: -2.5, lineHeight: 0.9, margin: 0, color: V14.ink }}>
              The <span style={{ fontStyle: 'italic', fontWeight: 700 }}>Cortexx</span> Daily
            </h1>
          </div>

          {/* Tagline + chips */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 4px', borderBottom: `1px solid ${V14.ink}` }}>
            <div style={{ fontFamily: BODY, fontSize: 11, fontStyle: 'italic', color: V14.ink2, letterSpacing: 0.3 }}>
              &ldquo;Built on dirt and detail since 2021&rdquo;
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => router.push('/search')} style={chipBtn()}>SEARCH</button>
              <button onClick={() => router.push('/inbox')} style={chipBtn()}>WIRE</button>
            </div>
          </div>
        </div>

        {/* Weather/conditions strip */}
        <div style={{ margin: '6px 18px 0', padding: '4px 0', fontFamily: DATA, fontSize: 9.5, letterSpacing: 1.4, color: V14.ink2, display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase' }}>
          <span>CAMDEN · 14°C · LIGHT CLOUD · WIND SW 12MPH</span>
          <span>SUNRISE 04:51 · SUNSET 20:48</span>
        </div>

        {/* Lead article */}
        <div style={{ margin: '14px 18px 0' }}>
          <article style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: DATA, fontSize: 9, letterSpacing: 1.6, color: V14.red, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>
              ◆ Today&rsquo;s report · lead
            </div>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 30, letterSpacing: -1, lineHeight: 1.02, margin: '0 0 8px', color: V14.ink }}>
              {leadHeadline}
            </h2>
            <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 14, color: V14.ink2, lineHeight: 1.4, marginBottom: 10 }}>
              {leadDeck}
            </div>
            <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.55, color: V14.ink, textAlign: 'justify', hyphens: 'auto' }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 64, float: 'left', lineHeight: 0.85, marginRight: 8, marginTop: 4, color: V14.ink }}>
                {(focus?.title || 'A')[0].toUpperCase()}
              </span>
              s of dawn, <strong>{onSite}</strong> trade{onSite === 1 ? '' : 's'} reported on site across the active portfolio. The book carries <strong>£{Math.round(pipeline / 1000)}k</strong> of live pipeline against <strong>£{Math.round(outstanding / 1000)}k</strong> outstanding on the ledger.
              {focus ? (
                <> The desk recommends opening with <em>{focus.title.toLowerCase()}</em>; estimates put the work at less than the hour.</>
              ) : (
                <> The desk recommends a clear-out morning — backlog grooming over fresh starts.</>
              )}
            </div>
            {focus && (
              <button
                onClick={() => router.push('/tasks')}
                style={{
                  marginTop: 10, fontFamily: DATA, fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
                  background: V14.ink, color: V14.paperHi, border: 'none', padding: '6px 12px',
                  borderRadius: 2, cursor: 'pointer', textTransform: 'uppercase',
                }}
              >
                Take it on →
              </button>
            )}
          </article>

          {/* Dingbat divider */}
          <Dingbat label="DESK REPORTS" />

          {/* Per-project reports */}
          {active.slice(0, 3).map(p => {
            const margin = p.budget > 0 ? Math.round(((p.budget - p.spent) / p.budget) * 100) : 0
            return (
              <article
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                style={{ marginBottom: 12, cursor: 'pointer' }}
              >
                <div style={{ fontFamily: DATA, fontSize: 8.5, letterSpacing: 1.4, color: V14.ink3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>
                  {p.clientName?.toUpperCase() || 'PROJECT'} · {p.status?.toUpperCase()}
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 19, letterSpacing: -0.4, lineHeight: 1.1, margin: '0 0 4px', color: V14.ink }}>
                  {p.name}
                </h3>
                <div style={{ fontFamily: BODY, fontSize: 12.5, color: V14.ink2, lineHeight: 1.4 }}>
                  Progress at <strong>{p.progress}%</strong> · margin <strong style={{ color: margin < 10 ? V14.red : margin > 25 ? V14.green : V14.gold }}>{margin}%</strong> · {p.onSiteCount || 0} on site today.
                </div>
              </article>
            )
          })}

          {/* Classified ads — financials */}
          <Dingbat label="CLASSIFIED" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <Classified label="Pipeline" value={`£${Math.round(pipeline / 1000)}k`} note="live across portfolio" />
            <Classified label="Outstanding" value={`£${Math.round(outstanding / 1000)}k`} note="awaiting payment" color={outstanding > cashflow ? V14.red : V14.ink} />
            <Classified label="Hands on site" value={String(onSite)} note="this morning" />
            <Classified label="Items in queue" value={String(todo.length)} note="awaiting action" />
          </div>

          {/* Bottom rule */}
          <div style={{ borderTop: `4px double ${V14.ink}`, marginTop: 8, paddingTop: 6, fontFamily: DATA, fontSize: 8.5, letterSpacing: 1.4, color: V14.ink3, textAlign: 'center', textTransform: 'uppercase' }}>
            — End of edition · printed in Camden —
          </div>
        </div>
      </div>
    </div>
  )
}

function Dingbat({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
      <div style={{ flex: 1, height: 1, background: V14.rule }} />
      <span style={{ fontFamily: DATA, fontSize: 9, letterSpacing: 2, fontWeight: 700, color: V14.ink3 }}>
        ❦ {label} ❦
      </span>
      <div style={{ flex: 1, height: 1, background: V14.rule }} />
    </div>
  )
}

function Classified({ label, value, note, color }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div style={{ border: `1.5px solid ${V14.ink}`, padding: '8px 10px 10px', background: V14.paperHi }}>
      <div style={{ fontFamily: DATA, fontSize: 8.5, letterSpacing: 1.4, color: V14.ink3, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${V14.ruleMid}`, paddingBottom: 3, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 22, lineHeight: 1, letterSpacing: -0.5, color: color || V14.ink }}>
        {value}
      </div>
      <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 11, color: V14.ink3, marginTop: 4 }}>
        {note}
      </div>
    </div>
  )
}

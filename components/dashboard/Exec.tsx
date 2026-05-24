'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardData } from '@/lib/types'
import { IcBell, IcTrend, IcCheck, IcHardhat } from '@/components/ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'

interface ExecProps {
  accent?: string
  data?: DashboardData | null
}

const SF = 'var(--font-system)'
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'

const T = {
  bg: '#06101e',
  bg2: '#152641',
  t1: '#eef3fa',
  t2: '#52749a',
  t3: '#8ea8c5',
  hair: 'rgba(255,255,255,0.07)',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
}

/**
 * Variant 13 — Executive: cash-first overview for the founder/PM seat.
 * Ported from cortexx-pwa/dist/screens-phase9.js (DashV13_Exec).
 */
export default function Exec({ data }: ExecProps) {
  const router = useRouter()
  const { connected } = useRealtimeActivity(data?.activities || [])
  const [openSnags, setOpenSnags] = useState(0)
  const [pendingTS, setPendingTS] = useState(0)
  const [inboxCount, setInboxCount] = useState(0)

  useEffect(() => {
    fetch('/api/snags?status=open&take=1').then(r => r.ok ? r.json() : null).then(d => { if (d) setOpenSnags(d.openCount ?? 0) }).catch(() => {})
    fetch('/api/timeentries?approved=false&allWeeks=true').then(r => r.ok ? r.json() : null).then(d => { if (d && Array.isArray(d.entries)) setPendingTS(d.entries.length) }).catch(() => {})
    fetch('/api/inbox').then(r => r.ok ? r.json() : null).then(d => { if (d) setInboxCount(d.total ?? 0) }).catch(() => {})
  }, [])

  const projects = data?.projects || []
  const team = data?.team || []
  const stats = data?.stats
  const activeProjects = projects.filter(p => p.status === 'active').length
  const teamOnSite = team.filter(t => t.onSite).length
  const cash = stats?.cashflow ?? 0
  const outstanding = stats?.owed ?? 0
  const avgMargin = projects.length
    ? projects.reduce((s, p) => {
        const m = p.budget > 0 ? ((p.budget - p.spent) / p.budget) * 100 : 0
        return s + m
      }, 0) / projects.length
    : 0

  // Weekly revenue from invoices paid in the current ISO week
  const invoices = data?.invoices || []
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay() || 7
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (day - 1))
    return d
  })()
  const revenueThisWeek = invoices
    .filter(i => i.paidDate && new Date(i.paidDate) >= weekStart)
    .reduce((s, i) => s + (i.amount || 0), 0)
  const revenueTarget = 80_000
  const revenuePct = Math.max(0, Math.min(100, Math.round((revenueThisWeek / revenueTarget) * 100)))

  const tasks = data?.tasks || []
  const dueTasks = tasks.filter(t => t.dueDate)
  const onTimePct = dueTasks.length
    ? Math.round(
        (dueTasks.filter(t => t.status === 'done' || new Date(t.dueDate!) >= new Date()).length /
          dueTasks.length) *
          100
      )
    : 100

  const today = new Date()
  const week = (() => {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  })()
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const cells = [
    { l: 'Active', v: String(activeProjects), c: T.blue },
    { l: 'Pending TS', v: String(pendingTS), c: T.amber },
    { l: 'Open RFIs', v: '0', c: T.cyan },
    { l: 'Open snags', v: String(openSnags), c: T.red },
    { l: 'Margin %', v: avgMargin.toFixed(0), c: T.green },
    { l: 'On site', v: String(teamOnSite), c: T.purple },
  ]

  return (
    <div style={{ background: T.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 4px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, letterSpacing: -0.4 }}>Executive</div>
            <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : T.t3, boxShadow: connected ? '0 0 8px #10b98166' : 'none', transition: 'all 0.3s' }} />
          </div>
          <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{dateStr} · Wk {week}</div>
        </div>
        <button
          aria-label={inboxCount > 0 ? `Inbox (${inboxCount})` : 'Inbox'}
          onClick={() => router.push('/inbox')}
          style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, background: T.bg2, border: `0.5px solid ${T.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <IcBell size={16} color={inboxCount > 0 ? T.amber : T.t3} />
          {inboxCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: T.red, color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, border: `2px solid ${T.bg}`, boxSizing: 'content-box' }}>
              {inboxCount > 99 ? '99+' : inboxCount}
            </span>
          )}
        </button>
      </div>

      <div style={{ padding: '8px 16px 16px' }}>
        <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Cash position</div>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 700, color: T.t1, marginTop: 4, letterSpacing: -1.5, lineHeight: 1 }}>
          £{cash.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: SF, fontSize: 13, color: T.green, fontWeight: 500 }}>
          <IcTrend size={14} color={T.green} />
          <span>{outstanding > 0 ? `£${outstanding.toLocaleString()} pending in` : 'No outstanding invoices'}</span>
        </div>
      </div>

      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {cells.map((k, i) => (
          <div key={i} style={{ background: T.bg2, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${T.hair}` }}>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</div>
            <div style={{ fontFamily: MONO, fontSize: 22, color: k.c, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '4px 16px 24px' }}>
        <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>This week</div>
        <div style={{ background: T.bg2, borderRadius: 12, border: `0.5px solid ${T.hair}`, overflow: 'hidden' }}>
          <Row
            icon={<IcTrend size={16} color="#fff" />}
            iconBg={T.green}
            title={`Revenue: £${revenueThisWeek.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`}
            sub={`Target £${revenueTarget.toLocaleString('en-GB')} · ${revenuePct}%`}
            onClick={() => router.push('/reports')}
          />
          <Row
            icon={<IcCheck size={16} color="#fff" />}
            iconBg={T.blue}
            title={`On-time delivery ${onTimePct}%`}
            sub={dueTasks.length ? `${dueTasks.length} tasks with due dates` : 'No deadlines tracked yet'}
          />
          <Row
            icon={<IcHardhat size={16} color="#fff" />}
            iconBg={T.amber}
            title="Safety score —"
            sub="Add safety inspections to track"
            isLast
          />
        </div>
      </div>
    </div>
  )
}

function Row({ icon, iconBg, title, sub, isLast, onClick }: { icon: React.ReactNode; iconBg: string; title: string; sub?: string; isLast?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: isLast ? 'none' : `0.5px solid ${T.hair}`, textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, lineHeight: 1.3 }}>{title}</div>
        {sub && <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  )
}

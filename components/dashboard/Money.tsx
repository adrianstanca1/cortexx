'use client'

import { IcTrend, IcArrowUp, IcArrowRight } from '../ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
import type { DashboardData } from '@/lib/types'

interface MoneyProps {
  accent?: string
  data?: DashboardData | null
}

/**
 * Variant 8 — Books: cashflow first.
 * Matches project/lib/dashboards-v2.jsx DashV8_Money.
 */
export default function Money({ accent = '#10b981', data }: MoneyProps) {
  const { connected } = useRealtimeActivity(data?.activities || [])
  const invoices = data?.invoices || []
  const cashflow = data?.stats?.cashflow ?? 0
  const owed = data?.stats?.owed ?? 0
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  const totalSpent = data?.projects?.reduce((s, p) => s + p.spent, 0) ?? 0
  const net = cashflow - totalSpent

  // Week-of-year (ISO-ish)
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const wk = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  const monthName = now.toLocaleDateString('en-GB', { month: 'long' })
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()

  const fmt = (v: number) => v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`
  const netLabel = `${net >= 0 ? '+' : '-'}£${(Math.abs(net) / 1000).toFixed(1)}k`
  const paidCount = invoices.filter(i => i.status === 'paid').length

  const SF = 'var(--font-system)'
  const SFMono = 'ui-monospace, "SF Mono", "JetBrains Mono", monospace'

  return (
    <div style={{ padding: '8px 0 100px' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em' }}>Books</div>
          <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 8px #10b98166' : 'none', transition: 'all 0.3s' }} />
        </div>
        <div style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', marginTop: 2 }}>Wk {wk} · CIS aware</div>
      </div>

      {/* Big money number */}
      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          Net cashflow · {monthName}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{
            fontFamily: SFMono, fontSize: 48, fontWeight: 700,
            color: net >= 0 ? '#eef3fa' : '#ef4444',
            letterSpacing: -1.5, lineHeight: 1,
          }}>{netLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: SF, fontSize: 13, color: '#10b981', fontWeight: 500 }}>
          <IcTrend size={14} color="#10b981" />
          <span>{paidCount} invoice{paidCount === 1 ? '' : 's'} paid</span>
          <span style={{ color: '#52749a', marginLeft: 4 }}>· {daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
        </div>

        {/* Sparkline — real data from paid invoices over last 12 weeks */}
        {(() => {
          const weeks = Array.from({ length: 12 }, (_, i) => {
            const weeksAgo = 11 - i
            const start = new Date(now)
            start.setDate(start.getDate() - start.getDay() - weeksAgo * 7)
            start.setHours(0, 0, 0, 0)
            const end = new Date(start)
            end.setDate(end.getDate() + 7)
            return invoices
              .filter(iv => iv.status === 'paid' && new Date(iv.issuedDate) >= start && new Date(iv.issuedDate) < end)
              .reduce((s, iv) => s + iv.amount, 0)
          })
          const max = Math.max(...weeks, 1)
          const pts = weeks.map((v, i) => `${(i / 11) * 320},${60 - (v / max) * 50}`).join(' ')
          return (
            <svg width="100%" height="80" viewBox="0 0 320 80" style={{ marginTop: 14 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 20, 40, 60].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />)}
              <polyline points={pts} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={`${pts} 320,80 0,80`} fill="url(#sparkfill)" stroke="none" />
              <circle cx="320" cy={60 - (weeks[11] / max) * 50} r="4" fill={accent} />
              <circle cx="320" cy={60 - (weeks[11] / max) * 50} r="8" fill={accent} opacity="0.3" />
            </svg>
          )
        })()}
      </div>

      {/* In / Out split */}
      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: 'rgba(16,185,129,0.10)', border: '0.5px solid rgba(16,185,129,0.33)', borderRadius: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>IN</div>
            <span style={{ color: '#10b981' }}><IcArrowUp size={14} color="#10b981" /></span>
          </div>
          <div style={{ fontFamily: SFMono, fontSize: 22, fontWeight: 700, color: '#eef3fa', marginTop: 4, letterSpacing: -0.5 }}>{fmt(cashflow)}</div>
          <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
            {paidCount} invoice{paidCount === 1 ? '' : 's'} paid
          </div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.10)', border: '0.5px solid rgba(239,68,68,0.33)', borderRadius: 14, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>OUT</div>
            <span style={{ color: '#ef4444', transform: 'rotate(180deg)', display: 'inline-flex' }}><IcArrowUp size={14} color="#ef4444" /></span>
          </div>
          <div style={{ fontFamily: SFMono, fontSize: 22, fontWeight: 700, color: '#eef3fa', marginTop: 4, letterSpacing: -0.5 }}>{fmt(totalSpent)}</div>
          <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>materials + wages</div>
        </div>
      </div>

      {/* Outstanding */}
      {outstanding.length > 0 && (
        <>
          <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Outstanding · {fmt(owed)}
            </span>
          </div>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {outstanding.map(iv => {
              const due = new Date(iv.dueDate)
              const days = Math.round((due.getTime() - now.getTime()) / 86400000)
              const col = iv.status === 'overdue' ? '#ef4444' : days <= 3 ? '#f59e0b' : '#eef3fa'
              const daysLabel = days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'today' : `${days}d`
              return (
                <div
                  key={iv.id}
                  style={{
                    background: '#152641', borderRadius: 10, padding: '10px 12px',
                    border: '0.5px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: col }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SFMono, fontSize: 11, color: '#8ea8c5', fontWeight: 600 }}>{iv.number}</div>
                    <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 500, marginTop: 1 }}>
                      {iv.project?.name || iv.clientName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: SFMono, fontSize: 14, color: col, fontWeight: 700 }}>£{iv.amount.toLocaleString()}</div>
                    <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 1 }}>{daysLabel}</div>
                  </div>
                  <IcArrowRight size={14} color="#52749a" />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

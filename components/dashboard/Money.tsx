'use client'

import { IcTrend, IcTrendDown, IcArrowRight } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface MoneyProps {
  accent?: string
  data?: DashboardData | null
}

export default function Money({ accent = '#f59e0b', data }: MoneyProps) {
  const invoices = data?.invoices || []
  const cashflow = data?.stats?.cashflow ?? 0
  const owed = data?.stats?.owed ?? 0

  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  const totalSpent = data?.projects?.reduce((s, p) => s + p.spent, 0) ?? 0

  const cashLabel = cashflow >= 1000 ? `+£${(cashflow / 1000).toFixed(1)}k` : cashflow > 0 ? `+£${cashflow}` : '£0'
  const paidCount = invoices.filter(i => i.status === 'paid').length

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      {/* Big hero number */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: '#52749a', fontFamily: 'var(--font-system)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Cash in · this period
        </p>
        <h2 style={{ fontSize: 48, fontWeight: 800, color: '#10b981', letterSpacing: '-0.05em', fontFamily: 'var(--font-system)', lineHeight: 1, marginTop: 8 }}>
          {cashLabel}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6 }}>
          <IcTrend size={14} color="#10b981" />
          <span style={{ fontSize: 12, color: '#10b981', fontFamily: 'var(--font-system)' }}>{paidCount} invoice{paidCount !== 1 ? 's' : ''} paid</span>
        </div>
      </div>

      {/* Sparkline chart — from real paid invoices by week */}
      {(() => {
        const now = new Date()
        const weeks = [3, 2, 1, 0].map(weeksAgo => {
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() - weeksAgo * 7)
          weekStart.setHours(0, 0, 0, 0)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 7)
          return invoices
            .filter(i => i.status === 'paid' && new Date(i.issuedDate) >= weekStart && new Date(i.issuedDate) < weekEnd)
            .reduce((s, i) => s + i.amount, 0)
        })
        const maxVal = Math.max(...weeks, 1)
        const pts = weeks.map((v, i) => ({ x: i * 100, y: 55 - Math.round((v / maxVal) * 48) }))
        const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
        const areaPath = `${linePath} L300,60 L0,60Z`
        const weekLabels = [3, 2, 1, 0].map(w => {
          const d = new Date(now)
          d.setDate(d.getDate() - d.getDay() - w * 7)
          return `W${d.getDate()}/${d.getMonth() + 1}`
        })
        return (
          <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '16px 16px 8px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              {weekLabels.map((w) => (
                <span key={w} style={{ fontSize: 10, color: '#52749a', fontFamily: 'var(--font-system)' }}>{w}</span>
              ))}
            </div>
            <svg width="100%" height="60" viewBox="0 0 300 60">
              <defs>
                <linearGradient id="moneyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
              <path d={areaPath} fill="url(#moneyGrad)" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#10b981" />
              ))}
            </svg>
          </div>
        )
      })()}

      {/* IN / OUT split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '16px', borderRadius: 16, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IcTrend size={14} color="#10b981" />
            <span style={{ fontSize: 11, color: '#10b981', fontFamily: 'var(--font-system)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>IN</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-system)', letterSpacing: '-0.03em' }}>
            £{cashflow.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)', marginTop: 4 }}>
            {paidCount} payment{paidCount !== 1 ? 's' : ''} received
          </p>
        </div>
        <div style={{ padding: '16px', borderRadius: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IcTrendDown size={14} color="#ef4444" />
            <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'var(--font-system)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>OUT</span>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-system)', letterSpacing: '-0.03em' }}>
            £{totalSpent.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)', marginTop: 4 }}>Labour + materials</p>
        </div>
      </div>

      {/* Outstanding invoices */}
      {outstanding.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 10 }}>
            Outstanding invoices
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outstanding.map((inv) => {
              const due = new Date(inv.dueDate)
              const today = new Date()
              const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000)
              return (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{inv.project?.name || inv.clientName}</p>
                    <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)', marginTop: 1 }}>
                      {inv.number}{daysUntil < 0 ? ` · ${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? ' · due today' : ` · due in ${daysUntil}d`}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: inv.status === 'overdue' ? '#ef4444' : inv.status === 'sent' ? accent : '#52749a', fontFamily: 'var(--font-system)' }}>
                      £{inv.amount.toLocaleString()}
                    </p>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: inv.status === 'overdue' ? '#ef4444' : inv.status === 'sent' ? '#2563eb' : '#52749a', fontFamily: 'var(--font-system)' }}>
                      {inv.status}
                    </span>
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

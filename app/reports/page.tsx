'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL } from '@/components/ui/Icons'

interface MonthBucket { ym: string; label: string; outflow: number; inflow: number; net: number }
interface Report {
  finance: { totalBudget: number; totalSpent: number; marginPct: number; totalInvoiced: number; paid: number; owed: number; overdue: number; collectedPct: number }
  projects: { total: number; active: number; snagging: number; quoting: number; complete: number; onSiteCount: number; margins: Array<{ id: string; name: string; status: string; budget: number; spent: number; progress: number; marginPct: number; spentPct: number; overBudget: boolean }> }
  tasks: { byStatus: Record<string, number>; byPriority: Record<string, number>; total: number }
  activity: { last30Days: number }
  hours: { thisWeek: number; thisMonth: number }
  cashflow?: {
    months: MonthBucket[]
    forecast: { ym: string; label: string; outflow: number; inflow: number; net: number; basis: string }
  }
}

const statusColor: Record<string, string> = { active: '#10b981', snagging: '#f59e0b', quoting: '#8b5cf6', complete: '#52749a' }

export default function ReportsPage() {
  const [r, setR] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports')
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json() })
      .then(d => { setR(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Back</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: 'var(--font-system)' }}>Reports</h1>
        <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>Across your entire workspace</p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
      ) : r ? (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Finance */}
          <section>
            <SectionHeader>Finance</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Stat label="Total budget" value={`£${r.finance.totalBudget.toLocaleString()}`} />
              <Stat label="Total spent" value={`£${r.finance.totalSpent.toLocaleString()}`} accent={r.finance.totalSpent > r.finance.totalBudget ? '#ef4444' : '#10b981'} />
              <Stat label="Margin" value={`${r.finance.marginPct}%`} accent={r.finance.marginPct < 10 ? '#ef4444' : r.finance.marginPct < 20 ? '#f59e0b' : '#10b981'} />
              <Stat label="Collected" value={`${r.finance.collectedPct}%`} accent="#2563eb" />
              <Stat label="Paid invoices" value={`£${r.finance.paid.toLocaleString()}`} />
              <Stat label="Outstanding" value={`£${r.finance.owed.toLocaleString()}`} accent={r.finance.owed > 0 ? '#f59e0b' : '#10b981'} />
              {r.finance.overdue > 0 && (
                <Stat label="Overdue" value={`£${r.finance.overdue.toLocaleString()}`} accent="#ef4444" full />
              )}
            </div>
          </section>

          {/* Projects */}
          <section>
            <SectionHeader>Projects ({r.projects.total})</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
              <PillStat label="Active" value={r.projects.active} color={statusColor.active} />
              <PillStat label="Snagging" value={r.projects.snagging} color={statusColor.snagging} />
              <PillStat label="Quoting" value={r.projects.quoting} color={statusColor.quoting} />
              <PillStat label="Done" value={r.projects.complete} color={statusColor.complete} />
            </div>
            {r.projects.margins.length > 0 && (
              <>
                <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Margins (lowest first)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.projects.margins.slice(0, 8).map(p => (
                    <Link key={p.id} href={`/projects/${p.id}`} style={projRow}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: statusColor[p.status] || '#52749a' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5' }}>£{p.spent.toLocaleString()} of £{p.budget.toLocaleString()}</div>
                      </div>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 700, color: p.overBudget ? '#ef4444' : p.marginPct < 10 ? '#f59e0b' : '#10b981' }}>
                        {p.marginPct}%
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Tasks */}
          <section>
            <SectionHeader>Tasks ({r.tasks.total})</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {Object.entries(r.tasks.byStatus).map(([s, c]) => (
                <PillStat key={s} label={s} value={c} color="#2563eb" />
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {['critical', 'high', 'medium', 'low'].map(p => (
                <PillStat key={p} label={p} value={r.tasks.byPriority[p] || 0} color={{ critical: '#ef4444', high: '#f59e0b', medium: '#2563eb', low: '#52749a' }[p as 'critical']} />
              ))}
            </div>
          </section>

          {/* Activity & hours */}
          <section>
            <SectionHeader>Activity</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Stat label="Hours this week" value={`${r.hours.thisWeek}h`} />
              <Stat label="Hours this month" value={`${r.hours.thisMonth}h`} />
              <Stat label="Activity (30d)" value={String(r.activity.last30Days)} />
            </div>
          </section>

          {r.cashflow && r.cashflow.months.length > 0 && (
            <section>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.02em', margin: '24px 0 12px', fontFamily: 'var(--font-system)' }}>
                Cost forecasting
              </h2>
              <CashflowChart months={r.cashflow.months} forecast={r.cashflow.forecast} />
            </section>
          )}
        </div>
      ) : null}

      <TabBar />
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </p>
  )
}

function Stat({ label, value, accent, full }: { label: string; value: string; accent?: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? 'span 2' : 'auto', background: '#152641', borderRadius: 12, padding: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 700, color: accent || '#eef3fa', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function PillStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: `${color || '#52749a'}15`, borderRadius: 10, padding: '8px 10px', border: `1px solid ${color || '#52749a'}33` }}>
      <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#8ea8c5', fontWeight: 600, textTransform: 'capitalize' }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: color || '#eef3fa', marginTop: 2 }}>{value}</div>
    </div>
  )
}

/**
 * 6-month outflow / inflow / net bar chart plus a forecast bar.
 * Pure CSS — no chart library. Bar heights are scaled to the largest
 * absolute value in the window so visual comparison is meaningful.
 */
function CashflowChart({
  months,
  forecast,
}: {
  months: MonthBucket[]
  forecast: { label: string; outflow: number; inflow: number; net: number; basis: string }
}) {
  const all = [...months.flatMap(m => [m.outflow, m.inflow]), forecast.outflow, forecast.inflow]
  const maxAbs = Math.max(1, ...all.map(v => Math.abs(v)))
  const buckets = [...months, { ...forecast, ym: 'forecast', isForecast: true } as MonthBucket & { isForecast?: boolean }]

  return (
    <div style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16, fontFamily: 'var(--font-system)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#8ea8c5' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Swatch color="#10b981" />Inflow</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Swatch color="#ef4444" />Outflow</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Swatch color="#f59e0b" />Forecast</span>
        </div>
        <span style={{ fontSize: 10, color: '#52749a' }}>{forecast.basis}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${buckets.length}, 1fr)`, gap: 6, alignItems: 'end', height: 140 }}>
        {buckets.map(b => {
          const isForecast = 'isForecast' in b && b.isForecast
          const outH = Math.max(2, Math.round((b.outflow / maxAbs) * 120))
          const inH = Math.max(2, Math.round((b.inflow / maxAbs) * 120))
          return (
            <div key={b.ym} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120, width: '100%', justifyContent: 'center' }}>
                <div title={`Inflow £${b.inflow.toLocaleString()}`} style={{ width: '40%', height: inH, background: isForecast ? '#f59e0b' : '#10b981', borderRadius: '4px 4px 0 0', opacity: isForecast ? 0.7 : 1 }} />
                <div title={`Outflow £${b.outflow.toLocaleString()}`} style={{ width: '40%', height: outH, background: isForecast ? '#f59e0b' : '#ef4444', borderRadius: '4px 4px 0 0', opacity: isForecast ? 0.7 : 1 }} />
              </div>
              <div style={{ fontSize: 10, color: isForecast ? '#f59e0b' : '#8ea8c5', fontWeight: isForecast ? 700 : 400 }}>{b.label}</div>
              <div style={{ fontSize: 9, color: b.net >= 0 ? '#10b981' : '#ef4444', fontFamily: 'ui-monospace, monospace' }}>
                {b.net >= 0 ? '+' : ''}£{Math.round(b.net).toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color }} />
}

const projRow: React.CSSProperties = {
  background: '#152641',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
}

'use client'

import { useRouter } from 'next/navigation'
import Avatar from '../ui/Avatar'
import ProgressBar from '../ui/ProgressBar'
import { IcSpark, IcAlert, IcTrend, IcReceipt, IcClock, IcArrowRight } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface BentoProps {
  accent?: string
  data?: DashboardData | null
}

/**
 * Variant 4 — Bento: modular grid, glanceable.
 * Matches project/lib/dashboards.jsx DashV4_Bento.
 */
export default function Bento({ accent = '#2563eb', data }: BentoProps) {
  const router = useRouter()

  const projects = data?.projects || []
  const activeProject = projects.find(p => p.status === 'active') || projects[0]
  const onSiteAvatars = (data?.team || []).filter(m => m.onSite).slice(0, 4)
  const cashflow = data?.stats?.cashflow ?? 0
  // Real weekly labour cost: hours this week × avg hourly rate (daily rate ÷ 8)
  const avgDailyRate = (data?.team || []).reduce((s: number, m: { dailyRate?: number }) => s + (m.dailyRate ?? 0), 0) / Math.max((data?.team || []).length, 1)
  const cashflowDelta = Math.round((data?.stats?.hoursThisWeek ?? 0) * (avgDailyRate / 8))
  const owed = data?.stats?.owed ?? 0
  const hoursThisWeek = data?.stats?.hoursThisWeek ?? 0
  const overdueInvoices = (data?.invoices || []).filter(i => i.status === 'overdue')
  const criticalTasks = (data?.tasks || []).filter(t => t.priority === 'critical' || t.priority === 'high').slice(0, 2)

  const cashLabel = cashflow >= 1000 ? `£${(cashflow / 1000).toFixed(1)}k` : cashflow > 0 ? `£${cashflow}` : '£0'
  const owedLabel = owed >= 1000 ? `£${(owed / 1000).toFixed(1)}k` : owed > 0 ? `£${owed}` : '£0'

  const alerts = [
    ...overdueInvoices.slice(0, 2).map(i => ({ t: `Invoice ${i.number} overdue`, s: i.project?.name || 'Invoice', c: '#ef4444', I: IcAlert })),
    ...criticalTasks.map(t => ({ t: t.title, s: t.project?.name || 'Task', c: '#f59e0b', I: IcAlert })),
  ].slice(0, 3)

  const SF = 'var(--font-system)'
  const SFMono = 'ui-monospace, "SF Mono", "JetBrains Mono", monospace'
  const purple = '#8b5cf6'

  return (
    <div style={{ padding: '8px 0 100px' }}>
      {/* Header */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em' }}>Dashboard</div>
        <div style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', marginTop: 2 }}>{activeProject?.clientName || 'Cortexx'}</div>
      </div>

      <div style={{ padding: '4px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Big — Active site (full width) */}
        {activeProject && (
          <div
            onClick={() => router.push(`/projects/${activeProject.id}`)}
            style={{
              gridColumn: '1 / 3',
              background: `linear-gradient(135deg, ${accent}33, ${purple}22)`,
              borderRadius: 16, padding: 14,
              border: `0.5px solid ${accent}55`,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{
                  display: 'inline-block', padding: '3px 8px', borderRadius: 99,
                  background: accent, color: '#fff', fontFamily: SF, fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.6,
                }}>
                  ● ACTIVE NOW
                </span>
                <div style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa', marginTop: 8, letterSpacing: -0.3 }}>{activeProject.name}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {activeProject.onSiteCount || 0} on site · {activeProject.progress}% done
                </div>
              </div>
              {onSiteAvatars.length > 0 && (
                <div style={{ display: 'flex', marginRight: -8 }}>
                  {onSiteAvatars.map((m, i) => (
                    <div key={m.id} style={{ marginLeft: i ? -10 : 0, border: '2px solid #06101e', borderRadius: '50%' }}>
                      <Avatar name={m.name} size={28} color={m.avatarColor} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={activeProject.progress} color={accent} height={5} />
            </div>
          </div>
        )}

        {/* Cash card — col 1, spans 2 rows, with sparkline */}
        <div style={{
          background: '#152641', borderRadius: 14, padding: 12,
          border: '0.5px solid rgba(255,255,255,0.07)', gridRow: 'span 2',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: '#10b981', marginBottom: 4 }}><IcTrend size={14} color="#10b981" /></div>
            <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cash</div>
            <div style={{ fontFamily: SFMono, fontSize: 22, color: '#eef3fa', fontWeight: 700, marginTop: 2, letterSpacing: -0.5 }}>{cashLabel}</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: 500 }}>
              {cashflowDelta > 0 ? `£${cashflowDelta >= 1000 ? (cashflowDelta / 1000).toFixed(1) + 'k' : cashflowDelta} labour wk` : 'No hours this week'}
            </div>
          </div>
          <svg width="100%" height="36" viewBox="0 0 100 36" preserveAspectRatio="none">
            <polyline points="0,28 14,24 28,26 42,16 56,20 70,8 84,12 100,4" fill="none" stroke="#10b981" strokeWidth="1.6" />
            <polyline points="0,28 14,24 28,26 42,16 56,20 70,8 84,12 100,4 100,36 0,36" fill="rgba(16,185,129,0.13)" stroke="none" />
          </svg>
        </div>

        {/* Owed — col 2 row 1 */}
        <div style={{
          background: '#152641', borderRadius: 14, padding: 12,
          border: '0.5px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ color: '#f59e0b', marginBottom: 4 }}><IcReceipt size={14} color="#f59e0b" /></div>
          <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Owed</div>
          <div style={{ fontFamily: SFMono, fontSize: 18, color: '#f59e0b', fontWeight: 700, marginTop: 2 }}>{owedLabel}</div>
          <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a' }}>
            {overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue` : `${(data?.invoices || []).length} invoices`}
          </div>
        </div>

        {/* Hours — col 2 row 2 */}
        <div style={{
          background: '#152641', borderRadius: 14, padding: 12,
          border: '0.5px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ color: accent, marginBottom: 4 }}><IcClock size={14} color={accent} /></div>
          <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hours</div>
          <div style={{ fontFamily: SFMono, fontSize: 18, color: '#eef3fa', fontWeight: 700, marginTop: 2 }}>{hoursThisWeek}h</div>
          <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a' }}>this week</div>
        </div>

        {/* AI shortcut — wide */}
        <div
          onClick={() => router.push('/dashboard?v=5')}
          style={{
            gridColumn: '1 / 3',
            background: `linear-gradient(135deg, ${purple}26, ${accent}1a)`,
            borderRadius: 14, padding: '12px 14px',
            border: `0.5px solid ${purple}44`,
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${purple}, ${accent})`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><IcSpark size={18} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: '#eef3fa' }}>Ask Cortex anything</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>Ask about budgets, tasks, or site status</div>
          </div>
          <IcArrowRight size={16} color="#52749a" />
        </div>

        {/* Alerts — wide */}
        {alerts.length > 0 && (
          <div style={{
            gridColumn: '1 / 3',
            background: '#152641', borderRadius: 14, padding: '12px 14px',
            border: '0.5px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Needs attention</div>
              <span style={{
                padding: '2px 7px', borderRadius: 99,
                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                fontFamily: SF, fontSize: 10, fontWeight: 700,
              }}>{alerts.length}</span>
            </div>
            {alerts.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                  borderTop: i ? '0.5px solid rgba(255,255,255,0.07)' : 'none',
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `${a.c}22`, color: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <a.I size={13} color={a.c} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.t}</div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5' }}>{a.s}</div>
                </div>
                <IcArrowRight size={16} color="#52749a" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

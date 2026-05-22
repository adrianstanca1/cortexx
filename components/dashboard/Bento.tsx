'use client'

import { useRouter } from 'next/navigation'
import Avatar from '../ui/Avatar'
import { IcBot, IcSpark, IcAlert, IcTrend } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface BentoProps {
  accent?: string
  data?: DashboardData | null
}

export default function Bento({ accent = '#f59e0b', data }: BentoProps) {
  const router = useRouter()

  const projects = data?.projects || []
  const activeProject = projects.find(p => p.status === 'active') || projects[0]
  const onSiteTeam = (data?.team || []).filter(m => m.onSite).slice(0, 3)
  const cashflow = data?.stats?.cashflow ?? 0
  const owed = data?.stats?.owed ?? 0
  const hoursThisWeek = data?.stats?.hoursThisWeek ?? 0
  const overdueInvoices = (data?.invoices || []).filter(i => i.status === 'overdue')
  const criticalTasks = (data?.tasks || []).filter(t => t.priority === 'critical' || t.priority === 'high').slice(0, 3)

  const cashLabel = cashflow >= 1000 ? `£${(cashflow / 1000).toFixed(1)}k` : cashflow > 0 ? `£${cashflow}` : '£0'
  const owedLabel = owed >= 1000 ? `£${Math.round(owed / 1000)}k` : owed > 0 ? `£${owed}` : '£0'

  const alerts = [
    ...overdueInvoices.map(i => ({ text: `Invoice ${i.number} overdue`, color: '#ef4444' })),
    ...criticalTasks.map(t => ({ text: t.title, color: '#f59e0b' })),
  ].slice(0, 3)

  return (
    <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Active site card */}
      {activeProject && (
        <div onClick={() => router.push(`/projects/${activeProject.id}`)} style={{ borderRadius: 20, background: 'linear-gradient(135deg, #1a2f4e, #152641)', border: '1px solid rgba(255,255,255,0.1)', padding: '18px 18px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-system)' }}>
                ● {activeProject.status === 'active' ? 'Active site' : activeProject.status}
              </span>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.02em', marginTop: 4, fontFamily: 'var(--font-system)' }}>{activeProject.name}</h3>
              <p style={{ fontSize: 12, color: '#8ea8c5', marginTop: 2, fontFamily: 'var(--font-system)' }}>
                {activeProject.clientName} · {activeProject.progress}% complete
              </p>
            </div>
            <div style={{ padding: '6px 12px', borderRadius: 99, background: `${accent}22`, fontSize: 13, fontWeight: 700, color: accent, fontFamily: 'var(--font-system)' }}>
              {activeProject.progress}%
            </div>
          </div>
          {onSiteTeam.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <div style={{ display: 'flex' }}>
                {onSiteTeam.map((m, i) => (
                  <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
                    <Avatar name={m.name} color={m.avatarColor} size={28} ring />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#52749a', fontFamily: 'var(--font-system)' }}>
                {activeProject.onSiteCount} on site today
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Cash sparkline */}
        <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 14px 12px' }}>
          <p style={{ fontSize: 10, color: '#52749a', fontFamily: 'var(--font-system)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cash In</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#10b981', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginTop: 4 }}>{cashLabel}</p>
          <svg width="100%" height="30" viewBox="0 0 80 30" style={{ marginTop: 8 }}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,22 L12,18 L24,20 L36,14 L48,16 L60,8 L72,10 L80,6" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <path d="M0,22 L12,18 L24,20 L36,14 L48,16 L60,8 L72,10 L80,6 L80,30 L0,30Z" fill="url(#sparkGrad)" />
          </svg>
        </div>

        {/* Owed */}
        <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 14px 12px' }}>
          <p style={{ fontSize: 10, color: '#52749a', fontFamily: 'var(--font-system)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Owed</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: accent, letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginTop: 4 }}>{owedLabel}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
            <IcTrend size={14} color={overdueInvoices.length > 0 ? '#ef4444' : '#52749a'} />
            <span style={{ fontSize: 11, color: overdueInvoices.length > 0 ? '#ef4444' : '#52749a', fontFamily: 'var(--font-system)' }}>
              {overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue` : 'All current'}
            </span>
          </div>
        </div>

        {/* Hours */}
        <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 14px 12px' }}>
          <p style={{ fontSize: 10, color: '#52749a', fontFamily: 'var(--font-system)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Hours/wk</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#2563eb', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginTop: 4 }}>{hoursThisWeek}h</p>
          <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)', marginTop: 12 }}>{(data?.team || []).length} active members</p>
        </div>

        {/* AI shortcut — routes to AI-forward variant */}
        <div onClick={() => router.push('/dashboard?v=5')} style={{ borderRadius: 18, background: `linear-gradient(135deg, rgba(37,99,235,0.15), rgba(139,92,246,0.1))`, border: '1px solid rgba(37,99,235,0.2)', padding: '14px 14px 12px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <IcSpark size={14} color="#60a5fa" />
            <p style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'var(--font-system)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cortex AI</p>
          </div>
          <p style={{ fontSize: 12, color: '#8ea8c5', fontFamily: 'var(--font-system)', lineHeight: 1.4 }}>AI briefing &amp; decision queue</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 10 }}>
            Needs attention
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IcAlert size={14} color={a.color} />
                <span style={{ fontSize: 13, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

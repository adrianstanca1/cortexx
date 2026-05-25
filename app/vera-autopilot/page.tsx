'use client'

/**
 * Vera autopilot — AI agent that takes write actions on the user's
 * behalf. v1 ships with a fixed catalogue of opt-in automations; the
 * agent only runs when explicitly enabled per-workflow.
 *
 * Action availability is gated by plan (Pro / Enterprise). The actual
 * execution backend ships in a follow-up — this page lists what will
 * be available and lets the user toggle interest.
 */
import { useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcZap, IcSpark } from '@/components/ui/Icons'

interface Automation {
  id: string
  title: string
  description: string
  trigger: string
  action: string
  enabled: boolean
  plan: 'pro' | 'enterprise'
}

const CATALOGUE: Automation[] = [
  {
    id: 'invoice-chase',
    title: 'Auto-chase overdue invoices',
    description: 'Send a polite reminder email when an invoice is 7 days overdue, then escalate at 14 and 30 days.',
    trigger: 'Invoice dueDate < now − 7d, status ≠ paid',
    action: 'Email to invoice.clientName',
    enabled: false,
    plan: 'pro',
  },
  {
    id: 'snag-triage',
    title: 'Triage incoming snags by severity',
    description: 'When a snag is logged with priority=critical, auto-assign to the project lead and post in #site-issues.',
    trigger: 'Snag.create, priority=critical',
    action: 'Assignment + push notification + email',
    enabled: false,
    plan: 'pro',
  },
  {
    id: 'cert-expiry',
    title: 'Certification expiry alerts',
    description: 'Email each team member 30/14/7 days before any of their certifications expires.',
    trigger: 'Certification.expiresAt − cron daily',
    action: 'Email + push notification',
    enabled: false,
    plan: 'pro',
  },
  {
    id: 'cis-monthly',
    title: 'Auto-prepare monthly CIS return',
    description: 'On the 5th of each month, draft the CIS300 submission from the previous month\'s sub-invoices.',
    trigger: 'Cron 5th of month',
    action: 'PayrollRun.create (status=draft)',
    enabled: false,
    plan: 'enterprise',
  },
  {
    id: 'photo-tag',
    title: 'Auto-tag site photos',
    description: 'Run vision on every uploaded site photo to extract trade, location, and risks — pre-fill the snag if any are detected.',
    trigger: 'Document.create, type=photo',
    action: 'Tag + Snag draft',
    enabled: false,
    plan: 'pro',
  },
]

export default function VeraAutopilotPage() {
  const [items, setItems] = useState<Automation[]>(CATALOGUE)

  const toggle = (id: string) => {
    setItems(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
    // Backend wiring TODO: POST /api/automations { id, enabled }
  }

  const enabledCount = items.filter(a => a.enabled).length

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IcZap size={24} color="#8b5cf6" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
            Vera autopilot
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          AI agent that takes actions on your behalf. {enabledCount} of {items.length} enabled.
        </p>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ background: 'rgba(139,92,246,0.08)', border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', fontFamily: 'var(--font-system)' }}>
          <IcSpark size={14} color="#8b5cf6" />
          <p style={{ fontSize: 12, color: '#8ea8c5', margin: 0, lineHeight: 1.5 }}>
            Every automation runs as an audited workflow — you&rsquo;ll see exactly what Vera did in <Link href="/activity" style={{ color: '#8b5cf6', textDecoration: 'none' }}>activity</Link> and can revert any action.
          </p>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(a => (
            <li key={a.id} style={{ background: '#152641', borderRadius: 12, padding: 14, border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, color: '#eef3fa', fontWeight: 700 }}>{a.title}</span>
                    <span style={{ fontSize: 10, color: a.plan === 'enterprise' ? '#f59e0b' : '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, background: a.plan === 'enterprise' ? 'rgba(245,158,11,0.1)' : 'rgba(6,182,212,0.1)', padding: '2px 6px', borderRadius: 4 }}>{a.plan}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#8ea8c5', margin: '0 0 8px', lineHeight: 1.4 }}>{a.description}</p>
                  <div style={{ fontSize: 11, color: '#52749a', fontFamily: 'ui-monospace, monospace' }}>
                    when: {a.trigger}<br />
                    then: {a.action}
                  </div>
                </div>
                <button
                  onClick={() => toggle(a.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: a.enabled ? '#8b5cf6' : 'transparent',
                    border: '0.5px solid ' + (a.enabled ? '#8b5cf6' : 'rgba(255,255,255,0.15)'),
                    color: a.enabled ? '#06101e' : '#8ea8c5',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-system)',
                  }}
                >
                  {a.enabled ? 'On' : 'Enable'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <TabBar />
    </div>
  )
}

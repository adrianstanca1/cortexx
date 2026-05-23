'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcReceipt, IcDoc, IcCheck, IcClock, IcAlert } from '@/components/ui/Icons'

interface Inbox {
  overdueInvoices: Array<{ id: string; number: string; amount: number; dueDate: string; clientName: string; project?: { id: string; name: string } | null; projectId?: string | null }>
  expiringDocs: Array<{ id: string; name: string; type: string; expiresAt: string; project?: { id: string; name: string } | null }>
  overdueTasks: Array<{ id: string; title: string; priority: string; dueDate: string; project?: { id: string; name: string } | null; assignee?: { name: string } | null }>
  criticalTasks: Array<{ id: string; title: string; dueDate: string; project?: { id: string; name: string } | null; assignee?: { name: string } | null }>
  pendingTimesheets: Array<{ memberId: string; memberName: string; hours: number; entries: number }>
  total: number
}

export default function InboxPage() {
  const [data, setData] = useState<Inbox | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/inbox')
      .then(r => { if (!r.ok) throw new Error('Failed to load inbox'); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>Back</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: 'var(--font-system)' }}>Inbox</h1>
        {data && (
          <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>
            {data.total === 0 ? 'You\'re all caught up' : `${data.total} item${data.total === 1 ? '' : 's'} needing attention`}
          </p>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: 'var(--font-system)', fontSize: 14 }}>{error}</div>
      ) : data ? (
        <div style={{ padding: '16px 20px' }}>
          {data.total === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
              <p style={{ fontSize: 14 }}>Nothing needs your attention right now.</p>
            </div>
          )}

          {data.overdueTasks.length > 0 && (
            <Section title="Overdue tasks" count={data.overdueTasks.length} color="#ef4444">
              {data.overdueTasks.map(t => (
                <Link key={t.id} href="/tasks" style={cardStyle}>
                  <IcAlert size={14} color="#ef4444" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={titleStyle}>{t.title}</div>
                    <div style={subStyle}>{t.project?.name || 'No project'}{t.assignee ? ` · ${t.assignee.name}` : ''} · due {fmtDate(t.dueDate)}</div>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {data.criticalTasks.length > 0 && (
            <Section title="Critical upcoming" count={data.criticalTasks.length} color="#f59e0b">
              {data.criticalTasks.map(t => (
                <Link key={t.id} href="/tasks" style={cardStyle}>
                  <IcCheck size={14} color="#f59e0b" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={titleStyle}>{t.title}</div>
                    <div style={subStyle}>{t.project?.name || 'No project'} · due {fmtDate(t.dueDate)}</div>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {data.overdueInvoices.length > 0 && (
            <Section title="Overdue invoices" count={data.overdueInvoices.length} color="#ef4444">
              {data.overdueInvoices.map(i => (
                <Link key={i.id} href={i.projectId ? `/projects/${i.projectId}` : '/projects'} style={cardStyle}>
                  <IcReceipt size={14} color="#ef4444" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={titleStyle}>{i.number} — {i.clientName}</div>
                    <div style={subStyle}>{i.project?.name || ''} · due {fmtDate(i.dueDate)}</div>
                  </div>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#ef4444' }}>£{i.amount.toLocaleString()}</span>
                </Link>
              ))}
            </Section>
          )}

          {data.expiringDocs.length > 0 && (
            <Section title="Documents expiring" count={data.expiringDocs.length} color="#f59e0b">
              {data.expiringDocs.map(d => (
                <Link key={d.id} href="/documents" style={cardStyle}>
                  <IcDoc size={14} color="#f59e0b" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={titleStyle}>{d.name}</div>
                    <div style={subStyle}>{d.project?.name || 'No project'} · expires {fmtDate(d.expiresAt)}</div>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {data.pendingTimesheets.length > 0 && (
            <Section title="Pending timesheet approvals" count={data.pendingTimesheets.length} color="#2563eb">
              {data.pendingTimesheets.map(t => (
                <Link key={t.memberId} href="/team" style={cardStyle}>
                  <IcClock size={14} color="#2563eb" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={titleStyle}>{t.memberName}</div>
                    <div style={subStyle}>{t.hours}h across {t.entries} {t.entries === 1 ? 'entry' : 'entries'}</div>
                  </div>
                </Link>
              ))}
            </Section>
          )}
        </div>
      ) : null}

      <TabBar />
    </div>
  )
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, color }}>
        {title} <span style={{ color: '#8ea8c5' }}>· {count}</span>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const cardStyle: React.CSSProperties = {
  background: '#152641',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  textDecoration: 'none',
}
const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 14,
  color: '#eef3fa',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const subStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 12,
  color: '#8ea8c5',
  marginTop: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

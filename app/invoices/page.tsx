'use client'

/**
 * Top-level invoice listing — the project-scoped invoice view at
 * /projects/[id] is unchanged, but until now there was no way to see
 * ALL invoices across projects in one place. This page fills that.
 *
 * Server-side it just hits /api/invoices (no projectId filter); the
 * UI groups by status (draft, sent, paid, overdue) and lets the user
 * jump to a project from any row.
 */
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcReceipt, IcPound } from '@/components/ui/Icons'

type Status = 'draft' | 'sent' | 'paid' | 'overdue'

interface Invoice {
  id: string
  number: string
  projectId: string | null
  clientName: string
  amount: number
  status: Status
  issuedDate: string
  dueDate: string
  paidAt: string | null
  notes: string | null
  project?: { id: string; name: string } | null
}

const STATUS_COLOR: Record<Status, string> = {
  draft: '#52749a',
  sent: '#f59e0b',
  paid: '#10b981',
  overdue: '#ef4444',
}
const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Status | 'all'>('all')

  useEffect(() => {
    fetch('/api/invoices?take=100')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setInvoices(d.invoices || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => filter === 'all' ? invoices : invoices.filter(i => i.status === filter),
    [invoices, filter],
  )

  const totals = useMemo(() => {
    const t: Record<Status | 'all', { count: number; sum: number }> = {
      all: { count: invoices.length, sum: 0 },
      draft: { count: 0, sum: 0 },
      sent: { count: 0, sum: 0 },
      paid: { count: 0, sum: 0 },
      overdue: { count: 0, sum: 0 },
    }
    for (const inv of invoices) {
      t.all.sum += inv.amount
      t[inv.status].count += 1
      t[inv.status].sum += inv.amount
    }
    return t
  }, [invoices])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
          Invoices
        </h1>
        <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
          Outgoing client invoices, across every project.
        </p>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {(['all', 'overdue', 'sent', 'draft', 'paid'] as const).map(s => {
          const active = filter === s
          const t = totals[s]
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                flexShrink: 0,
                padding: '8px 12px',
                borderRadius: 10,
                background: active ? '#152641' : 'transparent',
                border: '0.5px solid ' + (active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'),
                color: '#eef3fa',
                fontFamily: 'var(--font-system)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ color: s === 'all' ? '#8ea8c5' : STATUS_COLOR[s] }}>
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </span>
              <span style={{ color: '#52749a' }}>· {t.count}</span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <p style={{ color: '#52749a', fontSize: 13, padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)' }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#ef4444', fontSize: 13, padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)' }}>{error}</p>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcReceipt size={32} color="#52749a" />
            <p style={{ marginTop: 12 }}>
              {filter === 'all' ? 'No invoices yet. Create one from a project.' : `No ${STATUS_LABEL[filter as Status].toLowerCase()} invoices.`}
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(inv => (
              <li
                key={inv.id}
                onClick={() => inv.projectId && router.push(`/projects/${inv.projectId}`)}
                style={{ background: '#152641', borderRadius: 12, padding: '14px 16px', border: '0.5px solid rgba(255,255,255,0.07)', cursor: inv.projectId ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-system)' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR[inv.status], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>
                    {inv.number} · {inv.clientName}
                  </div>
                  <div style={{ fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                    {inv.project?.name || 'No project'} · Due {new Date(inv.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#eef3fa', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
                  <IcPound size={14} color="#8ea8c5" />
                  {inv.amount.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TabBar />
    </div>
  )
}

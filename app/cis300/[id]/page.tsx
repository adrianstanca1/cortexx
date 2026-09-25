'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IcChevL } from '@/components/ui/Icons'

interface LineItem {
  subcontractorId: string
  name: string
  utr: string | null
  cisStatus: string
  gross: number
  cis: number
  net: number
  materialsCost: number
}

interface Cis300Return {
  id: string
  taxMonth: string
  totalGross: number
  totalCis: number
  totalNet: number
  subCount: number
  status: string
  submittedAt: string | null
  hmrcReference: string | null
  notes: string | null
  lineItems: LineItem[] | unknown
  createdAt: string
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--t3)',
  submitted: '#f59e0b',
  accepted: '#22c55e',
  rejected: '#ef4444',
}

function formatTaxMonth(iso: string): string {
  const d = new Date(iso)
  const monthLabel = d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const startDay = d.getUTCDate()
  const startMonth = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 5))
  const endDay = end.getUTCDate()
  const endMonth = end.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${monthLabel} (${startDay} ${startMonth}–${endDay} ${endMonth})`
}

function fmtMoney(n: number): string {
  return `£${n.toFixed(2)}`
}

export default function Cis300DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [item, setItem] = useState<Cis300Return | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    fetch(`/api/cis300/${id}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setItem(d.item))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [id])

  const markSubmitted = async () => {
    const ref = window.prompt('HMRC confirmation / reference number')
    if (!ref) return
    setWorking(true)
    try {
      const res = await fetch(`/api/cis300/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted', hmrcReference: ref }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        window.alert(d.error || 'Failed to submit')
        return
      }
      const { item: updated } = await res.json()
      setItem(updated)
    } finally {
      setWorking(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete this draft return? This cannot be undone.')) return
    setWorking(true)
    try {
      const res = await fetch(`/api/cis300/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        window.alert(d.error || 'Failed to delete')
        return
      }
      router.push('/cis300')
    } finally {
      setWorking(false)
    }
  }

  const lineItems: LineItem[] = item && Array.isArray(item.lineItems)
    ? (item.lineItems as LineItem[])
    : []

  return (
    <div style={{ background: 'var(--bg0)', minHeight: '100dvh', padding: '20px 20px 100px 60px' }}>
      <Link
        href="/cis300"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}
      >
        <IcChevL size={18} color="var(--t3)" />
        <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: 'var(--t3)' }}>CIS300 returns</span>
      </Link>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : !item ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, fontFamily: 'var(--font-system)' }}>Not found</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--t1)',
                letterSpacing: '-0.03em',
                fontFamily: 'var(--font-system)',
                margin: 0,
              }}
            >
              {formatTaxMonth(item.taxMonth)}
            </h1>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 99,
                background: `${STATUS_COLOR[item.status] || 'var(--t3)'}22`,
                color: STATUS_COLOR[item.status] || 'var(--t3)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {item.status}
            </span>
          </div>
          {item.hmrcReference && (
            <div style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-system)', marginBottom: 16 }}>
              HMRC reference: <strong style={{ color: 'var(--t1)' }}>{item.hmrcReference}</strong>
              {item.submittedAt && <> · submitted {new Date(item.submittedAt).toLocaleString('en-GB')}</>}
            </div>
          )}

          {/* Totals */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {[
              { label: 'Gross', value: item.totalGross, color: '#06b6d4' },
              { label: 'CIS deducted', value: item.totalCis, color: '#f59e0b' },
              { label: 'Net', value: item.totalNet, color: '#10b981' },
            ].map(t => (
              <div
                key={t.label}
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: 10,
                  padding: 16,
                  border: '0.5px solid rgba(255,255,255,0.07)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-system)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.color, fontFamily: 'var(--font-system)' }}>
                  {fmtMoney(t.value)}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <a
              href={`/api/cis300/${item.id}/export`}
              download
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                background: '#2563eb',
                color: 'var(--t1)',
                fontFamily: 'var(--font-system)',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Download CSV
            </a>
            {item.status === 'draft' && (
              <>
                <button
                  onClick={markSubmitted}
                  disabled={working}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: '#10b981',
                    border: 'none',
                    color: 'var(--bg1)',
                    fontFamily: 'var(--font-system)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: working ? 'not-allowed' : 'pointer',
                    opacity: working ? 0.6 : 1,
                  }}
                >
                  Mark submitted
                </button>
                <button
                  onClick={remove}
                  disabled={working}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: 'transparent',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontFamily: 'var(--font-system)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: working ? 'not-allowed' : 'pointer',
                    opacity: working ? 0.6 : 1,
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Sub line items */}
          <div
            style={{
              background: 'var(--surface-raised)',
              borderRadius: 10,
              border: '0.5px solid rgba(255,255,255,0.07)',
              overflow: 'hidden',
            }}
          >
            {lineItems.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: 'var(--t3)',
                  fontSize: 13,
                  fontFamily: 'var(--font-system)',
                }}
              >
                No subcontractor payments in this tax month.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-system)', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>UTR</th>
                    <th style={{ textAlign: 'left', padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CIS</th>
                    <th style={{ textAlign: 'right', padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross</th>
                    <th style={{ textAlign: 'right', padding: 10, fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CIS deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(li => (
                    <tr key={li.subcontractorId} style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 10, color: 'var(--t1)' }}>{li.name}</td>
                      <td style={{ padding: 10, color: 'var(--t2)', fontFamily: 'monospace', fontSize: 12 }}>{li.utr || '—'}</td>
                      <td style={{ padding: 10, color: 'var(--t2)' }}>{li.cisStatus}</td>
                      <td style={{ padding: 10, color: 'var(--t1)', textAlign: 'right' }}>{fmtMoney(li.gross)}</td>
                      <td style={{ padding: 10, color: '#f59e0b', textAlign: 'right' }}>{fmtMoney(li.cis)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

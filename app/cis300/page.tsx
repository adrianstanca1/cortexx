'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ModuleShell from '@/components/ui/ModuleShell'

interface Cis300Row {
  id: string
  taxMonth: string
  totalGross: number
  totalCis: number
  totalNet: number
  subCount: number
  status: string
  submittedAt: string | null
  hmrcReference: string | null
  createdAt: string
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#52749a',
  submitted: '#f59e0b',
  accepted: '#22c55e',
  rejected: '#ef4444',
}

/** Returns the current UK CIS tax month — the 6th of this month if today
 *  is on/after the 6th, otherwise the 6th of last month. Returned in
 *  UTC midnight so it round-trips cleanly through the API. */
function currentTaxMonth(): Date {
  const now = new Date()
  if (now.getUTCDate() >= 6) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 6))
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 6))
}

function toInputValue(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

export default function Cis300Page() {
  const router = useRouter()
  const [rows, setRows] = useState<Cis300Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taxMonthInput, setTaxMonthInput] = useState<string>(() => toInputValue(currentTaxMonth()))
  const [computing, setComputing] = useState(false)

  useEffect(() => {
    fetch('/api/cis300')
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Failed') }))
      .then(d => setRows(d.items || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [])

  const compute = async () => {
    if (!taxMonthInput) {
      window.alert('Pick a tax month first')
      return
    }
    setComputing(true)
    try {
      const res = await fetch('/api/cis300', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxMonth: taxMonthInput }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        window.alert(d.error || 'Failed to compute')
        return
      }
      const { item } = await res.json()
      setRows(prev => {
        const filtered = prev.filter(r => r.id !== item.id)
        return [item, ...filtered].sort((a, b) => b.taxMonth.localeCompare(a.taxMonth))
      })
    } finally {
      setComputing(false)
    }
  }

  return (
    <ModuleShell title="CIS300 returns" tagline="Monthly returns to HMRC">
      {/* Tax-month picker + compute button */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 20,
          padding: 12,
          background: '#152641',
          borderRadius: 10,
          border: '0.5px solid rgba(255,255,255,0.07)',
        }}
      >
        <label
          style={{
            fontSize: 12,
            color: '#8ea8c5',
            fontFamily: 'var(--font-system)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span>Tax month (date is normalised to the 6th)</span>
          <input
            type="date"
            value={taxMonthInput}
            onChange={e => setTaxMonthInput(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#0c1a2e',
              color: '#eef3fa',
              fontFamily: 'var(--font-system)',
              fontSize: 13,
            }}
          />
        </label>
        <button
          onClick={compute}
          disabled={computing}
          style={{
            marginTop: 18,
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#10b981',
            color: '#0c1a2e',
            fontFamily: 'var(--font-system)',
            fontSize: 13,
            fontWeight: 700,
            cursor: computing ? 'not-allowed' : 'pointer',
            opacity: computing ? 0.6 : 1,
          }}
        >
          {computing ? 'Computing…' : 'Compute return'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>
      ) : rows.length === 0 ? (
        <div
          style={{
            color: '#52749a',
            fontSize: 13,
            fontFamily: 'var(--font-system)',
            padding: 32,
            textAlign: 'center',
          }}
        >
          No returns yet. Pick a tax month above and click Compute.
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {rows.map(r => {
            const statusColor = STATUS_COLOR[r.status] || '#52749a'
            return (
              <li
                key={r.id}
                onClick={() => router.push(`/cis300/${r.id}`)}
                style={{
                  background: '#152641',
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  fontFamily: 'var(--font-system)',
                  fontSize: 13,
                  color: '#eef3fa',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{formatTaxMonth(r.taxMonth)}</div>
                  <div style={{ fontSize: 12, color: '#8ea8c5' }}>
                    {r.subCount} sub{r.subCount === 1 ? '' : 's'} · gross {fmtMoney(r.totalGross)} · CIS {fmtMoney(r.totalCis)}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 99,
                    background: `${statusColor}22`,
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {r.status}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </ModuleShell>
  )
}

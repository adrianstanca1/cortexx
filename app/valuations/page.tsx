'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcPound, IcArrowRight } from '@/components/ui/Icons'

interface Valuation {
  projectId: string
  projectName: string
  clientName: string
  number: string
  gross: number
  retention: number
  retentionPct: number
  previous: number
  netDue: number
  progress: number
  budget: number
  status: 'draft' | 'submitted' | 'certified'
}

interface Totals {
  gross: number
  retention: number
  previous: number
  netDue: number
}

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<Valuation['status'], string> = {
  draft: '#f59e0b',
  submitted: '#3b82f6',
  certified: '#10b981',
}
const STATUS_LABEL: Record<Valuation['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  certified: 'Certified',
}

function gbp(n: number): string {
  if (Math.abs(n) >= 1000) return `£${(n / 1000).toFixed(1)}k`
  return `£${Math.round(n).toLocaleString('en-GB')}`
}

export default function ValuationsPage() {
  const [valuations, setValuations] = useState<Valuation[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [retentionPct, setRetentionPct] = useState(3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  const load = useCallback(() => {
    fetch(`/api/valuations?retentionPct=${retentionPct}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load valuations'); return r.json() })
      .then(d => { setValuations(d.valuations || []); setTotals(d.totals || null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [retentionPct])
  useEffect(() => { load() }, [load])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Valuations</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>Interim payment application previews</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '4px 10px' }}>
            <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600 }}>RETENTION</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={retentionPct}
              onChange={e => setRetentionPct(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              style={{ width: 44, background: 'transparent', border: 'none', color: '#eef3fa', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, textAlign: 'right' }}
            />
            <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>%</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 12px', background: 'linear-gradient(135deg, rgba(6,182,212,0.10), rgba(14,165,233,0.05))', borderBottom: '0.5px solid rgba(6,182,212,0.20)', margin: '0 16px 16px', borderRadius: 12, marginTop: 12 }}>
        <div style={{ fontFamily: SF, fontSize: 11, color: '#0ea5e9', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Preview only</div>
        <p style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', lineHeight: 1.5, margin: 0 }}>
          Computed from project budget × progress, less {retentionPct}% retention and previous-certified payments. Not certified until issued through your commercial process.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : valuations.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <IcPound size={32} color="#52749a" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#eef3fa', marginTop: 12, fontFamily: SF }}>No valuation data yet</h2>
          <p style={{ fontSize: 13, color: '#8ea8c5', marginTop: 4, fontFamily: SF }}>Active projects with budget &gt; £0 and progress &gt; 0% will appear here.</p>
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {totals && (
            <div style={{ background: '#152641', borderRadius: 14, padding: 16, border: '0.5px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <KPI label="Gross" value={gbp(totals.gross)} color="#eef3fa" />
              <KPI label="Retention" value={`−${gbp(totals.retention)}`} color="#f59e0b" />
              <KPI label="Previous" value={`−${gbp(totals.previous)}`} color="#52749a" />
              <KPI label="Net due" value={gbp(totals.netDue)} color="#10b981" big />
            </div>
          )}

          {valuations.map(v => (
            <Link
              key={v.number}
              href={`/projects/${v.projectId}`}
              style={{ background: '#152641', borderRadius: 14, padding: 14, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700, letterSpacing: 0.5 }}>{v.number}</div>
                  <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700, color: '#eef3fa', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.projectName}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>{v.clientName} · {v.progress}% complete</div>
                </div>
                <span style={{ padding: '3px 9px', borderRadius: 99, background: `${STATUS_COLOR[v.status]}22`, color: STATUS_COLOR[v.status], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${STATUS_COLOR[v.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>{STATUS_LABEL[v.status]}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Row label="Gross value to date" value={gbp(v.gross)} />
                <Row label={`Less ${v.retentionPct}% retention`} value={`−${gbp(v.retention)}`} color="#f59e0b" />
                <Row label="Less previous certified" value={`−${gbp(v.previous)}`} color="#52749a" />
                <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', marginTop: 4, paddingTop: 6 }}>
                  <Row label="Net due this period" value={gbp(v.netDue)} bold color="#10b981" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
                <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>View project</span>
                <IcArrowRight size={14} color="#52749a" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <TabBar />
    </div>
  )
}

function KPI({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: SF, fontSize: 9, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: big ? 16 : 14, color, fontWeight: 700, marginTop: 2, letterSpacing: -0.3 }}>{value}</div>
    </div>
  )
}

function Row({ label, value, color = '#eef3fa', bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 500 }}>
      <span style={{ color: '#8ea8c5' }}>{label}</span>
      <span style={{ fontFamily: 'ui-monospace, monospace', color }}>{value}</span>
    </div>
  )
}

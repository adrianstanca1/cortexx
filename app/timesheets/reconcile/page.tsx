'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcChevR, IcCheck } from '@/components/ui/Icons'

interface AttendanceRow {
  key: string
  memberId: string | null
  memberName: string
  projectId: string | null
  projectName: string
  date: string
  observedHours: number
  loggedHours: number
  varianceHours: number
  openCheckins: number
  timeEntryIds: string[]
  approvedAny: boolean
  issues: Array<'missing_checkout' | 'missing_time' | 'time_without_attendance' | 'variance'>
  canApplyAttendance: boolean
}

interface Summary {
  totalDays: number
  matched: number
  exceptions: number
  missingCheckout: number
  missingTime: number
  variance: number
  timeWithoutAttendance: number
}

const SF = 'var(--font-system)'
const ISSUE_LABEL: Record<AttendanceRow['issues'][number], string> = {
  missing_checkout: 'Missing check-out',
  missing_time: 'No time logged',
  time_without_attendance: 'Time without site attendance',
  variance: 'Hours differ',
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() }
}

function mondayOf(date: Date) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day + 1)
  return d
}

function fmtWeekRange(monday: Date) {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const left = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const right = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${left} – ${right}`
}

export default function AttendanceReconciliationPage() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const { week, year } = useMemo(() => isoWeek(monday), [monday])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance-reconciliation?week=${week}&year=${year}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load reconciliation')
      setRows(data.exceptions || [])
      setSummary(data.summary || null)
      setError(null)
    } catch (e) {
      setRows([])
      setSummary(null)
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation')
    } finally {
      setLoading(false)
    }
  }, [week, year])

  useEffect(() => { load() }, [load])

  const shiftWeek = (delta: number) => {
    const next = new Date(monday)
    next.setDate(next.getDate() + delta * 7)
    setMonday(next)
  }

  const applyAttendance = async (row: AttendanceRow) => {
    if (!row.memberId || !row.projectId || !row.canApplyAttendance) return
    setApplying(row.key)
    try {
      const res = await fetch('/api/attendance-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: row.memberId, projectId: row.projectId, date: row.date }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed')
      setToast({ msg: `${row.memberName}: ${row.observedHours.toFixed(2)}h copied to unapproved time` })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Reconciliation failed', type: 'error' })
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div className="module-header" data-kicker="Attendance control" style={{ padding: '20px 20px 14px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/timesheets" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="var(--t3)" />
          <span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>Timesheets</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.4, fontFamily: SF }}>Attendance reconciliation</h1>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--t3)', marginTop: 4, fontFamily: SF }}>
          Compare site check-in evidence with payable hours. Corrections stay unapproved until a manager approves the timesheet.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" style={navBtn}><IcChevL size={16} color="var(--t2)" /></button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: SF, fontSize: 13, color: 'var(--t1)', fontWeight: 650 }}>Wk {week} · {fmtWeekRange(monday)}</div>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" style={navBtn}><IcChevR size={16} color="var(--t2)" /></button>
        </div>
      </div>

      {summary && (
        <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {[
            ['Exceptions', summary.exceptions, '#f59e0b'],
            ['Matched days', summary.matched, '#10b981'],
            ['Missing check-out', summary.missingCheckout, '#ef4444'],
            ['Hour variance', summary.variance, '#8b5cf6'],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: String(color), marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 44, textAlign: 'center', color: 'var(--t3)', fontFamily: SF }}>Checking attendance…</div>
      ) : error ? (
        <div style={{ margin: 16, padding: 18, borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.28)', color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ margin: 16, padding: '42px 22px', borderRadius: 14, background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
          <IcCheck size={28} color="#10b981" />
          <div style={{ color: 'var(--t1)', fontFamily: SF, fontWeight: 700, marginTop: 10 }}>No attendance exceptions</div>
          <div style={{ color: 'var(--t3)', fontFamily: SF, fontSize: 12, marginTop: 4 }}>Site evidence and logged time are aligned for this week.</div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(row => {
            const varianceText = row.varianceHours > 0 ? `+${row.varianceHours.toFixed(2)}h` : `${row.varianceHours.toFixed(2)}h`
            return (
              <div key={row.key} style={{ background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 14, fontWeight: 700 }}>{row.memberName}</div>
                    <div style={{ color: 'var(--t3)', fontFamily: SF, fontSize: 11, marginTop: 2 }}>{row.projectName} · {new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: Math.abs(row.varianceHours) >= 0.5 ? '#f59e0b' : 'var(--t3)', whiteSpace: 'nowrap' }}>{varianceText}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  <div style={metricBox}><span style={metricLabel}>On site</span><strong style={metricValue}>{row.observedHours.toFixed(2)}h</strong></div>
                  <div style={metricBox}><span style={metricLabel}>Logged</span><strong style={metricValue}>{row.loggedHours.toFixed(2)}h</strong></div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {row.issues.map(issue => <span key={issue} style={issuePill}>{ISSUE_LABEL[issue]}</span>)}
                  {row.approvedAny && <span style={{ ...issuePill, color: '#60a5fa', borderColor: 'rgba(96,165,250,.32)', background: 'rgba(96,165,250,.09)' }}>Approved time — manual review</span>}
                  {row.timeEntryIds.length > 1 && <span style={{ ...issuePill, color: '#c4b5fd', borderColor: 'rgba(196,181,253,.3)', background: 'rgba(139,92,246,.09)' }}>Split entries — manual review</span>}
                </div>

                {row.canApplyAttendance ? (
                  <button onClick={() => applyAttendance(row)} disabled={applying === row.key} style={{ width: '100%', marginTop: 12, padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(16,185,129,.34)', background: 'rgba(16,185,129,.13)', color: '#34d399', fontFamily: SF, fontSize: 12, fontWeight: 750, cursor: 'pointer' }}>
                    {applying === row.key ? 'Applying…' : `Use attendance · ${row.observedHours.toFixed(2)}h`}
                  </button>
                ) : (
                  <div style={{ marginTop: 10, color: 'var(--t3)', fontFamily: SF, fontSize: 11, lineHeight: 1.45 }}>
                    Review manually in Timesheets{row.openCheckins ? ' after the open check-in is closed' : ''}.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <TabBar />
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const metricBox: React.CSSProperties = { background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const metricLabel: React.CSSProperties = { color: 'var(--t3)', fontFamily: SF, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }
const metricValue: React.CSSProperties = { color: 'var(--t1)', fontFamily: 'ui-monospace, monospace', fontSize: 13 }
const issuePill: React.CSSProperties = { padding: '4px 8px', borderRadius: 99, border: '1px solid rgba(245,158,11,.32)', background: 'rgba(245,158,11,.09)', color: '#fbbf24', fontFamily: SF, fontSize: 10, fontWeight: 700 }

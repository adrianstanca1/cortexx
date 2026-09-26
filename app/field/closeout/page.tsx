'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcAlert, IcCheck, IcChevL, IcClock, IcDoc, IcLayers, IcTeam } from '@/components/ui/Icons'

type Project = { id: string; name: string }
type Metrics = {
  openConstraints: number
  criticalConstraints: number
  qaWaiting: number
  failedInspections: number
  handovers: number
  pendingHandovers: number
  productionLogs: number
  productionPlanned: number
  productionInstalled: number
  productionPct: number | null
  timeEntries: number
  unapprovedTimeEntries: number
  peopleLogged: number
  hours: number
  diaryNotes: number
  photos: number
  openUrgentTasks: number
}
type Closeout = {
  project?: Project
  date: string
  canClose: boolean
  closed: boolean
  closeout?: { id: string; actorName: string; createdAt: string } | null
  blocking: string[]
  warnings: string[]
  metrics: Metrics
}

const SF = 'var(--font-system)'
const today = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function FieldCloseoutPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(today())
  const [report, setReport] = useState<Closeout | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [acknowledge, setAcknowledge] = useState(false)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/projects?take=100')
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data?.error || 'Failed to load projects')
        const rows = data.projects || []
        setProjects(rows)
        if (rows[0]?.id) setProjectId(rows[0].id)
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Failed to load projects'))
  }, [])

  const load = useCallback(async () => {
    if (!projectId) {
      setReport(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch(`/api/field-closeout?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Failed to load shift close-out')
      setReport(data)
      setAcknowledge(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shift close-out')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, date])

  useEffect(() => { void load() }, [load])

  const issues = (report?.blocking.length || 0) + (report?.warnings.length || 0)
  const ready = !!report && issues === 0 && !report.closed

  const closeShift = async () => {
    if (!projectId || !report || closing) return
    setClosing(true)
    setMessage('')
    try {
      const response = await fetch('/api/field-closeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, date, notes, acknowledgeOpenItems: acknowledge }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data?.code === 'CLOSEOUT_ACK_REQUIRED') {
          setReport(current => current ? { ...current, blocking: data.blocking || [], warnings: data.warnings || [], metrics: data.metrics || current.metrics } : current)
        }
        throw new Error(data?.error || 'Failed to close shift')
      }
      setMessage('Shift closed and recorded in the project evidence trail.')
      setNotes('')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to close shift')
    } finally {
      setClosing(false)
    }
  }

  const metrics = report?.metrics
  const productionText = metrics?.productionPct == null ? '—' : `${metrics.productionPct}%`
  const statusText = report?.closed ? 'CLOSED' : report?.blocking.length ? 'BLOCKED' : report?.warnings.length ? 'REVIEW' : 'READY'
  const statusColor = report?.closed ? 'var(--green)' : report?.blocking.length ? 'var(--red)' : report?.warnings.length ? 'var(--orange)' : 'var(--accent)'

  const actionLinks = useMemo(() => [
    { href: '/field/constraints', label: 'Resolve constraints', Icon: IcAlert },
    { href: '/inspections', label: 'QA release', Icon: IcCheck },
    { href: '/field/handover', label: 'Create handover', Icon: IcTeam },
    { href: '/field/productivity', label: 'Log output', Icon: IcLayers },
    { href: '/site-diary', label: 'Site diary', Icon: IcDoc },
    { href: '/timesheets', label: 'Timesheets', Icon: IcClock },
  ], [])

  return (
    <div className="module-page" style={{ minHeight: '100dvh', paddingBottom: 108 }}>
      <header className="module-header" data-kicker="Shift close-out" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/field" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 8 }}>
          <IcChevL size={17} color="var(--t3)" /><span style={{ color: 'var(--t3)', fontFamily: SF, fontSize: 12 }}>Field</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 className="display-title" style={{ fontSize: 30, color: 'var(--t1)', margin: 0 }}>Close shift</h1>
            <p style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 12, marginTop: 5 }}>Check site controls, acknowledge open items, then create a dated close-out record.</p>
          </div>
          {report && <span style={{ padding: '6px 10px', borderRadius: 999, border: `1px solid ${statusColor}55`, background: `${statusColor}12`, color: statusColor, fontFamily: SF, fontSize: 9.5, fontWeight: 900, letterSpacing: '.08em' }}>{statusText}</span>}
        </div>
      </header>

      <main style={{ padding: '16px 0 0' }}>
        <section className="workspace-panel" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 9 }}>
            <label><span style={labelStyle}>Project</span><select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}{projects.length === 0 && <option value="">No assigned project</option>}</select></label>
            <label><span style={labelStyle}>Shift date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} /></label>
          </div>
        </section>

        {message && <div style={{ marginBottom: 12, borderRadius: 12, padding: '10px 12px', background: message.startsWith('Shift closed') ? 'rgba(69,209,138,.10)' : 'rgba(255,157,77,.10)', color: message.startsWith('Shift closed') ? 'var(--green)' : 'var(--orange)', border: '1px solid var(--hair)', fontFamily: SF, fontSize: 11.5 }}>{message}</div>}

        {loading ? <div style={emptyStyle}>Checking shift records…</div> : report && metrics ? (
          <>
            <section className="workspace-grid" style={{ marginBottom: 12 }}>
              <Metric label="Critical blockers" value={metrics.criticalConstraints} alert={metrics.criticalConstraints > 0} />
              <Metric label="QA release waiting" value={metrics.qaWaiting} alert={metrics.qaWaiting > 0} />
              <Metric label="Plan achieved" value={productionText} alert={metrics.productionPct != null && metrics.productionPct < 80} />
              <Metric label="Hours logged" value={metrics.hours} />
              <Metric label="Handover" value={metrics.handovers ? (metrics.pendingHandovers ? 'Pending' : 'Recorded') : 'Missing'} alert={!metrics.handovers || metrics.pendingHandovers > 0} />
              <Metric label="Diary / photos" value={`${metrics.diaryNotes} / ${metrics.photos}`} alert={metrics.diaryNotes === 0} />
            </section>

            {(report.blocking.length > 0 || report.warnings.length > 0) && (
              <section className="workspace-panel" style={{ padding: 15, marginBottom: 12 }}>
                {report.blocking.length > 0 && <IssueGroup title="Must be acknowledged" items={report.blocking} color="var(--red)" />}
                {report.warnings.length > 0 && <IssueGroup title="Close-out warnings" items={report.warnings} color="var(--orange)" />}
                <div className="workspace-grid" style={{ marginTop: 12 }}>
                  {actionLinks.map(item => <Link key={item.href} href={item.href} className="command-card" style={{ padding: 12, textDecoration: 'none', minHeight: 74 }}><item.Icon size={17} color="var(--accent)" /><div style={{ marginTop: 8, fontFamily: SF, color: 'var(--t1)', fontSize: 11.5, fontWeight: 800 }}>{item.label}</div></Link>)}
                </div>
              </section>
            )}

            <section className="workspace-panel" style={{ padding: 15 }}>
              {report.closed ? (
                <div>
                  <div style={{ color: 'var(--green)', fontFamily: SF, fontSize: 15, fontWeight: 900 }}>✓ Shift already closed</div>
                  <p style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 11.5, marginTop: 5 }}>Recorded by {report.closeout?.actorName || 'site team'}{report.closeout?.createdAt ? ` · ${new Date(report.closeout.createdAt).toLocaleString('en-GB')}` : ''}.</p>
                </div>
              ) : report.canClose ? (
                <>
                  <label><span style={labelStyle}>Close-out note</span><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What should management or the next shift know?" style={{ ...inputStyle, resize: 'vertical' }} /></label>
                  {issues > 0 && <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12, color: 'var(--t2)', fontFamily: SF, fontSize: 11.5, lineHeight: 1.45 }}><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} style={{ marginTop: 2 }} /><span>I have reviewed the open items above and confirm they have been handed over or remain knowingly outstanding.</span></label>}
                  <button type="button" onClick={closeShift} disabled={closing || (issues > 0 && !acknowledge)} style={{ marginTop: 13, width: '100%', minHeight: 46, border: 0, borderRadius: 13, background: 'var(--accent)', color: 'var(--bg0)', fontFamily: SF, fontWeight: 900, cursor: 'pointer', opacity: closing || (issues > 0 && !acknowledge) ? .45 : 1 }}>{closing ? 'Closing shift…' : ready ? 'Close shift' : 'Close shift with acknowledged items'}</button>
                </>
              ) : <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 12 }}>Only a Company Admin, Project Manager or Foreman can formally close a shift. You can still review the close-out status above.</div>}
            </section>
          </>
        ) : <div style={emptyStyle}>Select an assigned project to review close-out.</div>}
      </main>
      <TabBar />
    </div>
  )
}

function Metric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return <div className="workspace-stat"><div style={{ color: alert ? 'var(--orange)' : 'var(--accent)', fontFamily: 'ui-monospace, monospace', fontSize: 19, fontWeight: 900 }}>{value}</div><div style={{ color: 'var(--t3)', fontFamily: SF, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 4 }}>{label}</div></div>
}
function IssueGroup({ title, items, color }: { title: string; items: string[]; color: string }) {
  return <div style={{ marginBottom: 10 }}><div style={{ color, fontFamily: SF, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>{title}</div>{items.map(item => <div key={item} style={{ display: 'flex', gap: 7, color: 'var(--t2)', fontFamily: SF, fontSize: 11.5, marginBottom: 5 }}><span style={{ color }}>●</span><span>{item}</span></div>)}</div>
}
const labelStyle: React.CSSProperties = { display: 'block', color: 'var(--t3)', fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-raised)', color: 'var(--t1)', border: '1px solid var(--hairMid)', borderRadius: 11, padding: '10px 11px', outline: 'none', fontFamily: SF, fontSize: 12 }
const emptyStyle: React.CSSProperties = { padding: 38, color: 'var(--t3)', textAlign: 'center', fontFamily: SF, fontSize: 12.5 }

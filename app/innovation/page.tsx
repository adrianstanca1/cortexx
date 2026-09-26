'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  IcAlert, IcArrowRight, IcHardhat, IcLayers, IcSpark, IcZap,
} from '@/components/ui/Icons'

type Project = { id: string; name: string; status: string; progress: number }
type Improvement = {
  id: string
  projectId?: string | null
  project?: { id: string; name: string } | null
  title?: string | null
  description?: string | null
  raisedBy?: string | null
  ownerName?: string | null
  area?: string | null
  status?: string | null
  impact?: string | null
  effort?: string | null
  metricName?: string | null
  metricUnit?: string | null
  metricDirection?: string | null
  baselineValue?: number | null
  targetValue?: number | null
  resultValue?: number | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
}
type Constraint = {
  id: string
  title: string
  ownerName?: string | null
  priority: string
  status: string
  category: string
  dueDate?: string | null
  project?: { id: string; name: string } | null
}
type ProductionLog = {
  id: string
  date: string
  area: string
  activity: string
  unit: string
  plannedQty: number
  installedQty: number
  labourHours: number
  crewSize: number
  project?: { id: string; name: string } | null
}
type Signal = { id: string; level: 'high' | 'medium' | 'good'; title: string; detail: string; href: string }
type Summary = {
  ideas: number
  pilots: number
  proven: number
  measurementGaps: number
  measuredProven: number
  openConstraints: number
  criticalConstraints: number
  blockedActivities: number
  overdueActivities: number
  openRequisitions: number
  procurementAtRisk: number
  openSafety: number
  highSafety: number
  plannedQty: number
  installedQty: number
  labourHours: number
  achievementPct: number | null
  qtyPerLabourHour: number | null
}
type InnovationData = {
  generatedAt: string
  scope: { projectId: string | null; projectCount: number }
  permissions: { write: boolean }
  projects: Project[]
  improvements: Improvement[]
  constraints: Constraint[]
  productionLogs: ProductionLog[]
  signals: Signal[]
  summary: Summary
}

const emptySummary: Summary = {
  ideas: 0, pilots: 0, proven: 0, measurementGaps: 0, measuredProven: 0, openConstraints: 0, criticalConstraints: 0,
  blockedActivities: 0, overdueActivities: 0, openRequisitions: 0, procurementAtRisk: 0,
  openSafety: 0, highSafety: 0, plannedQty: 0, installedQty: 0, labourHours: 0,
  achievementPct: null, qtyPerLabourHour: null,
}

function asScore(value: string | null | undefined, fallback = 3) {
  const n = Number(value)
  if (Number.isFinite(n)) return Math.max(1, Math.min(5, n))
  const key = String(value || '').toLowerCase()
  if (key === 'high') return 5
  if (key === 'medium') return 3
  if (key === 'low') return 1
  return fallback
}

function ideaScore(row: Improvement) {
  return asScore(row.impact, 3) * 2 + (6 - asScore(row.effort, 3))
}

function outcomePct(row: Improvement) {
  if (row.baselineValue === null || row.baselineValue === undefined || row.resultValue === null || row.resultValue === undefined || row.baselineValue === 0) return null
  const delta = row.metricDirection === 'decrease'
    ? row.baselineValue - row.resultValue
    : row.resultValue - row.baselineValue
  return Math.round((delta / Math.abs(row.baselineValue)) * 1000) / 10
}

function fmt(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-GB', { maximumFractionDigits: digits })
}

function signalTone(level: Signal['level']) {
  if (level === 'high') return { fg: '#fecaca', bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.28)' }
  if (level === 'medium') return { fg: '#fde68a', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.28)' }
  return { fg: '#bbf7d0', bg: 'rgba(34,197,94,.12)', border: 'rgba(34,197,94,.28)' }
}

export default function InnovationPage() {
  const [projectId, setProjectId] = useState('')
  const [data, setData] = useState<InnovationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaArea, setIdeaArea] = useState('productivity')
  const [impact, setImpact] = useState(4)
  const [effort, setEffort] = useState(2)

  const [measureIdea, setMeasureIdea] = useState<Improvement | null>(null)
  const [pilotOwner, setPilotOwner] = useState('')
  const [metricName, setMetricName] = useState('')
  const [metricUnit, setMetricUnit] = useState('')
  const [metricDirection, setMetricDirection] = useState('increase')
  const [baselineValue, setBaselineValue] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [resultValue, setResultValue] = useState('')

  const [constraintTitle, setConstraintTitle] = useState('')
  const [constraintOwner, setConstraintOwner] = useState('Site')
  const [constraintPriority, setConstraintPriority] = useState('high')
  const [constraintCategory, setConstraintCategory] = useState('other')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = projectId ? '?projectId=' + encodeURIComponent(projectId) : ''
      const res = await fetch('/api/innovation' + query, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load Innovation OS')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Innovation OS')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const rankedIdeas = useMemo(
    () => [...(data?.improvements || [])].sort((a, b) => ideaScore(b) - ideaScore(a)),
    [data?.improvements],
  )

  const createIdea = async (event: FormEvent) => {
    event.preventDefault()
    const title = ideaTitle.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/improve-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          projectId: projectId || null,
          area: ideaArea,
          status: 'idea',
          impact: String(impact),
          effort: String(effort),
          raisedBy: 'Innovation OS',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to create idea')
      setIdeaTitle('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create idea')
    } finally {
      setSaving(false)
    }
  }

  const openMeasurement = (idea: Improvement) => {
    setMeasureIdea(idea)
    setPilotOwner(idea.ownerName || '')
    setMetricName(idea.metricName || '')
    setMetricUnit(idea.metricUnit || '')
    setMetricDirection(idea.metricDirection || 'increase')
    setBaselineValue(idea.baselineValue === null || idea.baselineValue === undefined ? '' : String(idea.baselineValue))
    setTargetValue(idea.targetValue === null || idea.targetValue === undefined ? '' : String(idea.targetValue))
    setResultValue(idea.resultValue === null || idea.resultValue === undefined ? '' : String(idea.resultValue))
  }

  const saveMeasurement = async (event: FormEvent) => {
    event.preventDefault()
    if (!measureIdea || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/improve-hub/' + measureIdea.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: pilotOwner.trim() || null,
          metricName: metricName.trim() || null,
          metricUnit: metricUnit.trim() || null,
          metricDirection,
          baselineValue: baselineValue === '' ? null : Number(baselineValue),
          targetValue: targetValue === '' ? null : Number(targetValue),
          resultValue: resultValue === '' ? null : Number(resultValue),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to save measurement plan')
      setMeasureIdea(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save measurement plan')
    } finally {
      setSaving(false)
    }
  }

  const advanceIdea = async (idea: Improvement) => {
    const status = String(idea.status || 'idea').toLowerCase()
    const next = status === 'idea' ? 'pilot' : status === 'pilot' || status === 'testing' ? 'proven' : null
    if (!next || saving) return

    if (
      next === 'proven' &&
      (!idea.metricName || idea.baselineValue === null || idea.baselineValue === undefined || idea.targetValue === null || idea.targetValue === undefined || idea.resultValue === null || idea.resultValue === undefined)
    ) {
      openMeasurement(idea)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/improve-hub/' + idea.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to update idea')
      if (next === 'pilot' && json.item) openMeasurement(json.item)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update idea')
    } finally {
      setSaving(false)
    }
  }

  const createConstraint = async (event: FormEvent) => {
    event.preventDefault()
    if (!projectId || !constraintTitle.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/field-constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: constraintTitle.trim(),
          ownerName: constraintOwner.trim() || 'Site',
          priority: constraintPriority,
          category: constraintCategory,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to create constraint')
      setConstraintTitle('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create constraint')
    } finally {
      setSaving(false)
    }
  }

  const resolveConstraint = async (constraint: Constraint) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/field-constraints/' + constraint.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolution: 'Closed from Innovation OS' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to resolve constraint')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve constraint')
    } finally {
      setSaving(false)
    }
  }

  const summary = data?.summary || emptySummary
  const achievement = summary.achievementPct
  const selectedProject = data?.projects.find(project => project.id === projectId)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg0)', padding: '18px 16px 110px' }}>
      <div style={{ maxWidth: 1220, margin: '0 auto' }}>
        <section style={hero}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={eyebrow}><IcSpark size={14} color="#67e8f9" /> Construction Innovation OS</div>
            <h1 style={{ margin: '8px 0 0', color: '#fff', fontSize: 'clamp(28px,5vw,48px)', lineHeight: 1.02, letterSpacing: '-0.04em' }}>
              Turn field friction into measurable improvement.
            </h1>
            <p style={{ margin: '12px 0 0', color: '#a8bdd2', fontSize: 14, lineHeight: 1.6, maxWidth: 760 }}>
              Live signals from production, programme, procurement, safety and continuous improvement — connected to the work already happening in Cortexx.
            </p>
          </div>
          <div style={{ position: 'relative', zIndex: 1, minWidth: 230 }}>
            <label style={label}>Scope</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={select}>
              <option value="">Portfolio · all accessible projects</option>
              {(data?.projects || []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <div style={{ marginTop: 10, color: '#91a7bf', fontSize: 11 }}>
              {selectedProject ? selectedProject.progress + '% project progress' : (data?.scope.projectCount || 0) + ' projects in scope'}
            </div>
          </div>
        </section>

        {error && <div style={errorBox}>{error}</div>}
        {loading && !data ? <div style={loadingBox}>Loading live construction signals…</div> : (
          <>
            <section className="innovation-metrics">
              <Metric label="14-day plan achieved" value={achievement === null ? '—' : achievement + '%'} sub={fmt(summary.installedQty, 1) + ' / ' + fmt(summary.plannedQty, 1) + ' installed'} tone={achievement !== null && achievement < 90 ? '#f59e0b' : '#22c55e'} />
              <Metric label="Open constraints" value={String(summary.openConstraints)} sub={summary.criticalConstraints + ' critical'} tone={summary.criticalConstraints ? '#ef4444' : '#45d18a'} />
              <Metric label="Programme pressure" value={String(summary.blockedActivities + summary.overdueActivities)} sub={summary.blockedActivities + ' blocked · ' + summary.overdueActivities + ' overdue'} tone="#60a5fa" />
              <Metric label="Procurement at risk" value={String(summary.procurementAtRisk)} sub={summary.openRequisitions + ' open requisitions'} tone="#f59e0b" />
              <Metric label="Safety signals" value={String(summary.openSafety)} sub={summary.highSafety + ' high / critical'} tone={summary.highSafety ? '#ef4444' : '#45d18a'} />
              <Metric label="Improvement pipeline" value={String(summary.ideas)} sub={summary.pilots + ' pilots · ' + summary.measurementGaps + ' need measures'} tone="#8b5cf6" />
            </section>

            <section className="innovation-columns">
              <div style={panel}>
                <SectionTitle icon={<IcZap size={16} color="#f59e0b" />} title="Opportunity radar" sub="System-generated triggers from live construction data" />
                <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>
                  {(data?.signals || []).map(signal => {
                    const tone = signalTone(signal.level)
                    return (
                      <Link key={signal.id} href={signal.href} style={{ ...signalCard, background: tone.bg, borderColor: tone.border }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: tone.fg, fontSize: 12, fontWeight: 800 }}>{signal.title}</div>
                          <div style={{ color: '#91a7bf', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{signal.detail}</div>
                        </div>
                        <IcArrowRight size={15} color={tone.fg} />
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div style={panel}>
                <SectionTitle icon={<IcSpark size={16} color="#a78bfa" />} title="Improvement backlog" sub="Idea → pilot → proven standard" />
                {data?.permissions.write && (
                  <form onSubmit={createIdea} className="idea-form">
                    <input value={ideaTitle} onChange={e => setIdeaTitle(e.target.value)} placeholder="Capture an improvement…" style={input} />
                    <select value={ideaArea} onChange={e => setIdeaArea(e.target.value)} style={selectSmall}>
                      <option value="productivity">Productivity</option><option value="safety">Safety</option><option value="quality">Quality</option><option value="logistics">Logistics</option><option value="procurement">Procurement</option><option value="carbon">Carbon</option><option value="digital">Digital</option><option value="programme">Programme</option><option value="commercial">Commercial</option><option value="other">Other</option>
                    </select>
                    <select value={impact} onChange={e => setImpact(Number(e.target.value))} style={selectSmall}>{[5,4,3,2,1].map(n => <option key={n} value={n}>Impact {n}</option>)}</select>
                    <select value={effort} onChange={e => setEffort(Number(e.target.value))} style={selectSmall}>{[1,2,3,4,5].map(n => <option key={n} value={n}>Effort {n}</option>)}</select>
                    <button disabled={saving} style={primaryButton}>Add</button>
                  </form>
                )}
                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                  {rankedIdeas.slice(0, 8).map(idea => {
                    const status = String(idea.status || 'idea').toLowerCase()
                    const outcome = outcomePct(idea)
                    const isMeasuredStage = ['pilot', 'testing', 'proven', 'complete', 'completed'].includes(status)
                    return (
                      <div key={idea.id} style={{ ...ideaCard, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                            <b style={{ color: 'var(--t1)', fontSize: 12 }}>{idea.title || 'Untitled improvement'}</b>
                            <span style={statusPill(status)}>{status}</span>
                            <span style={scorePill}>Score {ideaScore(idea)}/15</span>
                          </div>
                          <div style={{ color: 'var(--t3)', fontSize: 10, marginTop: 5 }}>
                            Impact {asScore(idea.impact)} · Effort {asScore(idea.effort)} · {idea.area || 'other'} · {idea.project?.name || 'Company-wide'} · {new Date(idea.createdAt).toLocaleDateString('en-GB')}
                          </div>
                          {idea.metricName && (
                            <div style={{ marginTop: 7, padding: '7px 8px', borderRadius: 8, background: 'rgba(72,216,255,.055)', color: 'var(--t2)', fontSize: 9, lineHeight: 1.5 }}>
                              <b style={{ color: '#67e8f9' }}>{idea.metricName}</b>
                              {' · baseline ' + fmt(idea.baselineValue, 2)}
                              {' · target ' + fmt(idea.targetValue, 2)}
                              {idea.resultValue !== null && idea.resultValue !== undefined ? ' · result ' + fmt(idea.resultValue, 2) : ''}
                              {idea.metricUnit ? ' ' + idea.metricUnit : ''}
                              {outcome !== null && <span style={{ marginLeft: 6, color: outcome >= 0 ? '#86efac' : '#fca5a5', fontWeight: 900 }}>{outcome >= 0 ? '+' : ''}{outcome}%</span>}
                            </div>
                          )}
                        </div>
                        {data?.permissions.write && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isMeasuredStage && <button type="button" onClick={() => openMeasurement(idea)} disabled={saving} style={measureButton}>Measure</button>}
                            {!['proven','complete','completed'].includes(status) && (
                              <button type="button" onClick={() => advanceIdea(idea)} disabled={saving} style={miniButton}>{status === 'idea' ? 'Pilot' : 'Prove'}</button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {rankedIdeas.length === 0 && <Empty text="No improvement ideas yet." />}
                </div>
              </div>
            </section>

            <section className="innovation-columns">
              <div style={panel}>
                <SectionTitle icon={<IcAlert size={16} color="#ef4444" />} title="Constraint radar" sub={projectId ? 'Create and close blockers for this project' : 'Choose a project to manage blockers'} />
                {projectId && data?.permissions.write && (
                  <form onSubmit={createConstraint} className="constraint-form">
                    <input value={constraintTitle} onChange={e => setConstraintTitle(e.target.value)} placeholder="What is stopping the work?" style={input} />
                    <input value={constraintOwner} onChange={e => setConstraintOwner(e.target.value)} placeholder="Owner" style={input} />
                    <select value={constraintPriority} onChange={e => setConstraintPriority(e.target.value)} style={selectSmall}>
                      <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                    <select value={constraintCategory} onChange={e => setConstraintCategory(e.target.value)} style={selectSmall}>
                      <option value="design">Design</option><option value="material">Material</option><option value="access">Access</option><option value="labour">Labour</option><option value="plant">Plant</option><option value="quality">Quality</option><option value="safety">Safety</option><option value="other">Other</option>
                    </select>
                    <button disabled={saving} style={primaryButton}>Raise</button>
                  </form>
                )}
                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                  {(data?.constraints || []).slice(0, 10).map(constraint => (
                    <div key={constraint.id} style={ideaCard}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: constraint.priority === 'critical' ? '#ef4444' : constraint.priority === 'high' ? '#f59e0b' : '#60a5fa', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ color: 'var(--t1)', fontSize: 12 }}>{constraint.title}</b>
                        <div style={{ color: 'var(--t3)', fontSize: 10, marginTop: 4 }}>{constraint.project?.name || 'Project'} · {constraint.category} · owner {constraint.ownerName || 'unassigned'}</div>
                      </div>
                      {data?.permissions.write && <button disabled={saving} onClick={() => resolveConstraint(constraint)} style={miniButton}>Resolve</button>}
                    </div>
                  ))}
                  {(data?.constraints || []).length === 0 && <Empty text="No open constraints in this scope." />}
                </div>
              </div>

              <div style={panel}>
                <SectionTitle icon={<IcHardhat size={16} color="#22c55e" />} title="Production pulse" sub="Last 14 days · direct from field production logs" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
                  <MiniMetric label="Installed" value={fmt(summary.installedQty, 1)} />
                  <MiniMetric label="Labour hours" value={fmt(summary.labourHours, 1)} />
                  <MiniMetric label="Qty / labour hr" value={fmt(summary.qtyPerLabourHour, 3)} />
                </div>
                <div style={{ display: 'grid', gap: 7, marginTop: 14 }}>
                  {(data?.productionLogs || []).slice(0, 8).map(log => {
                    const rowPct = log.plannedQty > 0 ? Math.round((log.installedQty / log.plannedQty) * 100) : null
                    return (
                      <div key={log.id} style={productionRow}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <b style={{ color: 'var(--t1)', fontSize: 11 }}>{log.activity}</b>
                          <div style={{ color: 'var(--t3)', fontSize: 10, marginTop: 3 }}>{log.project?.name || 'Project'} · {log.area} · {new Date(log.date).toLocaleDateString('en-GB')}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: rowPct !== null && rowPct < 90 ? '#f59e0b' : '#45d18a', fontSize: 12, fontWeight: 800 }}>{rowPct === null ? '—' : rowPct + '%'}</div>
                          <div style={{ color: 'var(--t3)', fontSize: 9 }}>{fmt(log.installedQty, 1)} / {fmt(log.plannedQty, 1)} {log.unit}</div>
                        </div>
                      </div>
                    )
                  })}
                  {(data?.productionLogs || []).length === 0 && <Empty text="No production logs in the last 14 days." />}
                </div>
              </div>
            </section>

            <section style={{ ...panel, marginTop: 14 }}>
              <SectionTitle icon={<IcLayers size={16} color="#48d8ff" />} title="Innovation loop" sub="Move from observation to standard work without losing the evidence trail" />
              <div className="loop-grid">
                <LoopStep n="1" title="Observe" text="Capture a blocker, production gap, safety signal or waste." href={projectId ? '/field/constraints' : '/field'} />
                <LoopStep n="2" title="Experiment" text="Turn the best idea into a controlled pilot with an owner." href="/improve-hub" />
                <LoopStep n="3" title="Measure" text="Use field production and programme data to prove the effect." href={projectId ? '/projects/' + projectId + '/programme' : '/projects'} />
                <LoopStep n="4" title="Standardise" text="Promote proven improvements into process and team practice." href="/process-library" />
              </div>
            </section>
          </>
        )}
      </div>

      {measureIdea && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pilot measurement plan"
          onMouseDown={event => { if (event.target === event.currentTarget && !saving) setMeasureIdea(null) }}
          style={modalOverlay}
        >
          <form onSubmit={saveMeasurement} style={modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...eyebrow, color: '#a78bfa' }}>Pilot measurement</div>
                <h2 style={{ margin: '6px 0 0', color: 'var(--t1)', fontSize: 18, letterSpacing: '-0.02em' }}>{measureIdea.title || 'Improvement pilot'}</h2>
                <div style={{ color: 'var(--t3)', fontSize: 10, marginTop: 5 }}>
                  {measureIdea.project?.name || selectedProject?.name || 'Company-wide'} · {measureIdea.area || 'other'}
                </div>
              </div>
              <button type="button" onClick={() => setMeasureIdea(null)} disabled={saving} style={closeButton} aria-label="Close measurement plan">×</button>
            </div>

            <div style={{ marginTop: 12, borderRadius: 10, padding: '9px 10px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', color: '#fde68a', fontSize: 10, lineHeight: 1.55 }}>
              A pilot can start with a baseline and target. To mark it <b>Proven</b>, add the observed result as evidence.
            </div>

            <div className="measure-grid">
              <label style={fieldLabel}>Pilot owner
                <input value={pilotOwner} onChange={e => setPilotOwner(e.target.value)} placeholder="Responsible person" style={input} />
              </label>
              <label style={fieldLabel}>Metric
                <input value={metricName} onChange={e => setMetricName(e.target.value)} placeholder="e.g. Panels installed / hour" style={input} />
              </label>
              <label style={fieldLabel}>Unit
                <input value={metricUnit} onChange={e => setMetricUnit(e.target.value)} placeholder="panels/hr, %, min…" style={input} />
              </label>
              <label style={fieldLabel}>Desired direction
                <select value={metricDirection} onChange={e => setMetricDirection(e.target.value)} style={{ ...selectSmall, width: '100%' }}>
                  <option value="increase">Increase is better</option>
                  <option value="decrease">Decrease is better</option>
                </select>
              </label>
              <label style={fieldLabel}>Baseline
                <input type="number" step="any" value={baselineValue} onChange={e => setBaselineValue(e.target.value)} placeholder="Before pilot" style={input} />
              </label>
              <label style={fieldLabel}>Target
                <input type="number" step="any" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="Expected result" style={input} />
              </label>
              <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>Observed result
                <input type="number" step="any" value={resultValue} onChange={e => setResultValue(e.target.value)} placeholder="Leave blank until the pilot has evidence" style={input} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--t3)', fontSize: 9 }}>
                {baselineValue && resultValue
                  ? 'Calculated improvement: ' + (outcomePct({ ...measureIdea, baselineValue: Number(baselineValue), resultValue: Number(resultValue), metricDirection }) ?? '—') + '%'
                  : 'Record the result after the trial to quantify the improvement.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setMeasureIdea(null)} disabled={saving} style={secondaryButton}>Cancel</button>
                <button type="submit" disabled={saving} style={primaryButton}>{saving ? 'Saving…' : 'Save measurement'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .innovation-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:14px}
        .innovation-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
        .idea-form{display:grid;grid-template-columns:minmax(180px,1fr) 110px 92px 92px auto;gap:8px;margin-top:14px}
        .constraint-form{display:grid;grid-template-columns:1.4fr .7fr 100px 100px auto;gap:8px;margin-top:14px}
        .measure-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
        .loop-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
        @media(max-width:1050px){.innovation-metrics{grid-template-columns:repeat(3,1fr)}.idea-form{grid-template-columns:1fr 110px 92px 92px}.constraint-form{grid-template-columns:1fr 1fr 110px 110px}}
        @media(max-width:780px){.innovation-columns{grid-template-columns:1fr}.loop-grid{grid-template-columns:1fr 1fr}.constraint-form{grid-template-columns:1fr 1fr}.idea-form{grid-template-columns:1fr 1fr}.innovation-metrics{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.innovation-metrics{grid-template-columns:1fr 1fr}.loop-grid{grid-template-columns:1fr}.constraint-form{grid-template-columns:1fr}.idea-form{grid-template-columns:1fr}.measure-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  )
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return <div style={metric}><div style={{ color: 'var(--t3)', fontSize: 10 }}>{label}</div><div style={{ color: tone, fontSize: 24, fontWeight: 900, marginTop: 5 }}>{value}</div><div style={{ color: 'var(--t3)', fontSize: 9, marginTop: 3, lineHeight: 1.4 }}>{sub}</div></div>
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: 'rgba(255,255,255,.035)', border: '1px solid var(--hair)', borderRadius: 10, padding: 10 }}><div style={{ color: 'var(--t3)', fontSize: 9 }}>{label}</div><div style={{ color: 'var(--t1)', fontSize: 15, fontWeight: 800, marginTop: 3 }}>{value}</div></div>
}

function SectionTitle({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}><div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.05)', display: 'grid', placeItems: 'center' }}>{icon}</div><div><div style={{ color: 'var(--t1)', fontSize: 14, fontWeight: 800 }}>{title}</div><div style={{ color: 'var(--t3)', fontSize: 10, marginTop: 2 }}>{sub}</div></div></div>
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: 'var(--t3)', fontSize: 11, padding: '18px 8px', textAlign: 'center' }}>{text}</div>
}

function LoopStep({ n, title, text, href }: { n: string; title: string; text: string; href: string }) {
  return <Link href={href} style={{ textDecoration: 'none', background: 'rgba(255,255,255,.035)', border: '1px solid var(--hair)', borderRadius: 12, padding: 13 }}><div style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(72,216,255,.12)', color: '#48d8ff', fontSize: 10, fontWeight: 900 }}>{n}</div><div style={{ color: 'var(--t1)', fontWeight: 800, fontSize: 12, marginTop: 9 }}>{title}</div><div style={{ color: 'var(--t3)', fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>{text}</div></Link>
}

const hero: CSSProperties = {
  position: 'relative', overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(72,216,255,.16)',
  background: 'radial-gradient(circle at 82% 10%,rgba(72,216,255,.16),transparent 30%),radial-gradient(circle at 45% 120%,rgba(139,92,246,.18),transparent 36%),#08111e',
  padding: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 18, flexWrap: 'wrap',
}
const eyebrow: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#67e8f9', fontSize: 10, fontWeight: 800, letterSpacing: '.11em', textTransform: 'uppercase' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 14, padding: 14, minWidth: 0 }
const metric: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 13, padding: 12, minWidth: 0 }
const label: CSSProperties = { display: 'block', color: '#91a7bf', fontSize: 9, fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em' }
const select: CSSProperties = { width: '100%', background: '#0b1725', color: '#dbeafe', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '10px 11px', fontSize: 12 }
const selectSmall: CSSProperties = { background: 'var(--surface-raised)', color: 'var(--t1)', border: '1px solid var(--hair)', borderRadius: 9, padding: '9px 8px', fontSize: 10, minWidth: 0 }
const input: CSSProperties = { width: '100%', minWidth: 0, background: 'var(--surface-raised)', color: 'var(--t1)', border: '1px solid var(--hair)', borderRadius: 9, padding: '9px 10px', fontSize: 11, outline: 'none' }
const primaryButton: CSSProperties = { border: 0, borderRadius: 9, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', padding: '9px 13px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }
const secondaryButton: CSSProperties = { border: '1px solid var(--hair)', borderRadius: 9, background: 'rgba(255,255,255,.035)', color: 'var(--t2)', padding: '9px 13px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }
const miniButton: CSSProperties = { border: '1px solid rgba(72,216,255,.22)', borderRadius: 8, background: 'rgba(72,216,255,.08)', color: '#67e8f9', padding: '6px 9px', fontSize: 9, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }
const measureButton: CSSProperties = { border: '1px solid rgba(167,139,250,.24)', borderRadius: 8, background: 'rgba(139,92,246,.09)', color: '#c4b5fd', padding: '6px 9px', fontSize: 9, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }
const modalOverlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 260, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(2,6,23,.76)', backdropFilter: 'blur(10px)' }
const modalCard: CSSProperties = { width: 'min(680px,100%)', maxHeight: '88dvh', overflowY: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: '#091421', padding: 18, boxShadow: '0 24px 80px rgba(0,0,0,.45)' }
const fieldLabel: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--t3)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }
const closeButton: CSSProperties = { border: '1px solid var(--hair)', width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,.04)', color: 'var(--t2)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }
const ideaCard: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: 10, borderRadius: 10, border: '1px solid var(--hair)', background: 'rgba(255,255,255,.025)' }
const productionRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, background: 'rgba(255,255,255,.025)', border: '1px solid var(--hair)' }
const signalCard: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid', borderRadius: 11, padding: 11, textDecoration: 'none' }
const scorePill: CSSProperties = { background: 'rgba(255,255,255,.06)', color: 'var(--t2)', borderRadius: 20, padding: '2px 6px', fontSize: 8, fontWeight: 800 }
const errorBox: CSSProperties = { marginTop: 12, padding: 11, borderRadius: 10, color: '#fecaca', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)', fontSize: 11 }
const loadingBox: CSSProperties = { marginTop: 14, color: 'var(--t3)', background: 'var(--surface)', border: '1px solid var(--hair)', borderRadius: 12, padding: 24, textAlign: 'center', fontSize: 12 }

function statusPill(status: string): CSSProperties {
  const proven = ['proven','complete','completed'].includes(status)
  const pilot = ['pilot','testing'].includes(status)
  return {
    borderRadius: 20, padding: '2px 7px', fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
    color: proven ? '#86efac' : pilot ? '#fde68a' : '#cbd5e1',
    background: proven ? 'rgba(34,197,94,.11)' : pilot ? 'rgba(245,158,11,.11)' : 'rgba(148,163,184,.1)',
  }
}

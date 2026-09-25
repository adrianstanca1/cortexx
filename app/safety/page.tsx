'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcAlert, IcPlus, IcX, IcCheck, IcTrash, IcHardhat } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
type IncidentType = 'near_miss' | 'first_aid' | 'accident' | 'dangerous_occurrence' | 'environmental' | 'security'
type Severity = 'near_miss' | 'low' | 'medium' | 'high' | 'critical'
type Status = 'open' | 'investigating' | 'closed'
type RiddorStatus = 'not_assessed' | 'not_reportable' | 'reportable' | 'submitted'
type ActionStatus = 'open' | 'in_progress' | 'complete'

interface CorrectiveAction {
  id: string; title: string; description: string | null; ownerName: string | null; dueDate: string | null
  status: ActionStatus; completedAt: string | null; evidenceUrl: string | null; notes: string | null
}
interface CloseoutState { ready: boolean; missing: string[] }
interface Incident {
  id: string; projectId: string | null; title: string; description: string | null; type: IncidentType; severity: Severity; status: Status
  location: string | null; reportedBy: string | null; injuredParty: string | null; photoUrl: string | null
  riddorReportable: boolean; riddorStatus: RiddorStatus; riddorDecisionReason: string | null; riddorReference: string | null; riddorSubmittedAt: string | null
  investigatorName: string | null; immediateActions: string | null; investigationSummary: string | null; rootCause: string | null; lessonsLearned: string | null
  investigationStartedAt: string | null; investigationCompletedAt: string | null
  witnesses: Array<{ name?: string; detail?: string }>; evidence: Array<{ url?: string; label?: string }>
  closeoutVerifiedBy: string | null; closeoutVerifiedAt: string | null
  occurredAt: string; closedAt: string | null; notes: string | null
  correctiveActions?: CorrectiveAction[]; closeout?: CloseoutState; riddorReviewRequired?: boolean; project?: Project | null
}

const SF = 'var(--font-system)'
const TYPE_LABEL: Record<IncidentType, string> = { near_miss: 'Near miss', first_aid: 'First aid', accident: 'Accident', dangerous_occurrence: 'Dangerous occurrence', environmental: 'Environmental', security: 'Security' }
const TYPES: IncidentType[] = ['near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security']
const SEVERITIES: Severity[] = ['near_miss', 'low', 'medium', 'high', 'critical']
const SEVERITY_COLOR: Record<Severity, string> = { near_miss: 'var(--t3)', low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' }
const STATUS_COLOR: Record<Status, string> = { open: '#ef4444', investigating: '#f59e0b', closed: '#10b981' }
const STATUS_LABEL: Record<Status, string> = { open: 'Open', investigating: 'Investigating', closed: 'Closed' }
const RIDDOR_LABEL: Record<RiddorStatus, string> = { not_assessed: 'Assessment required', not_reportable: 'Not reportable', reportable: 'Reportable · submit to HSE', submitted: 'Submitted to HSE' }
const CLOSEOUT_LABEL: Record<string, string> = {
  investigation_summary: 'Investigation summary', root_cause: 'Root cause', immediate_actions: 'Immediate actions', corrective_actions: 'Complete corrective actions',
  riddor_decision: 'RIDDOR decision', riddor_reason: 'RIDDOR decision reason', riddor_submission: 'RIDDOR submission', riddor_reference: 'RIDDOR reference', riddor_submitted_at: 'RIDDOR submission timestamp',
}

const EMPTY_FORM = () => ({
  title: '', description: '', type: 'near_miss' as IncidentType, severity: 'low' as Severity,
  projectId: '', location: '', reportedBy: '', injuredParty: '', notes: '', occurredAt: new Date().toISOString().slice(0, 16), riddorReportable: false,
})

export default function SafetyPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [ridorCount, setRidorCount] = useState(0)
  const [daysWithout, setDaysWithout] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [active, setActive] = useState<Incident | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [investigationForm, setInvestigationForm] = useState({ investigatorName: '', immediateActions: '', investigationSummary: '', rootCause: '', lessonsLearned: '', riddorStatus: 'not_assessed' as RiddorStatus, riddorDecisionReason: '', riddorReference: '', witnesses: '', evidence: '' })
  const [actionForm, setActionForm] = useState({ title: '', description: '', ownerName: '', dueDate: '' })

  useModalEffects(showAdd || !!active, () => { setShowAdd(false); setActive(null) })
  useEffect(() => { if (new URLSearchParams(window.location.search).get('new') === '1') setShowAdd(true) }, [])

  const load = useCallback(async () => {
    try {
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const [safetyRes, projectsRes] = await Promise.all([fetch(`/api/safety${qs}`), fetch('/api/projects')])
      if (!safetyRes.ok) throw new Error('Failed to load incidents')
      const d = await safetyRes.json()
      setIncidents(d.incidents || []); setOpenCount(d.openCount || 0); setRidorCount(d.ridorCount || 0); setDaysWithout(d.daysWithoutIncident || 0)
      if (projectsRes.ok) { const p = await projectsRes.json(); setProjects((p.projects || []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }))) }
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } finally { setLoading(false) }
  }, [filter])
  useEffect(() => { load() }, [load])

  const populateInvestigation = (incident: Incident) => setInvestigationForm({
    investigatorName: incident.investigatorName || '', immediateActions: incident.immediateActions || '', investigationSummary: incident.investigationSummary || '', rootCause: incident.rootCause || '', lessonsLearned: incident.lessonsLearned || '',
    riddorStatus: incident.riddorStatus || 'not_assessed', riddorDecisionReason: incident.riddorDecisionReason || '', riddorReference: incident.riddorReference || '',
    witnesses: Array.isArray(incident.witnesses) ? incident.witnesses.map(w => w?.name || w?.detail || '').filter(Boolean).join('\n') : '',
    evidence: Array.isArray(incident.evidence) ? incident.evidence.map(e => e?.url || e?.label || '').filter(Boolean).join('\n') : '',
  })

  const openIncident = async (incident: Incident) => {
    setActive(incident); populateInvestigation(incident); setDetailLoading(true)
    try {
      const res = await fetch(`/api/safety/${incident.id}`); const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load incident')
      setActive(json); populateInvestigation(json)
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to load incident', type: 'error' }) } finally { setDetailLoading(false) }
  }

  const create = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/safety', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, projectId: form.projectId || null, occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : new Date().toISOString() }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed')
      setShowAdd(false); setForm(EMPTY_FORM()); setToast({ msg: 'Incident logged' }); await load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' }) } finally { setSaving(false) }
  }

  const saveInvestigation = async () => {
    if (!active) return
    setSaving(true)
    try {
      const body = {
        investigatorName: investigationForm.investigatorName, immediateActions: investigationForm.immediateActions, investigationSummary: investigationForm.investigationSummary,
        rootCause: investigationForm.rootCause, lessonsLearned: investigationForm.lessonsLearned, riddorStatus: investigationForm.riddorStatus,
        riddorDecisionReason: investigationForm.riddorDecisionReason, ...(investigationForm.riddorStatus === 'submitted' ? { riddorReference: investigationForm.riddorReference } : {}),
        witnesses: investigationForm.witnesses.split(/\n+/).map(name => name.trim()).filter(Boolean).slice(0, 30).map(name => ({ name })),
        evidence: investigationForm.evidence.split(/\n+/).map(url => url.trim()).filter(Boolean).slice(0, 30).map(url => ({ url })),
      }
      const res = await fetch(`/api/safety/${active.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to save investigation')
      setActive(json); populateInvestigation(json); setIncidents(prev => prev.map(x => x.id === active.id ? { ...x, ...json } : x)); setToast({ msg: 'Investigation saved' })
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to save investigation', type: 'error' }) } finally { setSaving(false) }
  }

  const addCorrectiveAction = async () => {
    if (!active || !actionForm.title.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/safety/${active.id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...actionForm, dueDate: actionForm.dueDate || null }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to add action')
      setActionForm({ title: '', description: '', ownerName: '', dueDate: '' }); await openIncident(active); setToast({ msg: 'Corrective action added' })
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to add action', type: 'error' }) } finally { setSaving(false) }
  }

  const updateCorrectiveAction = async (action: CorrectiveAction, status: ActionStatus) => {
    if (!active) return
    try {
      const res = await fetch(`/api/safety/${active.id}/actions/${action.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to update action')
      await openIncident(active); setToast({ msg: status === 'complete' ? 'Corrective action completed' : 'Corrective action updated' })
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to update action', type: 'error' }) }
  }

  const changeStatus = async (incident: Incident, next: Status) => {
    try {
      const res = await fetch(`/api/safety/${incident.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const missing = Array.isArray(json?.missing) ? json.missing.map((key: string) => CLOSEOUT_LABEL[key] || key).join(', ') : ''
        throw new Error(missing ? `${json?.error || 'Closeout incomplete'}: ${missing}` : json?.error || 'Failed to update')
      }
      setActive(json); populateInvestigation(json); setToast({ msg: `Marked ${STATUS_LABEL[next].toLowerCase()}` }); await load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to update', type: 'error' }) }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000); return }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/safety/${id}`, { method: 'DELETE' }); const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed')
      setIncidents(prev => prev.filter(x => x.id !== id)); setActive(null); setToast({ msg: 'Incident deleted' })
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to delete', type: 'error' }) }
  }

  const riddorReviewSuggested = form.type === 'accident' || form.type === 'dangerous_occurrence' || form.severity === 'critical'

  return <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
    {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <div className="module-header" data-kicker="Safety command" style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(9,11,13,0.88)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
      <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}><IcChevL size={18} color="var(--t3)" /><span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>Apps</span></Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}><div><h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', fontFamily: SF }}>Safety</h1><p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, fontFamily: SF }}>Incident · investigation · RIDDOR · closeout</p></div><button onClick={() => setShowAdd(true)} style={primaryBtn('#ef4444')}><IcPlus size={12} color="#fff" /> Log incident</button></div>
    </div>

    <div style={{ padding: '14px 16px 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
      <KPI icon={<IcHardhat size={14} color="#10b981" />} label="Days since" value={String(daysWithout)} color="#10b981" />
      <KPI icon={<IcAlert size={14} color="#ef4444" />} label="Open" value={String(openCount)} color="#ef4444" />
      <KPI icon={<IcAlert size={14} color="#f59e0b" />} label="RIDDOR" value={String(ridorCount)} color="#f59e0b" />
    </div>

    <div style={{ padding: '4px 16px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>{(['all', 'open', 'investigating', 'closed'] as const).map(f => <button key={f} onClick={() => setFilter(f)} style={chipBtn(filter === f)}>{f === 'all' ? 'All' : STATUS_LABEL[f as Status]}</button>)}</div>

    {loading ? <State text="Loading…" /> : error ? <State text={error} color="#ef4444" /> : incidents.length === 0 ? <State text="No incidents in this view" /> : <div style={{ padding: '0 16px', display: 'grid', gap: 8 }}>
      {incidents.map(i => <button key={i.id} onClick={() => openIncident(i)} style={{ background: 'var(--surface-raised)', borderRadius: 12, padding: 12, border: `0.5px solid ${i.riddorStatus === 'reportable' && i.status !== 'closed' ? '#f59e0b55' : 'rgba(255,255,255,0.07)'}`, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${SEVERITY_COLOR[i.severity]}22`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><IcAlert size={18} color={SEVERITY_COLOR[i.severity]} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><span style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span><Badge text={STATUS_LABEL[i.status]} color={STATUS_COLOR[i.status]} /></div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}><span style={{ fontFamily: SF, fontSize: 10, fontWeight: 800, color: SEVERITY_COLOR[i.severity], textTransform: 'uppercase' }}>{i.severity.replace('_', ' ')}</span><span style={{ color: 'var(--t3)' }}>·</span><span style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)' }}>{TYPE_LABEL[i.type]}</span>{i.riddorStatus !== 'not_assessed' && <Badge text={RIDDOR_LABEL[i.riddorStatus]} color="#f59e0b" />}</div><div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{i.project?.name || 'No project'} · {new Date(i.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>
      </button>)}
    </div>}
    <TabBar />

    {showAdd && <Modal onClose={() => setShowAdd(false)}>
      <Header title="Log safety incident" onClose={() => setShowAdd(false)} />
      <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title — what happened?" style={inputStyle} />
      <Field label="Type"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{TYPES.map(t => <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))} style={selectBtn(form.type === t, '#ef4444')}>{TYPE_LABEL[t]}</button>)}</div></Field>
      <Field label="Severity"><div style={{ display: 'flex', gap: 4 }}>{SEVERITIES.map(s => <button key={s} type="button" onClick={() => setForm(p => ({ ...p, severity: s }))} style={{ ...selectBtn(form.severity === s, SEVERITY_COLOR[s]), flex: 1 }}>{s.replace('_', ' ')}</button>)}</div></Field>
      <Field label="Project"><select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={inputStyle}><option value="">— No project —</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location" style={inputStyle} /><input value={form.injuredParty} onChange={e => setForm(p => ({ ...p, injuredParty: e.target.value }))} placeholder="Injured party" style={inputStyle} /></div>
      <Field label="Occurred at"><input type="datetime-local" value={form.occurredAt} onChange={e => setForm(p => ({ ...p, occurredAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} /></Field>
      <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What happened?" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
      {riddorReviewSuggested && <div style={infoBox('#f59e0b')}>This incident needs a RIDDOR assessment. The app does not automatically decide legal reportability.</div>}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...infoBox('#f59e0b') }}><input type="checkbox" checked={form.riddorReportable} onChange={e => setForm(p => ({ ...p, riddorReportable: e.target.checked }))} /><span>Mark as already assessed reportable</span></label>
      <button onClick={create} disabled={saving || !form.title.trim()} style={{ ...primaryBtn('#ef4444'), width: '100%', justifyContent: 'center', opacity: saving || !form.title.trim() ? 0.5 : 1 }}>{saving ? 'Saving…' : <><IcCheck size={15} color="#fff" /> Log incident</>}</button>
    </Modal>}

    {active && <Modal onClose={() => setActive(null)}>
      <Header title={active.title} subtitle={`${TYPE_LABEL[active.type]} · ${new Date(active.occurredAt).toLocaleString('en-GB')}`} onClose={() => setActive(null)} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge text={active.severity.replace('_', ' ')} color={SEVERITY_COLOR[active.severity]} /><Badge text={STATUS_LABEL[active.status]} color={STATUS_COLOR[active.status]} /><Badge text={RIDDOR_LABEL[active.riddorStatus]} color="#f59e0b" /></div>
      {detailLoading ? <State text="Loading incident…" /> : <>
        {active.description && <p style={{ fontFamily: SF, fontSize: 13, color: 'var(--t1)', lineHeight: 1.5 }}>{active.description}</p>}
        <div style={cardStyle}>{active.project && <DetailRow label="Project" value={active.project.name} />}{active.location && <DetailRow label="Location" value={active.location} />}{active.reportedBy && <DetailRow label="Reported by" value={active.reportedBy} />}{active.injuredParty && <DetailRow label="Injured party" value={active.injuredParty} />}{active.closedAt && <DetailRow label="Closed" value={new Date(active.closedAt).toLocaleString('en-GB')} />}</div>

        <SectionTitle text="Investigation" />
        <Field label="Investigator"><input value={investigationForm.investigatorName} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, investigatorName: e.target.value }))} style={inputStyle} /></Field>
        <Field label="Immediate actions"><textarea rows={2} value={investigationForm.immediateActions} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, immediateActions: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <Field label="Investigation summary"><textarea rows={3} value={investigationForm.investigationSummary} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, investigationSummary: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <Field label="Root cause"><textarea rows={2} value={investigationForm.rootCause} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, rootCause: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <Field label="Lessons learned"><textarea rows={2} value={investigationForm.lessonsLearned} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, lessonsLearned: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Field label="Witnesses (one per line)"><textarea rows={3} value={investigationForm.witnesses} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, witnesses: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field><Field label="Evidence URLs (one per line)"><textarea rows={3} value={investigationForm.evidence} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, evidence: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div>

        <SectionTitle text="RIDDOR assessment" />
        {active.riddorReviewRequired && active.riddorStatus === 'not_assessed' && <div style={infoBox('#f59e0b')}>Review required. Determine reportability from the incident facts and HSE criteria.</div>}
        <Field label="Decision"><select value={investigationForm.riddorStatus} disabled={active.riddorStatus === 'submitted' || active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, riddorStatus: e.target.value as RiddorStatus }))} style={inputStyle}><option value="not_assessed">Not assessed</option><option value="not_reportable">Not reportable</option><option value="reportable">Reportable — not yet submitted</option><option value="submitted">Submitted to HSE</option></select></Field>
        <Field label="Decision reason"><textarea rows={2} value={investigationForm.riddorDecisionReason} disabled={active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, riddorDecisionReason: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        {investigationForm.riddorStatus === 'submitted' && <Field label="HSE / RIDDOR reference"><input value={investigationForm.riddorReference} disabled={active.riddorStatus === 'submitted' || active.status === 'closed'} onChange={e => setInvestigationForm(p => ({ ...p, riddorReference: e.target.value }))} style={inputStyle} /></Field>}
        {active.riddorSubmittedAt && <DetailRow label="Submitted" value={new Date(active.riddorSubmittedAt).toLocaleString('en-GB')} />}
        {active.status !== 'closed' && <button onClick={saveInvestigation} disabled={saving} style={{ ...primaryBtn('#3b82f6'), width: '100%', justifyContent: 'center' }}>{saving ? 'Saving…' : 'Save investigation'}</button>}

        <SectionTitle text="Corrective actions" />
        <div style={{ display: 'grid', gap: 7 }}>{(active.correctiveActions || []).length === 0 ? <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)' }}>No corrective actions recorded.</div> : active.correctiveActions!.map(action => <div key={action.id} style={cardStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div><div style={{ fontFamily: SF, fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>{action.title}</div><div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>{action.ownerName || 'Unassigned'}{action.dueDate ? ` · due ${new Date(action.dueDate).toLocaleDateString('en-GB')}` : ''}</div></div><Badge text={action.status.replace('_', ' ')} color={action.status === 'complete' ? '#10b981' : action.status === 'in_progress' ? '#f59e0b' : '#ef4444'} /></div>{action.description && <div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', marginTop: 6 }}>{action.description}</div>}{active.status !== 'closed' && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>{action.status === 'open' && <button onClick={() => updateCorrectiveAction(action, 'in_progress')} style={miniBtn('#f59e0b')}>Start</button>}{action.status !== 'complete' && <button onClick={() => updateCorrectiveAction(action, 'complete')} style={miniBtn('#10b981')}>Complete</button>}</div>}</div>)}</div>
        {active.status !== 'closed' && <div style={{ ...cardStyle, display: 'grid', gap: 7 }}><input value={actionForm.title} onChange={e => setActionForm(p => ({ ...p, title: e.target.value }))} placeholder="Corrective action" style={inputStyle} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><input value={actionForm.ownerName} onChange={e => setActionForm(p => ({ ...p, ownerName: e.target.value }))} placeholder="Owner" style={inputStyle} /><input type="date" value={actionForm.dueDate} onChange={e => setActionForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} /></div><textarea rows={2} value={actionForm.description} onChange={e => setActionForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ ...inputStyle, resize: 'vertical' }} /><button onClick={addCorrectiveAction} disabled={!actionForm.title.trim() || saving} style={{ ...primaryBtn('#f59e0b'), width: '100%', justifyContent: 'center' }}><IcPlus size={12} color="#fff" /> Add action</button></div>}

        <SectionTitle text="Closeout" />
        {active.closeout?.ready ? <div style={infoBox('#10b981')}>Ready for closeout. Investigation, corrective actions and RIDDOR decision are complete.</div> : <div style={infoBox('#f59e0b')}>Still required: {(active.closeout?.missing || []).map(k => CLOSEOUT_LABEL[k] || k).join(', ') || 'Save the investigation to refresh readiness.'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}>{active.status === 'open' && <button onClick={() => changeStatus(active, 'investigating')} style={statusBtn('#f59e0b')}>Start investigation</button>}{active.status !== 'closed' && <button onClick={() => changeStatus(active, 'closed')} style={statusBtn('#10b981')}>Close incident</button>}{active.status === 'closed' && <button onClick={() => changeStatus(active, 'open')} style={statusBtn('var(--t3)')}>Reopen</button>}</div>
        {active.closeoutVerifiedBy && <DetailRow label="Closeout verified by" value={active.closeoutVerifiedBy} />}

        {active.status !== 'closed' && active.riddorStatus !== 'submitted' && <button onClick={() => remove(active.id)} style={{ ...statusBtn('#ef4444'), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><IcTrash size={12} color="#ef4444" />{confirmDelete === active.id ? 'Confirm delete' : 'Delete incident'}</button>}
      </>}
    </Modal>}
  </div>
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}><div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(4px)' }} /><div className="module-sheet" style={{ position: 'relative', background: 'var(--surface-raised)', borderRadius: '20px 20px 0 0', padding: '22px 20px 38px', display: 'grid', gap: 11, maxHeight: '92dvh', overflowY: 'auto' }}>{children}</div></div> }
function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><div><h2 style={{ fontFamily: SF, fontSize: 19, color: 'var(--t1)' }}>{title}</h2>{subtitle && <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{subtitle}</div>}</div><button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><IcX size={19} color="var(--t2)" /></button></div> }
function KPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) { return <div style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{icon}<span style={{ fontFamily: SF, fontSize: 9, color: 'var(--t2)', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span></div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, color, fontWeight: 800, marginTop: 2 }}>{value}</div></div> }
function DetailRow({ label, value }: { label: string; value: string }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: SF, fontSize: 11 }}><span style={{ color: 'var(--t2)' }}>{label}</span><span style={{ color: 'var(--t1)', textAlign: 'right' }}>{value}</span></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: 'grid', gap: 5 }}><span style={{ fontFamily: SF, fontSize: 9, color: 'var(--t3)', fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>{children}</label> }
function SectionTitle({ text }: { text: string }) { return <div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 }}>{text}</div> }
function Badge({ text, color }: { text: string; color: string }) { return <span style={{ display: 'inline-block', padding: '3px 7px', borderRadius: 99, background: color + '22', color, fontFamily: SF, fontSize: 8, fontWeight: 900, textTransform: 'uppercase' }}>{text}</span> }
function State({ text, color = 'var(--t3)' }: { text: string; color?: string }) { return <div style={{ padding: 40, textAlign: 'center', color, fontFamily: SF, fontSize: 13 }}>{text}</div> }
function chipBtn(active: boolean): React.CSSProperties { return { padding: '6px 12px', borderRadius: 99, background: active ? 'var(--surface-raised)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${active ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`, color: active ? 'var(--t1)' : 'var(--t3)', fontFamily: SF, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 } }
function selectBtn(active: boolean, color: string): React.CSSProperties { return { padding: '7px 9px', borderRadius: 8, background: active ? color + '22' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${active ? color : 'rgba(255,255,255,0.10)'}`, color: active ? color : 'var(--t2)', fontFamily: SF, fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' } }
function primaryBtn(color: string): React.CSSProperties { return { border: 0, borderRadius: 10, padding: '10px 12px', background: color, color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 } }
function statusBtn(color: string): React.CSSProperties { return { padding: '10px', borderRadius: 10, background: color + '22', border: `0.5px solid ${color}66`, color, fontFamily: SF, fontSize: 11, fontWeight: 800, cursor: 'pointer' } }
function miniBtn(color: string): React.CSSProperties { return { padding: '5px 7px', borderRadius: 7, border: `1px solid ${color}44`, background: color + '15', color, fontFamily: SF, fontSize: 9, fontWeight: 800, cursor: 'pointer' } }
function infoBox(color: string): React.CSSProperties { return { padding: '9px 10px', borderRadius: 9, background: color + '12', border: `1px solid ${color}33`, color, fontFamily: SF, fontSize: 10, lineHeight: 1.4 } }
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.035)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, display: 'grid', gap: 5 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: 'var(--t1)', padding: '9px 10px', fontFamily: SF, fontSize: 12, outline: 'none' }

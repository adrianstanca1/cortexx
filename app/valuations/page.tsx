'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcArrowRight, IcCheck, IcChevL, IcPlus, IcPound, IcTrash, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type Status = 'draft' | 'submitted' | 'certified' | 'paid' | 'rejected'
type Project = { id: string; name: string; clientName: string; budget: number; progress: number }
type Variation = { id: string; number: string; title: string; costImpact: number; status: string }
type Payment = { id: string; amount: number; paidAt: string; reference: string | null; method: string | null }
type Certificate = {
  id: string; revision: number; certificateNumber: string; certifiedGrossToDate: number; retentionPct: number; retentionAmount: number
  previousCertified: number; retentionRelease: number; amountCertified: number; status: string; dueDate: string | null; issuedAt: string; notes: string | null; payments: Payment[]
}
type VariationLink = { id: string; amountIncluded: number; variation: Variation }
type Valuation = {
  id: string
  projectId: string
  applicationNumber: number
  periodEnd: string
  grossToDate: number
  retentionPct: number
  retentionAmount: number
  previousCertified: number
  netDue: number
  status: Status
  notes: string | null
  submittedAt: string | null
  certifiedAt: string | null
  paidAt: string | null
  project: Project
  certificates: Certificate[]
  variationLinks: VariationLink[]
}
type Totals = { grossToDate: number; retention: number; netDue: number; outstanding: number; certified: number; paid: number }

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<Status, string> = {
  draft: '#8ea8c5',
  submitted: '#3b82f6',
  certified: '#f59e0b',
  paid: '#10b981',
  rejected: '#ef4444',
}
const NEXT: Partial<Record<Status, Status>> = {
  draft: 'submitted',
  submitted: 'certified',
  certified: 'paid',
}
const NEXT_LABEL: Partial<Record<Status, string>> = {
  draft: 'Submit',
  submitted: 'Certify',
  certified: 'Pay in full',
}

function money(value: number) {
  return value.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
}

function currentCertificate(v: Valuation): Certificate | undefined {
  return v.certificates?.find(c => c.status === 'issued')
}

function certificateBalance(c?: Certificate) {
  if (!c) return { paid: 0, outstanding: 0 }
  const paid = (c.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  return { paid, outstanding: Math.max(0, c.amountCertified - paid) }
}

export default function ValuationsPage() {
  const [valuations, setValuations] = useState<Valuation[]>([])
  const [totals, setTotals] = useState<Totals>({ grossToDate: 0, retention: 0, netDue: 0, outstanding: 0, certified: 0, paid: 0 })
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<Valuation | null>(null)
  const [revisionTarget, setRevisionTarget] = useState<Valuation | null>(null)
  const [availableVariations, setAvailableVariations] = useState<Variation[]>([])
  const [variationAmounts, setVariationAmounts] = useState<Record<string, string>>({})
  const [paymentForm, setPaymentForm] = useState({ amount: '', paidAt: new Date().toISOString().slice(0, 10), reference: '', method: 'Bank transfer' })
  const [revisionForm, setRevisionForm] = useState({ certifiedGrossToDate: '', retentionPct: '3', retentionRelease: '0', dueDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({ projectId: '', grossToDate: '', retentionPct: '3', periodEnd: new Date().toISOString().slice(0, 10), notes: '' })

  useModalEffects(showAdd, () => setShowAdd(false))
  useModalEffects(!!paymentTarget, () => setPaymentTarget(null))
  useModalEffects(!!revisionTarget, () => setRevisionTarget(null))

  const load = useCallback(async () => {
    try {
      const [vr, pr] = await Promise.all([
        fetch('/api/valuations'),
        fetch('/api/projects?limit=100'),
      ])
      if (!vr.ok) throw new Error('Failed to load valuations')
      const v = await vr.json()
      const p = pr.ok ? await pr.json() : { projects: [] }
      setValuations(v.valuations || [])
      setTotals(v.totals || { grossToDate: 0, retention: 0, netDue: 0, outstanding: 0, certified: 0, paid: 0 })
      const list = (p.projects || p || []).map((x: Project) => ({
        id: x.id, name: x.name, clientName: x.clientName || '', budget: Number(x.budget) || 0, progress: Number(x.progress) || 0,
      }))
      setProjects(list)
      if (list.length) {
        setForm(prev => {
          if (prev.projectId) return prev
          const first = list[0]
          return { ...prev, projectId: first.id, grossToDate: (first.budget * first.progress / 100).toFixed(2) }
        })
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to load valuations', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!form.projectId) { setAvailableVariations([]); return }
    let cancelled = false
    fetch('/api/variations?projectId=' + encodeURIComponent(form.projectId) + '&take=100')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load variations')))
      .then(data => {
        if (cancelled) return
        setAvailableVariations((data.variations || []).filter((v: Variation) => v.status === 'submitted' || v.status === 'approved'))
      })
      .catch(() => { if (!cancelled) setAvailableVariations([]) })
    return () => { cancelled = true }
  }, [form.projectId])

  const filtered = useMemo(() => filter === 'all' ? valuations : valuations.filter(v => v.status === filter), [filter, valuations])

  const chooseProject = (projectId: string) => {
    const p = projects.find(x => x.id === projectId)
    setForm(prev => ({
      ...prev,
      projectId,
      grossToDate: p ? (p.budget * p.progress / 100).toFixed(2) : '',
    }))
    setVariationAmounts({})
  }

  const create = async () => {
    if (!form.projectId || !form.grossToDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: form.projectId,
          grossToDate: Number(form.grossToDate),
          retentionPct: Number(form.retentionPct),
          periodEnd: form.periodEnd,
          notes: form.notes.trim() || null,
          variationLinks: Object.entries(variationAmounts).map(([variationId, amountIncluded]) => ({ variationId, amountIncluded: Number(amountIncluded) })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to create valuation')
      setShowAdd(false)
      setForm(prev => ({ ...prev, notes: '' }))
      setVariationAmounts({})
      setToast({ msg: 'Valuation draft created' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const transition = async (valuation: Valuation, status: Status) => {
    try {
      const res = await fetch('/api/valuations/' + valuation.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Status update failed')
      setToast({ msg: 'Valuation marked ' + status })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Status update failed', type: 'error' })
    }
  }

  const openPayment = (valuation: Valuation) => {
    const cert = currentCertificate(valuation)
    const balance = certificateBalance(cert)
    setPaymentTarget(valuation)
    setPaymentForm({ amount: balance.outstanding.toFixed(2), paidAt: new Date().toISOString().slice(0, 10), reference: '', method: 'Bank transfer' })
  }

  const recordPayment = async () => {
    if (!paymentTarget || !paymentForm.amount) return
    setSaving(true)
    try {
      const res = await fetch('/api/valuations/' + paymentTarget.id + '/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(paymentForm.amount), paidAt: paymentForm.paidAt, reference: paymentForm.reference, method: paymentForm.method }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Payment failed')
      setPaymentTarget(null)
      setToast({ msg: json?.summary?.settled ? 'Certificate fully paid' : 'Partial payment recorded' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Payment failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const openRevision = (valuation: Valuation) => {
    const cert = currentCertificate(valuation)
    if (!cert) return
    setRevisionTarget(valuation)
    setRevisionForm({
      certifiedGrossToDate: String(cert.certifiedGrossToDate), retentionPct: String(cert.retentionPct),
      retentionRelease: String(cert.retentionRelease || 0), dueDate: cert.dueDate ? cert.dueDate.slice(0, 10) : '', notes: cert.notes || '',
    })
  }

  const reviseCertificate = async () => {
    if (!revisionTarget || !revisionForm.certifiedGrossToDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/valuations/' + revisionTarget.id + '/certificates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certifiedGrossToDate: Number(revisionForm.certifiedGrossToDate), retentionPct: Number(revisionForm.retentionPct),
          retentionRelease: Number(revisionForm.retentionRelease), dueDate: revisionForm.dueDate || null, notes: revisionForm.notes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Certificate revision failed')
      setRevisionTarget(null)
      setToast({ msg: 'Certificate revision issued' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Certificate revision failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const remove = async (valuation: Valuation) => {
    if (confirmDelete !== valuation.id) {
      setConfirmDelete(valuation.id)
      setTimeout(() => setConfirmDelete(id => id === valuation.id ? null : id), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch('/api/valuations/' + valuation.id, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Delete failed')
      setToast({ msg: 'Draft deleted' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Delete failed', type: 'error' })
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: '#eef3fa' }}>Valuations</h1>
            <p style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>Interim applications → certification → payment</p>
          </div>
          <a href={'/api/valuations/export' + (filter === 'all' ? '' : '?status=' + filter)} style={{ color: '#93c5fd', fontSize: 13, whiteSpace: 'nowrap' }}>Export CSV</a>
          <button type="button" onClick={() => setShowAdd(true)} disabled={!projects.length} aria-label="Create valuation" style={{ width: 38, height: 38, borderRadius: 11, border: 'none', background: '#10b981', cursor: projects.length ? 'pointer' : 'not-allowed', opacity: projects.length ? 1 : 0.45, display: 'grid', placeItems: 'center' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        <Kpi label="Outstanding" value={money(totals.outstanding)} color="#3b82f6" />
        <Kpi label="Certified" value={money(totals.certified)} color="#f59e0b" />
        <Kpi label="Paid" value={money(totals.paid)} color="#10b981" />
        <Kpi label="Retention held" value={money(totals.retention)} color="#f59e0b" />
        <Kpi label="Current gross" value={money(totals.grossToDate)} color="#eef3fa" />
        <Kpi label="Applications" value={String(valuations.length)} color="#eef3fa" />
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 16px 4px' }}>
        {(['all', 'draft', 'submitted', 'certified', 'paid', 'rejected'] as const).map(s => (
          <button key={s} type="button" onClick={() => setFilter(s)} style={{ flexShrink: 0, padding: '5px 11px', borderRadius: 99, border: 'none', background: filter === s ? '#2563eb' : 'rgba(255,255,255,0.06)', color: filter === s ? '#fff' : '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '64px 32px', textAlign: 'center' }}>
          <IcPound size={34} color="#52749a" />
          <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700, color: '#eef3fa', marginTop: 12 }}>No valuations in this view</div>
          <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 5 }}>Create the first interim application from a live project value.</div>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(v => (
            <div key={v.id} style={{ background: '#152641', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.08)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 800, color: '#52749a' }}>VAL-{String(v.applicationNumber).padStart(3, '0')}</div>
                  <Link href={'/projects/' + v.projectId} style={{ textDecoration: 'none' }}>
                    <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 700, color: '#eef3fa', marginTop: 2 }}>{v.project.name}</div>
                  </Link>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 2 }}>{v.project.clientName || 'No client'} · period {new Date(v.periodEnd).toLocaleDateString('en-GB')}</div>
                </div>
                <span style={{ flexShrink: 0, alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 99, background: STATUS_COLOR[v.status] + '22', color: STATUS_COLOR[v.status], border: '1px solid ' + STATUS_COLOR[v.status] + '55', fontFamily: SF, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>{v.status}</span>
              </div>

              <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.025)', borderRadius: 10, padding: 10, display: 'grid', gap: 5 }}>
                <MoneyRow label="Gross value to date" value={v.grossToDate} />
                <MoneyRow label={'Retention (' + v.retentionPct + '%)'} value={-v.retentionAmount} muted />
                <MoneyRow label="Previous certified" value={-v.previousCertified} muted />
                <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 2 }}>
                  <MoneyRow label="Net due this application" value={v.netDue} strong />
                </div>
              </div>
              {v.variationLinks?.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(59,130,246,0.07)' }}>
                  <div style={{ fontFamily: SF, fontSize: 9, fontWeight: 800, color: '#52749a', textTransform: 'uppercase', marginBottom: 5 }}>Included variations</div>
                  {v.variationLinks.map(link => <div key={link.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: SF, fontSize: 10, color: '#8ea8c5', marginTop: 3 }}>
                    <span>{link.variation.number} · {link.variation.title}</span><strong style={{ color: '#eef3fa' }}>{money(link.amountIncluded)}</strong>
                  </div>)}
                </div>
              )}
              <CertificatePanel valuation={v} onPayment={() => openPayment(v)} onRevise={() => openRevision(v)} />
              {v.notes && <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 8 }}>{v.notes}</div>}

              <div style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
                {(v.status === 'draft' || v.status === 'rejected') && (
                  <button type="button" onClick={() => remove(v)} style={{ background: confirmDelete === v.id ? 'rgba(239,68,68,0.16)' : 'transparent', color: '#ef4444', border: 'none', borderRadius: 8, padding: '7px 9px', fontFamily: SF, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IcTrash size={11} color="#ef4444" /> {confirmDelete === v.id ? 'Confirm' : 'Delete'}
                  </button>
                )}
                {v.status === 'submitted' && (
                  <button type="button" onClick={() => transition(v, 'rejected')} style={minorBtn('#ef4444')}>Reject</button>
                )}
                {v.status === 'rejected' && (
                  <button type="button" onClick={() => transition(v, 'draft')} style={minorBtn('#8ea8c5')}>Return to draft</button>
                )}
                {NEXT[v.status] && (
                  <button type="button" onClick={() => transition(v, NEXT[v.status] as Status)} style={{ background: STATUS_COLOR[NEXT[v.status] as Status], color: '#fff', border: 'none', borderRadius: 9, padding: '7px 11px', fontFamily: SF, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IcCheck size={11} color="#fff" /> {NEXT_LABEL[v.status]} <IcArrowRight size={11} color="#fff" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '22px 20px 36px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: SF, fontSize: 19, color: '#eef3fa' }}>New valuation</h2>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Close" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><IcX size={19} color="#8ea8c5" /></button>
            </div>
            <Field label="Project">
              <select value={form.projectId} onChange={e => chooseProject(e.target.value)} style={inputStyle}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name} · {p.progress}%</option>)}
              </select>
            </Field>
            <Field label="Gross value to date (£)">
              <input type="number" min="0" step="0.01" value={form.grossToDate} onChange={e => setForm(p => ({ ...p, grossToDate: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Retention (%)">
              <input type="number" min="0" max="20" step="0.5" value={form.retentionPct} onChange={e => setForm(p => ({ ...p, retentionPct: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Period end">
              <input type="date" value={form.periodEnd} onChange={e => setForm(p => ({ ...p, periodEnd: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </Field>
            {availableVariations.length > 0 && (
              <Field label="Submitted / approved variations">
                <div style={{ display: 'grid', gap: 7 }}>
                  {availableVariations.map(variation => {
                    const checked = Object.prototype.hasOwnProperty.call(variationAmounts, variation.id)
                    return <div key={variation.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 110px', gap: 8, alignItems: 'center', padding: 8, borderRadius: 9, background: 'rgba(255,255,255,0.035)' }}>
                      <input type="checkbox" checked={checked} onChange={e => setVariationAmounts(prev => {
                        const next = { ...prev }; if (e.target.checked) next[variation.id] = String(variation.costImpact); else delete next[variation.id]; return next
                      })} />
                      <div><div style={{ fontFamily: SF, fontSize: 11, color: '#eef3fa', fontWeight: 700 }}>{variation.number} · {variation.title}</div><div style={{ fontFamily: SF, fontSize: 9, color: '#52749a' }}>{variation.status} · {money(variation.costImpact)}</div></div>
                      <input type="number" step="0.01" disabled={!checked} value={checked ? variationAmounts[variation.id] : ''} onChange={e => setVariationAmounts(prev => ({ ...prev, [variation.id]: e.target.value }))} style={{ ...inputStyle, padding: '7px 8px', opacity: checked ? 1 : 0.4 }} aria-label={'Amount included for ' + variation.number} />
                    </div>
                  })}
                </div>
              </Field>
            )}
            <Field label="Notes">
              <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Application notes, exclusions or commercial context" />
            </Field>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(16,185,129,0.08)', fontFamily: SF, fontSize: 11, color: '#8ea8c5', lineHeight: 1.45 }}>
              Previous certified value is calculated from certified/paid applications only. Drafts do not affect later applications.
            </div>
            <button type="button" onClick={create} disabled={saving || !form.projectId || !form.grossToDate} style={{ padding: 13, borderRadius: 12, border: 0, background: '#10b981', color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Creating...' : 'Create draft application'}
            </button>
          </div>
        </div>
      )}

      {paymentTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setPaymentTarget(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '22px 20px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h2 style={{ fontFamily: SF, fontSize: 19, color: '#eef3fa' }}>Record payment</h2><div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 3 }}>{currentCertificate(paymentTarget)?.certificateNumber}</div></div>
              <button type="button" onClick={() => setPaymentTarget(null)} aria-label="Close" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><IcX size={19} color="#8ea8c5" /></button>
            </div>
            <Field label="Amount (£)"><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Payment date"><input type="date" value={paymentForm.paidAt} onChange={e => setPaymentForm(p => ({ ...p, paidAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} /></Field>
            <Field label="Reference"><input value={paymentForm.reference} onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} style={inputStyle} placeholder="Bank reference / remittance" /></Field>
            <Field label="Method"><input value={paymentForm.method} onChange={e => setPaymentForm(p => ({ ...p, method: e.target.value }))} style={inputStyle} /></Field>
            <button type="button" onClick={recordPayment} disabled={saving || !paymentForm.amount} style={{ padding: 13, borderRadius: 12, border: 0, background: '#10b981', color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving...' : 'Record payment'}</button>
          </div>
        </div>
      )}

      {revisionTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setRevisionTarget(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '22px 20px 36px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h2 style={{ fontFamily: SF, fontSize: 19, color: '#eef3fa' }}>Revise certificate</h2><div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 3 }}>{currentCertificate(revisionTarget)?.certificateNumber} · creates next revision</div></div>
              <button type="button" onClick={() => setRevisionTarget(null)} aria-label="Close" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><IcX size={19} color="#8ea8c5" /></button>
            </div>
            <Field label="Certified gross to date (£)"><input type="number" min="0" step="0.01" value={revisionForm.certifiedGrossToDate} onChange={e => setRevisionForm(p => ({ ...p, certifiedGrossToDate: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Retention (%)"><input type="number" min="0" max="20" step="0.5" value={revisionForm.retentionPct} onChange={e => setRevisionForm(p => ({ ...p, retentionPct: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Retention release (£)"><input type="number" min="0" step="0.01" value={revisionForm.retentionRelease} onChange={e => setRevisionForm(p => ({ ...p, retentionRelease: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Due date"><input type="date" value={revisionForm.dueDate} onChange={e => setRevisionForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} /></Field>
            <Field label="Revision notes"><textarea rows={3} value={revisionForm.notes} onChange={e => setRevisionForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
            <button type="button" onClick={reviseCertificate} disabled={saving || !revisionForm.certifiedGrossToDate} style={{ padding: 13, borderRadius: 12, border: 0, background: '#f59e0b', color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Issuing...' : 'Issue revised certificate'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CertificatePanel({ valuation, onPayment, onRevise }: { valuation: Valuation; onPayment: () => void; onRevise: () => void }) {
  const cert = currentCertificate(valuation)
  if (!cert) return null
  const balance = certificateBalance(cert)
  return <div style={{ marginTop: 8, borderRadius: 10, border: '1px solid rgba(245,158,11,0.18)', padding: 10, background: 'rgba(245,158,11,0.055)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
      <div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 800, color: '#f59e0b' }}>{cert.certificateNumber}</div><div style={{ fontFamily: SF, fontSize: 9, color: '#52749a', marginTop: 2 }}>Issued {new Date(cert.issuedAt).toLocaleDateString('en-GB')}{cert.dueDate ? ' · due ' + new Date(cert.dueDate).toLocaleDateString('en-GB') : ''}</div></div>
      <div style={{ fontFamily: SF, fontSize: 9, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Revision {cert.revision}</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6, marginTop: 8 }}>
      <MiniMetric label="Certified" value={money(cert.amountCertified)} />
      <MiniMetric label="Paid" value={money(balance.paid)} />
      <MiniMetric label="Outstanding" value={money(balance.outstanding)} />
    </div>
    {cert.retentionRelease > 0 && <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', marginTop: 7 }}>Retention released: <strong style={{ color: '#eef3fa' }}>{money(cert.retentionRelease)}</strong></div>}
    {valuation.status === 'certified' && (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
        {balance.paid === 0 && <button type="button" onClick={onRevise} style={minorBtn('#f59e0b')}>Revise certificate</button>}
        {balance.outstanding > 0 && <button type="button" onClick={onPayment} style={minorBtn('#10b981')}>Add payment</button>}
      </div>
    )}
  </div>
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div style={{ borderRadius: 8, padding: 7, background: 'rgba(255,255,255,0.035)' }}><div style={{ fontFamily: SF, fontSize: 8, color: '#52749a', textTransform: 'uppercase', fontWeight: 800 }}>{label}</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#eef3fa', fontWeight: 800, marginTop: 2 }}>{value}</div></div>
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return <div style={{ background: '#152641', borderRadius: 12, padding: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
    <div style={{ fontFamily: SF, fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#52749a', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 800, color, marginTop: 3 }}>{value}</div>
  </div>
}

function MoneyRow({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: SF, fontSize: strong ? 13 : 11, fontWeight: strong ? 800 : 500 }}>
    <span style={{ color: muted ? '#52749a' : '#8ea8c5' }}>{label}</span>
    <span style={{ color: strong ? '#10b981' : muted ? '#8ea8c5' : '#eef3fa', fontFamily: 'ui-monospace, monospace' }}>{money(value)}</span>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 5 }}>
    <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 800, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
    {children}
  </label>
}

function minorBtn(color: string): React.CSSProperties {
  return { background: color + '18', color, border: '1px solid ' + color + '44', borderRadius: 9, padding: '7px 10px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer' }
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, color: '#eef3fa', padding: '10px 12px', fontFamily: SF, fontSize: 13, outline: 'none',
}

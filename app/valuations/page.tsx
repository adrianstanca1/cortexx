'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcArrowRight, IcCheck, IcChevL, IcPlus, IcPound, IcTrash, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type Status = 'draft' | 'submitted' | 'certified' | 'paid' | 'rejected'
type Project = { id: string; name: string; clientName: string; budget: number; progress: number }
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
}
type Totals = { grossToDate: number; retention: number; netDue: number; outstanding: number; certified: number }

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
  certified: 'Mark paid',
}

function money(value: number) {
  return value.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
}

export default function ValuationsPage() {
  const [valuations, setValuations] = useState<Valuation[]>([])
  const [totals, setTotals] = useState<Totals>({ grossToDate: 0, retention: 0, netDue: 0, outstanding: 0, certified: 0 })
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({ projectId: '', grossToDate: '', retentionPct: '3', periodEnd: new Date().toISOString().slice(0, 10), notes: '' })

  useModalEffects(showAdd, () => setShowAdd(false))

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
      setTotals(v.totals || { grossToDate: 0, retention: 0, netDue: 0, outstanding: 0, certified: 0 })
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

  const filtered = useMemo(() => filter === 'all' ? valuations : valuations.filter(v => v.status === filter), [filter, valuations])

  const chooseProject = (projectId: string) => {
    const p = projects.find(x => x.id === projectId)
    setForm(prev => ({
      ...prev,
      projectId,
      grossToDate: p ? (p.budget * p.progress / 100).toFixed(2) : '',
    }))
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
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to create valuation')
      setShowAdd(false)
      setForm(prev => ({ ...prev, notes: '' }))
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
          <button type="button" onClick={() => setShowAdd(true)} disabled={!projects.length} aria-label="Create valuation" style={{ width: 38, height: 38, borderRadius: 11, border: 'none', background: '#10b981', cursor: projects.length ? 'pointer' : 'not-allowed', opacity: projects.length ? 1 : 0.45, display: 'grid', placeItems: 'center' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
        <Kpi label="Outstanding" value={money(totals.outstanding)} color="#3b82f6" />
        <Kpi label="Certified / paid" value={money(totals.certified)} color="#10b981" />
        <Kpi label="Retention held" value={money(totals.retention)} color="#f59e0b" />
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
              {v.notes && <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 8 }}>{v.notes}</div>}

              <div style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
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
    </div>
  )
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

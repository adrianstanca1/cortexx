'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcDoc, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcPound } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Subcontractor { id: string; name: string; trade: string | null; cisStatus: 'gross' | '20' | '30' }
interface Project { id: string; name: string }
interface SubInvoice {
  id: string
  number: string
  subcontractorId: string
  projectId: string | null
  invoiceDate: string
  description: string | null
  netAmount: number
  vatAmount: number
  cisAmount: number
  grossAmount: number
  payableAmount: number
  status: 'received' | 'approved' | 'paid' | 'disputed'
  paidAt: string | null
  notes: string | null
  subcontractor?: Subcontractor
  project?: Project | null
}

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<SubInvoice['status'], string> = { received: '#52749a', approved: '#f59e0b', paid: '#22c55e', disputed: '#ef4444' }
const STATUS_LABEL: Record<SubInvoice['status'], string> = { received: 'Received', approved: 'Approved', paid: 'Paid', disputed: 'Disputed' }

const CIS_RATE: Record<string, number> = { gross: 0, '20': 0.20, '30': 0.30 }

export default function SubInvoicesPage() {
  const [invoices, setInvoices] = useState<SubInvoice[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingPayable, setPendingPayable] = useState(0)
  const [pendingCisHeld, setPendingCisHeld] = useState(0)
  const [subs, setSubs] = useState<Subcontractor[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | SubInvoice['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeInv, setActiveInv] = useState<SubInvoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({ subcontractorId: '', projectId: '', number: '', invoiceDate: new Date().toISOString().slice(0, 10), description: '', netAmount: '', vatRate: '20' })

  useModalEffects(showAdd || activeInv !== null, () => { setShowAdd(false); setActiveInv(null) })

  const load = useCallback(() => {
    fetch('/api/sub-invoices')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setInvoices(d.invoices || []); setPendingCount(d.pendingCount || 0); setPendingPayable(d.pendingPayable || 0); setPendingCisHeld(d.pendingCisHeld || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/subs').then(r => r.ok ? r.json() : null).then(d => {
      const ss: Subcontractor[] = (d?.subs || []).map((s: Subcontractor) => ({ id: s.id, name: s.name, trade: s.trade, cisStatus: s.cisStatus }))
      setSubs(ss)
      setForm(prev => prev.subcontractorId ? prev : { ...prev, subcontractorId: ss[0]?.id || '' })
    }).catch(() => {})
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      setProjects((d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const selectedSub = subs.find(s => s.id === form.subcontractorId)
  const totals = (() => {
    const net = Number(form.netAmount) || 0
    const vat = net * ((Number(form.vatRate) || 0) / 100)
    const cisR = selectedSub ? CIS_RATE[selectedSub.cisStatus] : 0
    const cis = net * cisR
    const gross = net + vat
    return { net, vat, cis, gross, payable: gross - cis }
  })()

  const create = async () => {
    if (!form.subcontractorId || !form.number.trim() || !form.netAmount) return
    setSaving(true)
    try {
      const res = await fetch('/api/sub-invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcontractorId: form.subcontractorId,
          projectId: form.projectId || null,
          number: form.number.trim(),
          invoiceDate: form.invoiceDate,
          description: form.description.trim() || null,
          netAmount: Number(form.netAmount),
          vatRate: Number(form.vatRate),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, number: '', description: '', netAmount: '' }))
      load()
      setToast({ msg: 'Invoice recorded' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const changeStatus = async (inv: SubInvoice, next: SubInvoice['status']) => {
    try {
      const res = await fetch(`/api/sub-invoices/${inv.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activeInv?.id === inv.id) setActiveInv(updated)
      load()
    } catch { setToast({ msg: 'Status change failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id); setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000); return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/sub-invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveInv(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  const exportCsv = () => {
    const head = 'Number,Date,Subcontractor,Trade,CIS,Project,Net,VAT,CIS held,Gross,Payable,Status'
    const rows = invoices.map(i => [
      i.number, i.invoiceDate.slice(0, 10),
      `"${(i.subcontractor?.name || '').replace(/"/g, '""')}"`,
      i.subcontractor?.trade || '',
      i.subcontractor?.cisStatus || '',
      `"${(i.project?.name || '').replace(/"/g, '""')}"`,
      i.netAmount.toFixed(2), i.vatAmount.toFixed(2), i.cisAmount.toFixed(2),
      i.grossAmount.toFixed(2), i.payableAmount.toFixed(2), i.status,
    ].join(','))
    const blob = new Blob([head + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sub-invoices-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Sub invoices</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{invoices.length} total · {pendingCount} pending</p>
          </div>
          <button onClick={() => setShowAdd(true)} disabled={subs.length === 0} aria-label="Record invoice" style={{ width: 36, height: 36, borderRadius: 10, background: subs.length === 0 ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: subs.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        {(pendingPayable > 0 || pendingCisHeld > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending payable</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, color: '#f59e0b', fontWeight: 700 }}>£{pendingPayable.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '0.5px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>CIS held</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, color: '#3b82f6', fontWeight: 700 }}>£{pendingCisHeld.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center', paddingBottom: 2 }}>
          {(['all', 'received', 'approved', 'paid', 'disputed'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
            </button>
          ))}
          {invoices.length > 0 && (
            <button onClick={exportCsv} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 99, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>CSV</button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcDoc size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{invoices.length === 0 ? 'No sub invoices' : 'Nothing in this filter'}</p>
          {invoices.length === 0 && subs.length === 0 && (
            <Link href="/subs" style={{ display: 'inline-block', marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#2563eb', textDecoration: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>Add subcontractors first</Link>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(i => (
            <button key={i.id} onClick={() => setActiveInv(i)} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 600 }}>{i.number}</span>
                  <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{i.subcontractor?.name || 'Unknown'}</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                  {new Date(i.invoiceDate).toLocaleDateString('en-GB')}
                  {i.subcontractor && <span> · CIS {i.subcontractor.cisStatus}</span>}
                  {i.project && <span> · {i.project.name}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: '#eef3fa', fontWeight: 700 }}>£{i.payableAmount.toFixed(2)}</div>
                <span style={{ display: 'inline-block', marginTop: 2, padding: '1px 7px', borderRadius: 99, background: `${STATUS_COLOR[i.status]}22`, color: STATUS_COLOR[i.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[i.status]}55`, textTransform: 'uppercase' }}>{STATUS_LABEL[i.status]}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Record sub invoice</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <div>
              <label style={labelStyle}>Subcontractor</label>
              <select value={form.subcontractorId} onChange={e => setForm(p => ({ ...p, subcontractorId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {subs.map(s => <option key={s.id} value={s.id}>{s.name} — CIS {s.cisStatus}</option>)}
              </select>
              {selectedSub && (
                <div style={{ marginTop: 4, fontFamily: SF, fontSize: 11, color: '#52749a' }}>
                  Auto-withhold: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{(CIS_RATE[selectedSub.cisStatus] * 100).toFixed(0)}%</span> of net under CIS
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="Invoice #" style={inputStyle} />
              <input type="date" value={form.invoiceDate} onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">— Project (optional) —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
              <div>
                <label style={labelStyle}>Net £</label>
                <input type="number" step="0.01" value={form.netAmount} onChange={e => setForm(p => ({ ...p, netAmount: e.target.value }))} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>VAT %</label>
                <input type="number" step="1" value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            {totals.net > 0 && (
              <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Row label="Net" value={`£${totals.net.toFixed(2)}`} muted />
                <Row label={`VAT (${form.vatRate}%)`} value={`£${totals.vat.toFixed(2)}`} muted />
                <Row label="Gross" value={`£${totals.gross.toFixed(2)}`} muted />
                <Row label={`CIS held (${selectedSub ? (CIS_RATE[selectedSub.cisStatus] * 100).toFixed(0) : 0}%)`} value={`−£${totals.cis.toFixed(2)}`} color="#3b82f6" />
                <Row label="Payable to sub" value={`£${totals.payable.toFixed(2)}`} bold />
              </div>
            )}

            <button onClick={create} disabled={saving || !form.subcontractorId || !form.number.trim() || !form.netAmount} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.subcontractorId || !form.number.trim() || !form.netAmount ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Record</>}
            </button>
          </div>
        </div>
      )}

      {activeInv && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveInv(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700 }}>{activeInv.number}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: SF, marginTop: 2 }}>{activeInv.subcontractor?.name}</h2>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {new Date(activeInv.invoiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {activeInv.subcontractor && <> · CIS {activeInv.subcontractor.cisStatus}</>}
                </div>
              </div>
              <button onClick={() => setActiveInv(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            {activeInv.description && <div style={{ background: '#1a2f4e', padding: '10px 12px', borderRadius: 10, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>{activeInv.description}</div>}

            <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Row label="Net" value={`£${activeInv.netAmount.toFixed(2)}`} muted />
              <Row label="VAT" value={`£${activeInv.vatAmount.toFixed(2)}`} muted />
              <Row label="Gross" value={`£${activeInv.grossAmount.toFixed(2)}`} muted />
              <Row label="CIS held" value={`−£${activeInv.cisAmount.toFixed(2)}`} color="#3b82f6" />
              <Row label="Payable" value={`£${activeInv.payableAmount.toFixed(2)}`} bold />
            </div>

            <a
              href={`/api/sub-invoices/${activeInv.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '10px', borderRadius: 10, background: 'rgba(139,92,246,0.13)', border: '0.5px solid rgba(139,92,246,0.4)', color: '#a78bfa', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <IcDoc size={12} color="#a78bfa" /> Download PDF
            </a>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {activeInv.status === 'received' && (
                <button onClick={() => changeStatus(activeInv, 'approved')} style={statusBtn('#f59e0b')}>Approve</button>
              )}
              {(activeInv.status === 'received' || activeInv.status === 'approved') && (
                <button onClick={() => changeStatus(activeInv, 'paid')} style={statusBtn('#22c55e')}>Mark paid</button>
              )}
              {activeInv.status !== 'disputed' && activeInv.status !== 'paid' && (
                <button onClick={() => changeStatus(activeInv, 'disputed')} style={statusBtn('#ef4444')}>Dispute</button>
              )}
              {activeInv.status === 'paid' && (
                <button onClick={() => changeStatus(activeInv, 'approved')} style={statusBtn('#52749a')}>Unmark paid</button>
              )}
              {activeInv.status === 'disputed' && (
                <button onClick={() => changeStatus(activeInv, 'received')} style={statusBtn('#52749a')}>Resolve</button>
              )}
            </div>

            <button onClick={() => remove(activeInv.id)} style={{ padding: '10px', borderRadius: 10, background: confirmDelete === activeInv.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeInv.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" /> {confirmDelete === activeInv.id ? 'Sure?' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold, muted, color }: { label: string; value: string; bold?: boolean; muted?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: bold ? 15 : 13, color: color || (bold ? '#eef3fa' : muted ? '#8ea8c5' : '#eef3fa'), fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>{value}</span>
    </div>
  )
}

const statusBtn = (color: string): React.CSSProperties => ({
  padding: '10px', borderRadius: 10, background: `${color}22`, border: `0.5px solid ${color}66`, color, fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})
const labelStyle: React.CSSProperties = { fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box' }

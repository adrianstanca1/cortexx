'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcCamera, IcCheck, IcChevL, IcReceipt, IcSpark, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type ReceiptStatus = 'pending' | 'extracted' | 'needs_review' | 'approved' | 'reconciled'
type CostCode = { id: string; code: string; name: string }
type Receipt = {
  id: string
  vendor: string | null
  receiptDate: string | null
  subtotal: number | null
  vatAmount: number | null
  totalAmount: number | null
  currency: string
  category: string | null
  costCodeId?: string | null
  costCode?: CostCode | null
  confidence: number | null
  notes: string | null
  status: ReceiptStatus
  capturedAt: string | null
  latitude: number | null
  longitude: number | null
  accuracyM: number | null
  project: { id: string; name: string } | null
  document: { id: string; name: string; url: string | null; mimeType: string | null }
}
type Summary = { awaitingReview: number; approved: number; reconciled: number; approvedValue: number; approvedVat: number }

type EditForm = { vendor: string; receiptDate: string; subtotal: string; vatAmount: string; totalAmount: string; category: string; costCodeId: string; notes: string }

const SF = 'var(--font-system)'
const CATEGORIES = ['materials', 'plant', 'tools', 'fuel', 'travel', 'accommodation', 'subcontract', 'office', 'other']
const STATUS_COLOR: Record<ReceiptStatus, string> = {
  pending: '#52749a', extracted: '#3b82f6', needs_review: '#f59e0b', approved: '#10b981', reconciled: '#8b5cf6',
}

function money(value: number | null | undefined) {
  return (Number(value) || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 })
}

function toForm(r: Receipt): EditForm {
  return {
    vendor: r.vendor || '',
    receiptDate: r.receiptDate ? r.receiptDate.slice(0, 10) : '',
    subtotal: r.subtotal == null ? '' : String(r.subtotal),
    vatAmount: r.vatAmount == null ? '' : String(r.vatAmount),
    totalAmount: r.totalAmount == null ? '' : String(r.totalAmount),
    category: r.category || 'other',
    costCodeId: r.costCodeId || r.costCode?.id || '',
    notes: r.notes || '',
  }
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [summary, setSummary] = useState<Summary>({ awaitingReview: 0, approved: 0, reconciled: 0, approvedValue: 0, approvedVat: 0 })
  const [filter, setFilter] = useState<'all' | ReceiptStatus>('all')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Receipt | null>(null)
  const [form, setForm] = useState<EditForm>({ vendor: '', receiptDate: '', subtotal: '', vatAmount: '', totalAmount: '', category: 'other', costCodeId: '', notes: '' })
  const [costCodes, setCostCodes] = useState<CostCode[]>([])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  useModalEffects(!!editing, () => setEditing(null))

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/receipts?take=100')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load receipts')
      setReceipts(json.receipts || [])
      setSummary(json.summary || { awaitingReview: 0, approved: 0, reconciled: 0, approvedValue: 0, approvedVat: 0 })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to load receipts', type: 'error' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); fetch('/api/cost-codes').then(r => r.ok ? r.json() : null).then(d => setCostCodes(d?.codes || [])).catch(() => {}) }, [load])

  const filtered = useMemo(() => {
    if (filter === 'all') return receipts
    if (filter === 'needs_review') return receipts.filter(r => ['pending', 'extracted', 'needs_review'].includes(r.status))
    return receipts.filter(r => r.status === filter)
  }, [filter, receipts])

  const openEdit = (receipt: Receipt) => { setEditing(receipt); setForm(toForm(receipt)) }

  const save = async (status?: ReceiptStatus) => {
    if (!editing) return
    setSaving(true)
    try {
      const body = {
        vendor: form.vendor,
        receiptDate: form.receiptDate || null,
        subtotal: form.subtotal === '' ? null : Number(form.subtotal),
        vatAmount: form.vatAmount === '' ? null : Number(form.vatAmount),
        totalAmount: form.totalAmount === '' ? null : Number(form.totalAmount),
        category: form.category,
        costCodeId: form.costCodeId || null,
        notes: form.notes,
        ...(status ? { status } : {}),
      }
      const res = await fetch('/api/receipts/' + editing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to save receipt')
      setEditing(null)
      setToast({ msg: status === 'approved' ? 'Receipt approved' : status === 'reconciled' ? 'Receipt reconciled' : 'Receipt updated' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to save receipt', type: 'error' })
    } finally { setSaving(false) }
  }

  const rescan = async (receipt: Receipt) => {
    setScanning(receipt.id)
    try {
      const res = await fetch('/api/receipts/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: receipt.document.id }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'OCR failed')
      setToast({ msg: 'Receipt OCR refreshed' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'OCR failed', type: 'error' })
    } finally { setScanning(null) }
  }

  return <div style={{ minHeight: '100dvh', background: '#06101e', paddingBottom: 96 }}>
    {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <div style={{ padding: '18px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
      <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 9 }}><IcChevL size={18} color="#52749a" /><span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span></Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h1 style={{ fontFamily: SF, fontSize: 22, fontWeight: 800, color: '#eef3fa' }}>Receipts</h1><p style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>AI OCR · review · approve · reconcile</p></div>
        <Link href="/capture?type=receipt" aria-label="Scan receipt" style={{ width: 38, height: 38, borderRadius: 11, background: '#10b981', display: 'grid', placeItems: 'center' }}><IcCamera size={18} color="#fff" /></Link>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, padding: '14px 16px 0' }}>
      <Kpi label="Needs review" value={String(summary.awaitingReview)} color="#f59e0b" />
      <Kpi label="Approved value" value={money(summary.approvedValue)} color="#10b981" />
      <Kpi label="Approved VAT" value={money(summary.approvedVat)} color="#06b6d4" />
      <Kpi label="Reconciled" value={String(summary.reconciled)} color="#8b5cf6" />
    </div>

    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 16px 4px' }}>
      {(['all', 'needs_review', 'approved', 'reconciled'] as const).map(s => <button key={s} type="button" onClick={() => setFilter(s)} style={{ flexShrink: 0, border: 0, borderRadius: 99, padding: '6px 11px', background: filter === s ? '#2563eb' : 'rgba(255,255,255,0.06)', color: filter === s ? '#fff' : '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{s === 'all' ? 'All' : s === 'needs_review' ? 'Review queue' : s[0].toUpperCase() + s.slice(1)}</button>)}
    </div>

    {loading ? <div style={{ padding: 40, textAlign: 'center', fontFamily: SF, color: '#52749a' }}>Loading receipts…</div> : filtered.length === 0 ? (
      <div style={{ padding: '62px 28px', textAlign: 'center' }}><IcReceipt size={34} color="#52749a" /><div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: '#eef3fa', marginTop: 12 }}>No receipts in this view</div><div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 4 }}>Scan a site receipt to build the expense review queue.</div></div>
    ) : <div style={{ padding: '10px 16px', display: 'grid', gap: 10 }}>
      {filtered.map(r => {
        const confidence = r.confidence == null ? null : Math.round(r.confidence * 100)
        const gps = r.latitude != null && r.longitude != null
        return <div key={r.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: '#eef3fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.vendor || 'Vendor not identified'}</div>
              <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', marginTop: 2 }}>{r.project?.name || 'Unassigned'} · {r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-GB') : 'date unclear'}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 800, color: '#eef3fa' }}>{r.totalAmount == null ? '—' : money(r.totalAmount)}</div><span style={{ display: 'inline-block', marginTop: 3, borderRadius: 99, padding: '2px 7px', background: STATUS_COLOR[r.status] + '20', color: STATUS_COLOR[r.status], fontFamily: SF, fontSize: 8, fontWeight: 900, textTransform: 'uppercase' }}>{r.status.replace('_', ' ')}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
            <Chip text={r.category || 'uncategorised'} />
            {r.costCode && <Chip text={`${r.costCode.code} · ${r.costCode.name}`} />}
            {confidence != null && <Chip text={`${confidence}% OCR`} />}
            <Chip text={gps ? `GPS ±${Math.round(r.accuracyM || 0)}m` : 'No GPS'} />
            {r.vatAmount != null && <Chip text={`VAT ${money(r.vatAmount)}`} />}
          </div>
          {r.notes && <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', lineHeight: 1.4, marginTop: 8 }}>{r.notes}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {r.document.url && <a href={r.document.url} target="_blank" rel="noreferrer" style={smallBtn('#8ea8c5')}>Image</a>}
            {r.status !== 'reconciled' && <button type="button" disabled={scanning === r.id} onClick={() => rescan(r)} style={smallBtn('#8b5cf6')}><IcSpark size={10} color="#8b5cf6" /> {scanning === r.id ? 'Scanning…' : 'Re-scan'}</button>}
            <button type="button" onClick={() => openEdit(r)} style={smallBtn(r.status === 'approved' ? '#10b981' : '#3b82f6')}>{r.status === 'approved' ? 'Reconcile' : r.status === 'reconciled' ? 'View' : 'Review'}</button>
          </div>
        </div>
      })}
    </div>}

    <TabBar />

    {editing && <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={() => setEditing(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)' }} />
      <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '22px 20px 34px', maxHeight: '92dvh', overflowY: 'auto', display: 'grid', gap: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h2 style={{ fontFamily: SF, fontSize: 19, color: '#eef3fa' }}>Review receipt</h2><div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', marginTop: 2 }}>{editing.project?.name || 'Unassigned'} · {editing.document.name}</div></div><button type="button" onClick={() => setEditing(null)} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><IcX size={19} color="#8ea8c5" /></button></div>
        <Field label="Vendor"><input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} style={inputStyle} /></Field>
        <Field label="Receipt date"><input type="date" value={form.receiptDate} onChange={e => setForm(p => ({ ...p, receiptDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7 }}>
          <Field label="Net"><input type="number" min="0" step="0.01" value={form.subtotal} onChange={e => setForm(p => ({ ...p, subtotal: e.target.value }))} style={inputStyle} /></Field>
          <Field label="VAT"><input type="number" min="0" step="0.01" value={form.vatAmount} onChange={e => setForm(p => ({ ...p, vatAmount: e.target.value }))} style={inputStyle} /></Field>
          <Field label="Total"><input type="number" min="0" step="0.01" value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} style={inputStyle} /></Field>
        </div>
        <Field label="Category"><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>{CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select></Field>
        <Field label="Cost code"><select value={form.costCodeId} onChange={e => setForm(p => ({ ...p, costCodeId: e.target.value }))} disabled={editing.status === 'reconciled'} style={inputStyle}><option value="">— Uncoded —</option>{costCodes.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></Field>
        <Field label="Notes"><textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <div style={{ display: 'flex', gap: 7 }}>
          <button type="button" onClick={() => save()} disabled={saving} style={{ ...actionBtn('#3b82f6'), flex: 1 }}>{saving ? 'Saving…' : 'Save'}</button>
          {editing.status !== 'approved' && editing.status !== 'reconciled' && <button type="button" onClick={() => save('approved')} disabled={saving || !form.vendor || !form.totalAmount} style={{ ...actionBtn('#10b981'), flex: 1 }}><IcCheck size={12} color="#fff" /> Approve</button>}
          {editing.status === 'approved' && <button type="button" onClick={() => save('reconciled')} disabled={saving} style={{ ...actionBtn('#8b5cf6'), flex: 1 }}><IcCheck size={12} color="#fff" /> Reconcile</button>}
        </div>
      </div>
    </div>}
  </div>
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) { return <div style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 11 }}><div style={{ fontFamily: SF, fontSize: 8, fontWeight: 900, color: '#52749a', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 800, color, marginTop: 3 }}>{value}</div></div> }
function Chip({ text }: { text: string }) { return <span style={{ fontFamily: SF, fontSize: 8, fontWeight: 800, color: '#8ea8c5', padding: '3px 6px', borderRadius: 99, background: 'rgba(255,255,255,0.05)' }}>{text}</span> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: 'grid', gap: 5 }}><span style={{ fontFamily: SF, fontSize: 9, fontWeight: 900, color: '#8ea8c5', textTransform: 'uppercase' }}>{label}</span>{children}</label> }
function smallBtn(color: string): React.CSSProperties { return { display: 'inline-flex', gap: 4, alignItems: 'center', border: `1px solid ${color}44`, background: color + '12', color, borderRadius: 8, padding: '6px 8px', fontFamily: SF, fontSize: 9, fontWeight: 800, textDecoration: 'none', cursor: 'pointer' } }
function actionBtn(color: string): React.CSSProperties { return { minHeight: 42, border: 0, borderRadius: 10, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: SF, fontSize: 12, fontWeight: 800, cursor: 'pointer' } }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: '#eef3fa', padding: '9px 10px', fontFamily: SF, fontSize: 12, outline: 'none' }

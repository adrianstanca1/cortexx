'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcPlus, IcX, IcCheck } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type Allocation = { id: string; targetType: string; targetId: string; targetLabel?: string; amount: number }
type Reconciliation = { total: number; allocated: number; remaining: number; status: 'unmatched' | 'partial' | 'reconciled' }
type BankTransaction = {
  id: string; source: string; externalId: string | null; accountName: string | null; occurredAt: string | null; amount: number | null; currency: string;
  description: string | null; reference: string | null; status: 'unmatched' | 'partial' | 'reconciled' | 'ignored'; createdAt: string;
  allocations: Allocation[]; reconciliation: Reconciliation
}
type Candidate = { targetType: string; targetId: string; label: string; project: string | null; amount: number; outstanding: number; dueDate?: string | null; status: string; purchaseOrder?: string | null; costCode?: string | null }

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<BankTransaction['status'], string> = { unmatched: '#f59e0b', partial: '#3b82f6', reconciled: '#10b981', ignored: 'var(--t3)' }

function money(value: number | null | undefined, currency = 'GBP') {
  return (Number(value) || 0).toLocaleString('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 })
}

function authHeaders() {
  if (typeof window === 'undefined') return {} as Record<string, string>
  try {
    const token = window.localStorage.getItem('cortexx_token') || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch { return {} }
}

export default function BankPage() {
  const [items, setItems] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | BankTransaction['status']>('all')
  const [selected, setSelected] = useState<BankTransaction | null>(null)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [bankingConfigured, setBankingConfigured] = useState<boolean | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({ accountName: '', occurredAt: new Date().toISOString().slice(0, 10), amount: '', description: '', reference: '' })

  useModalEffects(showAdd || selected !== null, () => { setShowAdd(false); setSelected(null) })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bank?take=200')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load bank transactions')
      setItems(json.items || [])
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to load bank transactions', type: 'error' })
    } finally { setLoading(false) }
  }, [])

  const loadBankingStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/banking/status', { headers: authHeaders() })
      if (!res.ok) return setBankingConfigured(false)
      const json = await res.json()
      setBankingConfigured(json.configured === true)
    } catch { setBankingConfigured(false) }
  }, [])

  useEffect(() => { void load(); void loadBankingStatus() }, [load, loadBankingStatus])

  const openTransaction = async (item: BankTransaction) => {
    setSelected(item); setCandidateLoading(true); setCandidates([]); setAllocations([])
    try {
      const [allocRes, candidateRes] = await Promise.all([fetch(`/api/bank/${item.id}/allocations`), fetch(`/api/bank/${item.id}/candidates`)])
      const allocJson = await allocRes.json().catch(() => ({})); const candidateJson = await candidateRes.json().catch(() => ({}))
      if (!allocRes.ok) throw new Error(allocJson?.error || 'Failed to load reconciliation')
      if (!candidateRes.ok) throw new Error(candidateJson?.error || 'Failed to load candidates')
      setAllocations(allocJson.allocations || [])
      setCandidates(candidateJson.candidates || [])
      setSelected(prev => prev ? { ...prev, reconciliation: allocJson.summary || prev.reconciliation, allocations: allocJson.allocations || [] } : prev)
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to load reconciliation', type: 'error' })
    } finally { setCandidateLoading(false) }
  }

  const createManual = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), occurredAt: form.occurredAt }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to create transaction')
      setShowAdd(false); setForm({ accountName: '', occurredAt: new Date().toISOString().slice(0, 10), amount: '', description: '', reference: '' }); setToast({ msg: 'Bank transaction added' }); await load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to create transaction', type: 'error' }) }
    finally { setSaving(false) }
  }

  const connectBank = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/banking/connect', { headers: authHeaders() })
      const json = await res.json().catch(() => ({})); if (!res.ok || !json.url) throw new Error(json?.error || 'Open Banking connection unavailable')
      window.location.assign(json.url)
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Open Banking connection unavailable', type: 'error' }); setConnecting(false) }
  }

  const importBankFeed = async () => {
    setImporting(true)
    try {
      const feed = await fetch('/api/banking/transactions', { headers: authHeaders() })
      const feedJson = await feed.json().catch(() => ({})); if (!feed.ok) throw new Error(feedJson?.error || 'Failed to pull Open Banking transactions')
      const res = await fetch('/api/bank/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'truelayer', transactions: feedJson.transactions || [] }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to import bank feed')
      setToast({ msg: `Bank feed synced · ${json.created || 0} new · ${json.updated || 0} refreshed` }); await load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Bank feed sync failed', type: 'error' }) }
    finally { setImporting(false) }
  }

  const matchCandidate = async (candidate: Candidate) => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/bank/${selected.id}/allocations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType: candidate.targetType, targetId: candidate.targetId }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Match failed')
      setToast({ msg: `Matched ${candidate.label}` }); await load(); await openTransaction({ ...selected, reconciliation: json.summary || selected.reconciliation })
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Match failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const removeAllocation = async (allocation: Allocation) => {
    if (!selected) return
    try {
      const res = await fetch(`/api/bank/${selected.id}/allocations/${allocation.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to remove match')
      setToast({ msg: 'Bank match removed' }); await load(); await openTransaction(selected)
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to remove match', type: 'error' }) }
  }

  const toggleIgnored = async () => {
    if (!selected) return
    try {
      const next = selected.status === 'ignored' ? 'unmatched' : 'ignored'
      const res = await fetch(`/api/bank/${selected.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
      const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json?.error || 'Failed to update transaction')
      setSelected(null); setToast({ msg: next === 'ignored' ? 'Transaction ignored' : 'Transaction restored' }); await load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to update transaction', type: 'error' }) }
  }

  const visible = useMemo(() => filter === 'all' ? items : items.filter(i => i.status === filter), [filter, items])
  const summary = useMemo(() => ({
    unmatched: items.filter(i => i.status === 'unmatched').length,
    partial: items.filter(i => i.status === 'partial').length,
    reconciled: items.filter(i => i.status === 'reconciled').length,
    unallocatedValue: items.filter(i => ['unmatched', 'partial'].includes(i.status)).reduce((sum, i) => sum + Math.abs(i.reconciliation?.remaining || 0), 0),
  }), [items])

  return <div style={{ minHeight: '100dvh', background: 'var(--bg0)', paddingBottom: 96 }}>
    {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <header style={{ padding: '18px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
      <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 9 }}><IcChevL size={18} color="var(--t3)" /><span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>Apps</span></Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div><h1 style={{ fontFamily: SF, fontSize: 22, fontWeight: 800, color: 'var(--t1)' }}>Bank reconciliation</h1><p style={{ fontFamily: SF, fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>Bank feed → invoices, valuations and subcontract payments</p></div>
        <button type="button" onClick={() => setShowAdd(true)} style={roundAction}><IcPlus size={18} color="#fff" /></button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={connectBank} disabled={connecting} style={pillBtn(bankingConfigured ? '#2563eb' : 'var(--t3)')}>{connecting ? 'Connecting…' : bankingConfigured ? 'Connect bank' : 'Bank feed not configured'}</button>
        <button type="button" onClick={importBankFeed} disabled={importing || bankingConfigured === false} style={pillBtn('#10b981')}>{importing ? 'Syncing…' : 'Sync bank feed'}</button>
      </div>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, padding: '14px 16px 0' }}>
      <Kpi label="Unmatched" value={String(summary.unmatched)} color="#f59e0b" />
      <Kpi label="Partial" value={String(summary.partial)} color="#3b82f6" />
      <Kpi label="Reconciled" value={String(summary.reconciled)} color="#10b981" />
      <Kpi label="To allocate" value={money(summary.unallocatedValue)} color="var(--t1)" />
    </section>

    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 16px 4px' }}>{(['all', 'unmatched', 'partial', 'reconciled', 'ignored'] as const).map(s => <button key={s} type="button" onClick={() => setFilter(s)} style={{ ...pillBtn(filter === s ? '#2563eb' : '#334b68'), color: filter === s ? '#fff' : 'var(--t2)' }}>{s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>)}</div>

    {loading ? <div style={emptyStyle}>Loading bank transactions…</div> : visible.length === 0 ? <div style={emptyStyle}>No transactions in this view.</div> : <main style={{ padding: '10px 16px', display: 'grid', gap: 8 }}>
      {visible.map(item => {
        const credit = Number(item.amount) > 0
        return <button key={item.id} type="button" onClick={() => openTransaction(item)} style={{ background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 13, padding: 13, textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div style={{ minWidth: 0 }}><div style={{ fontFamily: SF, fontSize: 14, color: 'var(--t1)', fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || item.reference || item.accountName || 'Bank transaction'}</div><div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', marginTop: 3 }}>{item.occurredAt ? new Date(item.occurredAt).toLocaleDateString('en-GB') : 'No date'} · {item.accountName || item.source}</div></div><div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 850, color: credit ? '#10b981' : 'var(--t1)' }}>{credit ? '+' : '−'}{money(Math.abs(Number(item.amount) || 0), item.currency)}</div><span style={{ display: 'inline-block', marginTop: 4, borderRadius: 99, padding: '2px 7px', background: STATUS_COLOR[item.status] + '20', color: STATUS_COLOR[item.status], fontFamily: SF, fontSize: 8, fontWeight: 900, textTransform: 'uppercase' }}>{item.status}</span></div></div>
          {item.status === 'partial' && <div style={{ marginTop: 7, fontFamily: SF, fontSize: 10, color: 'var(--t2)' }}>{money(item.reconciliation.allocated)} allocated · {money(item.reconciliation.remaining)} remaining</div>}
        </button>
      })}
    </main>}
    <TabBar />

    {showAdd && <Modal onClose={() => setShowAdd(false)} title="Manual bank transaction">
      <input value={form.accountName} onChange={e => setForm(p => ({ ...p, accountName: e.target.value }))} placeholder="Account name" style={inputStyle} />
      <input type="date" value={form.occurredAt} onChange={e => setForm(p => ({ ...p, occurredAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
      <input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Signed amount: + receipt, − payment" style={inputStyle} />
      <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={inputStyle} />
      <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Reference" style={inputStyle} />
      <button type="button" onClick={createManual} disabled={saving || !form.amount} style={primaryBtn}><IcCheck size={14} color="#fff" /> {saving ? 'Saving…' : 'Add transaction'}</button>
    </Modal>}

    {selected && <Modal onClose={() => setSelected(null)} title="Reconcile transaction">
      <div style={{ background: 'var(--bg3)', borderRadius: 11, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ fontFamily: SF, fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{selected.description || selected.reference || 'Bank transaction'}</div><div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', marginTop: 3 }}>{selected.occurredAt ? new Date(selected.occurredAt).toLocaleDateString('en-GB') : ''} · {selected.accountName || selected.source}</div></div><strong style={{ fontFamily: 'ui-monospace, monospace', color: Number(selected.amount) > 0 ? '#10b981' : 'var(--t1)' }}>{money(Number(selected.amount) || 0, selected.currency)}</strong></div><div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', marginTop: 8 }}>{money(selected.reconciliation.allocated)} allocated · {money(selected.reconciliation.remaining)} remaining</div></div>

      {allocations.length > 0 && <div><div style={sectionLabel}>Current matches</div><div style={{ display: 'grid', gap: 6 }}>{allocations.map(a => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', background: '#0f1d31', borderRadius: 9, padding: '8px 10px' }}><div><div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t1)', fontWeight: 700 }}>{a.targetLabel || a.targetId}</div><div style={{ fontFamily: SF, fontSize: 9, color: 'var(--t2)' }}>{a.targetType.replaceAll('_', ' ')} · {money(a.amount)}</div></div><button type="button" onClick={() => removeAllocation(a)} style={smallDanger}>Remove</button></div>)}</div></div>}

      {selected.status !== 'ignored' && selected.reconciliation.remaining > 0.009 && <div><div style={sectionLabel}>Available matches</div>{candidateLoading ? <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t2)' }}>Finding candidates…</div> : candidates.length === 0 ? <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t2)' }}>No outstanding matching targets found.</div> : <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflowY: 'auto' }}>{candidates.slice(0, 40).map(c => <button key={`${c.targetType}:${c.targetId}`} type="button" disabled={saving} onClick={() => matchCandidate(c)} style={{ background: '#0f1d31', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: '9px 10px', textAlign: 'left', cursor: 'pointer' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><div style={{ fontFamily: SF, fontSize: 11, fontWeight: 750, color: 'var(--t1)' }}>{c.label}</div><div style={{ fontFamily: SF, fontSize: 9, color: 'var(--t2)', marginTop: 2 }}>{c.project || 'No project'}{c.purchaseOrder ? ` · ${c.purchaseOrder}` : ''}{c.costCode ? ` · ${c.costCode}` : ''}</div></div><strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#f59e0b' }}>{money(c.outstanding)}</strong></div></button>)}</div>}</div>}
      <button type="button" onClick={toggleIgnored} disabled={allocations.length > 0} style={{ ...secondaryBtn, opacity: allocations.length ? 0.4 : 1 }}>{selected.status === 'ignored' ? 'Restore transaction' : 'Ignore transaction'}</button>
    </Modal>}
  </div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}><div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)' }} /><div className="module-sheet" style={{ position: 'relative', background: 'var(--surface-raised)', borderRadius: '20px 20px 0 0', padding: '22px 20px 34px', maxHeight: '92dvh', overflowY: 'auto', display: 'grid', gap: 11 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ fontFamily: SF, fontSize: 19, color: 'var(--t1)' }}>{title}</h2><button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><IcX size={19} color="var(--t2)" /></button></div>{children}</div></div> }
function Kpi({ label, value, color }: { label: string; value: string; color: string }) { return <div style={{ background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 11 }}><div style={{ fontFamily: SF, fontSize: 8, fontWeight: 900, color: 'var(--t3)', textTransform: 'uppercase' }}>{label}</div><div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 800, color, marginTop: 3 }}>{value}</div></div> }
const roundAction: React.CSSProperties = { width: 38, height: 38, border: 0, borderRadius: 11, background: '#f59e0b', display: 'grid', placeItems: 'center', cursor: 'pointer' }
function pillBtn(background: string): React.CSSProperties { return { border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, background, color: '#fff', padding: '6px 10px', fontFamily: SF, fontSize: 10, fontWeight: 800, cursor: 'pointer' } }
const emptyStyle: React.CSSProperties = { padding: 44, textAlign: 'center', color: 'var(--t3)', fontFamily: SF, fontSize: 13 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: 'var(--t1)', padding: '10px 11px', fontFamily: SF, fontSize: 12, outline: 'none' }
const primaryBtn: React.CSSProperties = { minHeight: 44, border: 0, borderRadius: 11, background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: SF, fontSize: 13, fontWeight: 800, cursor: 'pointer' }
const secondaryBtn: React.CSSProperties = { minHeight: 40, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: 'rgba(255,255,255,0.04)', color: 'var(--t2)', fontFamily: SF, fontSize: 11, fontWeight: 800, cursor: 'pointer' }
const smallDanger: React.CSSProperties = { border: '1px solid rgba(239,68,68,0.35)', borderRadius: 7, background: 'rgba(239,68,68,0.08)', color: '#ef4444', padding: '5px 7px', fontFamily: SF, fontSize: 9, fontWeight: 800, cursor: 'pointer' }
const sectionLabel: React.CSSProperties = { fontFamily: SF, fontSize: 9, color: 'var(--t2)', fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }

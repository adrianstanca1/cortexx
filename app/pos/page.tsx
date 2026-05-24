'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcDoc, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSend } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
interface LineItem { description: string; quantity: number; unit?: string; unitPrice: number; total: number }
interface PO {
  id: string
  number: string
  projectId: string | null
  supplier: string
  contactEmail: string | null
  contactPhone: string | null
  status: 'draft' | 'sent' | 'received' | 'closed' | 'cancelled'
  lineItems: LineItem[]
  subtotal: number
  vatRate: number
  vatAmount: number
  total: number
  expectedDelivery: string | null
  receivedAt: string | null
  sentAt: string | null
  createdAt: string
  notes: string | null
  project?: Project | null
}

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<PO['status'], string> = { draft: '#52749a', sent: '#f59e0b', received: '#22c55e', closed: '#06b6d4', cancelled: '#ef4444' }
const STATUS_LABEL: Record<PO['status'], string> = { draft: 'Draft', sent: 'Sent', received: 'Received', closed: 'Closed', cancelled: 'Cancelled' }
const UNITS = ['item', 'hour', 'day', 'm', 'm²', 'm³', 'kg', 'tonne', 'l']
const blankItem = (): LineItem => ({ description: '', quantity: 1, unit: 'item', unitPrice: 0, total: 0 })

export default function POsPage() {
  const [pos, setPos] = useState<PO[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [committedValue, setCommittedValue] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | PO['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activePo, setActivePo] = useState<PO | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    supplier: '', contactEmail: '', projectId: '', vatRate: '20', expectedDelivery: '', items: [blankItem()],
  })
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBrief, setAiBrief] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNotes, setAiNotes] = useState<string | null>(null)

  const draftWithAi = async () => {
    const brief = aiBrief.trim()
    if (brief.length < 10) { setAiError('Brief needs at least 10 characters'); return }
    setAiBusy(true); setAiError(null); setAiNotes(null)
    try {
      const res = await fetch('/api/pos/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, supplier: form.supplier }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to draft')
      const items: LineItem[] = (json.items || []).map((it: { description: string; quantity: number; unit: string; unitPrice: number }) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }))
      if (items.length === 0) throw new Error('Model returned no usable items')
      setForm(p => ({ ...p, items }))
      setAiNotes(json.notes || null)
      setAiOpen(false)
      setAiBrief('')
      setToast({ msg: `Drafted ${items.length} item${items.length === 1 ? '' : 's'} — review before saving` })
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to draft')
    } finally { setAiBusy(false) }
  }

  useModalEffects(showAdd || activePo !== null, () => { setShowAdd(false); setActivePo(null) })

  const load = useCallback(() => {
    fetch('/api/pos')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setPos(d.pos || []); setOpenCount(d.openCount || 0); setCommittedValue(d.committedValue || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      setProjects((d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const totals = (() => {
    const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
    const vatRate = Number(form.vatRate) || 0
    const vatAmount = subtotal * (vatRate / 100)
    return { subtotal, vatAmount, total: subtotal + vatAmount }
  })()

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setForm(prev => {
      const items = prev.items.map((it, i) => {
        if (i !== idx) return it
        const next = { ...it, ...patch }
        next.total = (Number(next.quantity) || 0) * (Number(next.unitPrice) || 0)
        return next
      })
      return { ...prev, items }
    })
  }

  const create = async () => {
    if (!form.supplier.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier: form.supplier.trim(),
          contactEmail: form.contactEmail.trim() || null,
          projectId: form.projectId || null,
          vatRate: Number(form.vatRate),
          expectedDelivery: form.expectedDelivery || null,
          lineItems: form.items.filter(it => it.description.trim()),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ supplier: '', contactEmail: '', projectId: '', vatRate: '20', expectedDelivery: '', items: [blankItem()] })
      setAiOpen(false); setAiBrief(''); setAiError(null); setAiNotes(null)
      load()
      setToast({ msg: 'PO drafted' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const changeStatus = async (p: PO, next: PO['status']) => {
    try {
      const res = await fetch(`/api/pos/${p.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activePo?.id === p.id) setActivePo(updated)
      load()
    } catch { setToast({ msg: 'Status change failed', type: 'error' }) }
  }

  const emailSupplier = (p: PO) => {
    const lines = p.lineItems.map(li => `  ${li.description} — ${li.quantity}${li.unit ? ` ${li.unit}` : ''} × £${li.unitPrice.toFixed(2)} = £${li.total.toFixed(2)}`).join('\n')
    const subject = `Purchase order ${p.number} — ${p.supplier}`
    const body = `Hi,\n\nPlease find purchase order ${p.number}.\n\nSupplier: ${p.supplier}\n${p.project ? `Project: ${p.project.name}\n` : ''}${p.expectedDelivery ? `Expected delivery: ${new Date(p.expectedDelivery).toLocaleDateString('en-GB')}\n` : ''}\nItems:\n${lines}\n\nSubtotal: £${p.subtotal.toFixed(2)}\nVAT (${p.vatRate}%): £${p.vatAmount.toFixed(2)}\nTotal: £${p.total.toFixed(2)}\n\nKind regards,\nCortexx`
    const to = p.contactEmail ? `to=${encodeURIComponent(p.contactEmail)}&` : ''
    window.open(`mailto:?${to}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self')
    if (p.status === 'draft') changeStatus(p, 'sent')
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id); setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000); return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/pos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActivePo(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  const filtered = filter === 'all' ? pos : pos.filter(p => p.status === filter)

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Purchase orders</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {pos.length} total · {openCount} open · <span style={{ fontFamily: 'ui-monospace, monospace', color: '#f59e0b' }}>£{committedValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span> committed
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Raise PO" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'draft', 'sent', 'received', 'closed', 'cancelled'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcDoc size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{pos.length === 0 ? 'No purchase orders' : 'Nothing in this filter'}</p>
          {pos.length === 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Raise first PO</button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <button key={p.id} onClick={() => setActivePo(p)} style={{ background: '#152641', borderRadius: 14, padding: '14px', border: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: '#52749a' }}>{p.number}</span>
                <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>{p.supplier}</span>
                {p.project && <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>· {p.project.name}</span>}
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[p.status]}22`, color: STATUS_COLOR[p.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[p.status]}55`, textTransform: 'uppercase' }}>{STATUS_LABEL[p.status]}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 700, color: '#eef3fa' }}>£{p.total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{(p.lineItems || []).length} item{(p.lineItems || []).length === 1 ? '' : 's'}{p.expectedDelivery ? ` · expected ${new Date(p.expectedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Raise PO</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} placeholder="Supplier" style={inputStyle} />
            <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="Supplier email" style={inputStyle} />

            {/* AI-draft toggle + panel */}
            {!aiOpen ? (
              <button
                onClick={() => { setAiOpen(true); setAiError(null) }}
                type="button"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(245,158,11,0.10))',
                  border: '0.5px dashed rgba(139,92,246,0.5)',
                  color: '#c4b5fd',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontFamily: SF,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>✨ Estimate items with AI from a brief</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, opacity: 0.7 }}>local LLM</span>
              </button>
            ) : (
              <div style={{ background: 'rgba(139,92,246,0.08)', border: '0.5px solid rgba(139,92,246,0.35)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>✨ Estimate with AI</span>
                  <button onClick={() => { setAiOpen(false); setAiError(null) }} aria-label="Close" type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <IcX size={14} color="#8ea8c5" />
                  </button>
                </div>
                <textarea
                  value={aiBrief}
                  onChange={e => setAiBrief(e.target.value)}
                  placeholder="e.g. Materials for 12m brick boundary wall, 1.8m high — bricks, mortar, foundations, capping. Plus a 1.5T mini-excavator for 2 days."
                  rows={3}
                  maxLength={800}
                  style={{ ...inputStyle, fontFamily: SF, fontSize: 12, resize: 'vertical', minHeight: 60 }}
                />
                {aiError && (
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#ef4444' }}>{aiError}</div>
                )}
                <button
                  onClick={draftWithAi}
                  disabled={aiBusy || aiBrief.trim().length < 10}
                  type="button"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: '#8b5cf6',
                    border: 'none',
                    color: '#fff',
                    fontFamily: SF,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: aiBusy || aiBrief.trim().length < 10 ? 'not-allowed' : 'pointer',
                    opacity: aiBusy || aiBrief.trim().length < 10 ? 0.5 : 1,
                  }}
                >
                  {aiBusy ? 'Estimating (10–30s)…' : 'Generate line items'}
                </button>
                <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5' }}>
                  AI suggests realistic UK construction materials and plant. Always confirm prices with your supplier before sending.
                </div>
              </div>
            )}
            {aiNotes && !aiOpen && (
              <div style={{ background: 'rgba(139,92,246,0.08)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '8px 12px', fontFamily: SF, fontSize: 11, color: '#c4b5fd' }}>
                <span style={{ fontWeight: 700 }}>AI note: </span>{aiNotes}
              </div>
            )}
            <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">— Project (optional) —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <div>
              <label style={labelStyle}>Items</label>
              {form.items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 70px 28px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                  <input value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="Description" style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                  <input type="number" step="0.1" value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} placeholder="Qty" style={{ ...inputStyle, padding: '8px 6px', fontSize: 12, textAlign: 'right' }} />
                  <select value={it.unit || 'item'} onChange={e => updateItem(idx, { unit: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', fontSize: 11, appearance: 'none' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" step="0.01" value={it.unitPrice} onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) })} placeholder="£" style={{ ...inputStyle, padding: '8px 6px', fontSize: 12, textAlign: 'right' }} />
                  <button onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} disabled={form.items.length === 1} style={{ background: 'none', border: 'none', padding: 2, cursor: form.items.length === 1 ? 'not-allowed' : 'pointer', opacity: form.items.length === 1 ? 0.3 : 1 }}><IcX size={14} color="#ef4444" /></button>
                </div>
              ))}
              <button onClick={() => setForm(p => ({ ...p, items: [...p.items, blankItem()] }))} style={{ background: 'rgba(245,158,11,0.12)', border: '0.5px dashed rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 8, padding: '6px 12px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}>+ Add line</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>VAT %</label>
                <input type="number" step="1" value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Expected delivery</label>
                <input type="date" value={form.expectedDelivery} onChange={e => setForm(p => ({ ...p, expectedDelivery: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 15, color: '#eef3fa', fontWeight: 700 }}>
              <span>Total (inc VAT)</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>£{totals.total.toFixed(2)}</span>
            </div>

            <button onClick={create} disabled={saving || !form.supplier.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.supplier.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Save draft</>}
            </button>
          </div>
        </div>
      )}

      {activePo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActivePo(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700 }}>{activePo.number}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: SF, marginTop: 2 }}>{activePo.supplier}</h2>
              </div>
              <button onClick={() => setActivePo(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <div style={{ background: '#1a2f4e', padding: 12, borderRadius: 10 }}>
              {(activePo.lineItems || []).map((li, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8, padding: '6px 0', borderBottom: i < activePo.lineItems.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div>
                    <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{li.description}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{li.quantity}{li.unit ? ` ${li.unit}` : ''} × £{li.unitPrice.toFixed(2)}</div>
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#eef3fa', fontWeight: 600, textAlign: 'right' }}>£{li.total.toFixed(2)}</div>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 15, color: '#eef3fa', fontWeight: 700 }}>
                <span>Total (inc {activePo.vatRate}% VAT)</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>£{activePo.total.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <button onClick={() => emailSupplier(activePo)} style={{ ...statusBtn('#f59e0b'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <IcSend size={12} color="#fff" /> Email supplier
              </button>
              <a
                href={`/api/pos/${activePo.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                style={{ ...statusBtn('#8b5cf6'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none' }}
              >
                <IcDoc size={12} color="#8b5cf6" /> Download PDF
              </a>
              {activePo.status === 'sent' && (
                <button onClick={() => changeStatus(activePo, 'received')} style={statusBtn('#22c55e')}>Mark received</button>
              )}
              {activePo.status === 'received' && (
                <button onClick={() => changeStatus(activePo, 'closed')} style={statusBtn('#06b6d4')}>Close</button>
              )}
              {(activePo.status === 'sent' || activePo.status === 'draft') && (
                <button onClick={() => changeStatus(activePo, 'cancelled')} style={statusBtn('#ef4444')}>Cancel</button>
              )}
              {activePo.status !== 'draft' && activePo.status !== 'closed' && (
                <button onClick={() => changeStatus(activePo, 'draft')} style={statusBtn('#52749a')}>Revert to draft</button>
              )}
            </div>

            <button onClick={() => remove(activePo.id)} style={{ padding: '10px', borderRadius: 10, background: confirmDelete === activePo.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activePo.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" /> {confirmDelete === activePo.id ? 'Sure?' : 'Delete PO'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const statusBtn = (color: string): React.CSSProperties => ({
  padding: '10px', borderRadius: 10, background: `${color}22`, border: `0.5px solid ${color}66`, color, fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})
const labelStyle: React.CSSProperties = { fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box' }

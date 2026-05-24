'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcDoc, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSend, IcPound } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Customer { id: string; name: string; contactName?: string | null; contactEmail?: string | null }
interface LineItem { description: string; quantity: number; unit?: string; unitPrice: number; total: number }
interface Quote {
  id: string
  number: string
  customerId: string | null
  customerName: string
  title: string
  description: string | null
  lineItems: LineItem[]
  subtotal: number
  vatRate: number
  vatAmount: number
  total: number
  validUntil: string | null
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  terms: string | null
  sentAt: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  createdAt: string
  customer?: Customer | null
}

const SF = 'var(--font-system)'
const STATUS_COLOR: Record<Quote['status'], string> = {
  draft: '#52749a',
  sent: '#f59e0b',
  accepted: '#22c55e',
  rejected: '#ef4444',
}
const STATUS_LABEL: Record<Quote['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
}
const COMMON_UNITS = ['hour', 'day', 'item', 'm', 'm²', 'm³', 'kg', 'tonne']
const blankItem = (): LineItem => ({ description: '', quantity: 1, unit: 'item', unitPrice: 0, total: 0 })

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [openValue, setOpenValue] = useState(0)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filter, setFilter] = useState<'all' | Quote['status']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    customerId: '',
    customerName: '',
    vatRate: '20',
    validUntil: '',
    terms: '',
    items: [blankItem()],
  })
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBrief, setAiBrief] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNotes, setAiNotes] = useState<string | null>(null)

  useModalEffects(showAdd || activeQuote !== null, () => { setShowAdd(false); setActiveQuote(null) })

  const load = useCallback(() => {
    fetch('/api/quotes')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setQuotes(d.quotes || []); setOpenValue(d.openValue || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/customers').then(r => r.ok ? r.json() : null).then(d => {
      setCustomers((d?.customers || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
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
  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, blankItem()] }))
  const removeItem = (idx: number) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const draftWithAi = async () => {
    const brief = aiBrief.trim()
    if (brief.length < 10) {
      setAiError('Brief needs at least 10 characters')
      return
    }
    setAiBusy(true)
    setAiError(null)
    setAiNotes(null)
    try {
      const res = await fetch('/api/quotes/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          customerName: form.customerName || customers.find(c => c.id === form.customerId)?.name || '',
        }),
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
      setForm(p => ({
        ...p,
        items,
        // Use the first 60 chars of the brief as a sensible default title if the user hasn't entered one yet.
        title: p.title || brief.slice(0, 60).replace(/\s+\S*$/, ''),
      }))
      setAiNotes(json.notes || null)
      setAiOpen(false)
      setAiBrief('')
      setToast({ msg: `Drafted ${items.length} item${items.length === 1 ? '' : 's'} — review before saving` })
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to draft')
    } finally {
      setAiBusy(false)
    }
  }

  const create = async () => {
    if (!form.title.trim() || (!form.customerId && !form.customerName.trim())) return
    setSaving(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          customerId: form.customerId || null,
          customerName: form.customerName.trim() || customers.find(c => c.id === form.customerId)?.name || '',
          vatRate: Number(form.vatRate),
          validUntil: form.validUntil || null,
          terms: form.terms.trim() || null,
          lineItems: form.items.filter(it => it.description.trim()),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ title: '', description: '', customerId: '', customerName: '', vatRate: '20', validUntil: '', terms: '', items: [blankItem()] })
      setAiOpen(false); setAiBrief(''); setAiError(null); setAiNotes(null)
      load()
      setToast({ msg: 'Quote drafted' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (q: Quote, next: Quote['status']) => {
    try {
      const res = await fetch(`/api/quotes/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activeQuote?.id === q.id) setActiveQuote(updated)
      load()
    } catch {
      setToast({ msg: 'Status change failed', type: 'error' })
    }
  }

  const sendByEmail = (q: Quote) => {
    const lines = q.lineItems.map(li => `  ${li.description} — ${li.quantity}${li.unit ? ` ${li.unit}` : ''} × £${li.unitPrice.toFixed(2)} = £${li.total.toFixed(2)}`).join('\n')
    const subject = `Quote ${q.number} — ${q.title}`
    const body = `Hi${q.customer?.contactName ? ` ${q.customer.contactName}` : ''},\n\nPlease find your quote attached.\n\nQuote: ${q.number}\nTitle: ${q.title}\n${q.description ? `\nDescription: ${q.description}\n` : ''}\nItems:\n${lines}\n\nSubtotal: £${q.subtotal.toFixed(2)}\nVAT (${q.vatRate}%): £${q.vatAmount.toFixed(2)}\nTotal: £${q.total.toFixed(2)}\n${q.validUntil ? `\nValid until: ${new Date(q.validUntil).toLocaleDateString('en-GB')}\n` : ''}${q.terms ? `\nTerms:\n${q.terms}\n` : ''}\nKind regards,\nCortexx`
    const to = q.customer?.contactEmail ? `to=${encodeURIComponent(q.customer.contactEmail)}&` : ''
    window.open(`mailto:?${to}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self')
    if (q.status === 'draft') changeStatus(q, 'sent')
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveQuote(null)
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Quotes</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {quotes.length} total · <span style={{ fontFamily: 'ui-monospace, monospace', color: '#f59e0b' }}>£{openValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span> out
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Draft quote" style={{ width: 36, height: 36, borderRadius: 10, background: '#06b6d4', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'draft', 'sent', 'accepted', 'rejected'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
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
          <p style={{ marginTop: 12, fontSize: 14 }}>{quotes.length === 0 ? 'No quotes drafted' : 'Nothing in this filter'}</p>
          {quotes.length === 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Draft first quote
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(q => (
            <button key={q.id} onClick={() => setActiveQuote(q)} style={{ background: '#152641', borderRadius: 14, padding: '14px', border: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: '#52749a', letterSpacing: 0.5 }}>{q.number}</span>
                <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>{q.customerName}</span>
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[q.status]}22`, color: STATUS_COLOR[q.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[q.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[q.status]}</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{q.title}</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#eef3fa' }}>£{q.total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>incl. {q.vatRate}% VAT · {(q.lineItems || []).length} item{(q.lineItems || []).length === 1 ? '' : 's'}</span>
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Draft quote</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <input autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Quote title" style={inputStyle} />

            {/* AI-draft toggle + panel */}
            {!aiOpen ? (
              <button
                onClick={() => { setAiOpen(true); setAiError(null) }}
                type="button"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.10))',
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
                <span>✨ Draft items with AI from a brief</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, opacity: 0.7 }}>local LLM</span>
              </button>
            ) : (
              <div style={{ background: 'rgba(139,92,246,0.08)', border: '0.5px solid rgba(139,92,246,0.35)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>✨ Draft with AI</span>
                  <button onClick={() => { setAiOpen(false); setAiError(null) }} aria-label="Close" type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <IcX size={14} color="#8ea8c5" />
                  </button>
                </div>
                <textarea
                  value={aiBrief}
                  onChange={e => setAiBrief(e.target.value)}
                  placeholder="e.g. Single-storey rear extension, 25m², open-plan kitchen-diner. Foundations, blockwork, roof, 2 rooflights, internal finishes."
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
                  {aiBusy ? 'Drafting (10–30s)…' : 'Generate line items'}
                </button>
                <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5' }}>
                  AI suggests realistic UK construction line items. Always review prices and quantities before sending.
                </div>
              </div>
            )}
            {aiNotes && !aiOpen && (
              <div style={{ background: 'rgba(139,92,246,0.08)', border: '0.5px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: '8px 12px', fontFamily: SF, fontSize: 11, color: '#c4b5fd' }}>
                <span style={{ fontWeight: 700 }}>AI note: </span>{aiNotes}
              </div>
            )}

            <div>
              <label style={labelStyle}>Customer</label>
              <select value={form.customerId} onChange={e => {
                const customerId = e.target.value
                const c = customers.find(cu => cu.id === customerId)
                setForm(prev => ({ ...prev, customerId, customerName: c?.name || prev.customerName }))
              }} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Ad-hoc (type a name below) —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!form.customerId && (
                <input value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} placeholder="Customer name (ad-hoc)" style={{ ...inputStyle, marginTop: 6 }} />
              )}
            </div>

            <div>
              <label style={labelStyle}>Line items</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {form.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 70px 28px', gap: 4, alignItems: 'center' }}>
                    <input value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} placeholder="Description" style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
                    <input type="number" step="0.1" value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })} placeholder="Qty" style={{ ...inputStyle, padding: '8px 6px', fontSize: 12, textAlign: 'right' }} />
                    <select value={it.unit || 'item'} onChange={e => updateItem(idx, { unit: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', fontSize: 11, appearance: 'none' }}>
                      {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" step="0.01" value={it.unitPrice} onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) })} placeholder="£" style={{ ...inputStyle, padding: '8px 6px', fontSize: 12, textAlign: 'right' }} />
                    <button onClick={() => removeItem(idx)} disabled={form.items.length === 1} aria-label="Remove" style={{ background: 'none', border: 'none', padding: 2, cursor: form.items.length === 1 ? 'not-allowed' : 'pointer', opacity: form.items.length === 1 ? 0.3 : 1 }}>
                      <IcX size={14} color="#ef4444" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addItem} style={{ marginTop: 6, background: 'rgba(6,182,212,0.12)', border: '0.5px dashed rgba(6,182,212,0.4)', color: '#06b6d4', borderRadius: 8, padding: '6px 12px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                + Add line
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>VAT %</label>
                <input type="number" step="1" min="0" max="100" value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Valid until</label>
                <input type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 13, color: '#8ea8c5' }}>
                <span>Subtotal</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>£{totals.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 13, color: '#8ea8c5' }}>
                <span>VAT</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>£{totals.vatAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: 15, color: '#eef3fa', fontWeight: 700, marginTop: 4, paddingTop: 4, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                <span>Total</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>£{totals.total.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={create} disabled={saving || !form.title.trim() || (!form.customerId && !form.customerName.trim())} style={{ padding: '14px 0', borderRadius: 14, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Save draft</>}
            </button>
          </div>
        </div>
      )}

      {activeQuote && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveQuote(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700, letterSpacing: 0.5 }}>{activeQuote.number}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF, marginTop: 2 }}>{activeQuote.title}</h2>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>For: {activeQuote.customerName}</div>
              </div>
              <button onClick={() => setActiveQuote(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ background: '#1a2f4e', padding: 12, borderRadius: 10 }}>
              {(activeQuote.lineItems || []).map((li, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8, padding: '6px 0', borderBottom: i < activeQuote.lineItems.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div>
                    <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{li.description}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{li.quantity}{li.unit ? ` ${li.unit}` : ''} × £{li.unitPrice.toFixed(2)}</div>
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#eef3fa', fontWeight: 600, textAlign: 'right' }}>£{li.total.toFixed(2)}</div>
                </div>
              ))}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Row label="Subtotal" value={`£${activeQuote.subtotal.toFixed(2)}`} muted />
                <Row label={`VAT (${activeQuote.vatRate}%)`} value={`£${activeQuote.vatAmount.toFixed(2)}`} muted />
                <Row label="Total" value={`£${activeQuote.total.toFixed(2)}`} bold />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 9px', borderRadius: 99, background: `${STATUS_COLOR[activeQuote.status]}22`, color: STATUS_COLOR[activeQuote.status], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${STATUS_COLOR[activeQuote.status]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{STATUS_LABEL[activeQuote.status]}</span>
              {activeQuote.validUntil && <span style={{ padding: '3px 9px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#8ea8c5', fontFamily: SF, fontSize: 10 }}>Valid until {new Date(activeQuote.validUntil).toLocaleDateString('en-GB')}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <button onClick={() => sendByEmail(activeQuote)} style={{ ...statusBtn('#06b6d4'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <IcSend size={12} color="#fff" /> {activeQuote.status === 'draft' ? 'Send (mark sent)' : 'Email again'}
              </button>
              {activeQuote.status === 'sent' && (
                <>
                  <button onClick={() => changeStatus(activeQuote, 'accepted')} style={statusBtn('#22c55e')}>Mark accepted</button>
                  <button onClick={() => changeStatus(activeQuote, 'rejected')} style={statusBtn('#ef4444')}>Mark rejected</button>
                </>
              )}
              {(activeQuote.status === 'accepted' || activeQuote.status === 'rejected') && (
                <button onClick={() => changeStatus(activeQuote, 'sent')} style={statusBtn('#52749a')}>Reopen as sent</button>
              )}
              {activeQuote.status !== 'draft' && (
                <button onClick={() => changeStatus(activeQuote, 'draft')} style={statusBtn('#52749a')}>Revert to draft</button>
              )}
            </div>

            <button onClick={() => remove(activeQuote.id)} style={{ padding: '10px', borderRadius: 10, background: confirmDelete === activeQuote.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeQuote.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" />
              {confirmDelete === activeQuote.id ? 'Sure?' : 'Delete quote'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SF, fontSize: bold ? 15 : 13, color: bold ? '#eef3fa' : muted ? '#8ea8c5' : '#eef3fa', fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span><span style={{ fontFamily: 'ui-monospace, monospace' }}>{value}</span>
    </div>
  )
}

const statusBtn = (color: string): React.CSSProperties => ({
  padding: '10px', borderRadius: 10, background: `${color}22`, border: `0.5px solid ${color}66`, color, fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
})
const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcDoc, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type LineItem = { description: string; quantity: number; unit?: string; unitPrice?: number; total?: number }
type Supplier = { id: string; name: string; category: string; contactEmail?: string | null; paymentTerms?: string | null }
type Quote = {
  id: string
  supplierId: string
  status: 'received' | 'awarded' | 'not_selected' | 'withdrawn'
  reference: string | null
  lineItems: LineItem[]
  netAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  leadDays: number | null
  validUntil: string | null
  notes: string | null
  supplier: Supplier
}
type Comparison = {
  id: string
  supplierId: string
  supplierName: string
  netAmount: number
  totalAmount: number
  leadDays: number | null
  status: string
  varianceFromLowest: number | null
  pctAboveLowest: number
  fastestLead: boolean
}
type Rfq = {
  id: string
  reference: string
  status: 'draft' | 'sent' | 'awarded' | 'closed' | 'cancelled'
  dueAt: string | null
  notes: string | null
  supplierIds: string[]
  invitedSuppliers: Supplier[]
  quotes: Quote[]
  comparison: Comparison[]
  requisition: {
    id: string
    number: string
    status: string
    lineItems: LineItem[]
    estimatedNet: number
    project: { id: string; name: string }
    costCode?: { id: string; code: string; name: string } | null
    purchaseOrder?: { id: string; number: string; status: string; total: number } | null
  }
}

const SF = 'var(--font-system)'
const RFQ_META: Record<Rfq['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#52749a' },
  sent: { label: 'Open', color: '#f59e0b' },
  awarded: { label: 'Awarded', color: '#22c55e' },
  closed: { label: 'Closed', color: '#06b6d4' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
}

export default function RfqsPage() {
  const router = useRouter()
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Rfq['status']>('all')
  const [quoteFor, setQuoteFor] = useState<{ rfq: Rfq; supplier: Supplier } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [quoteForm, setQuoteForm] = useState({
    reference: '', vatRate: '20', leadDays: '', validUntil: '', notes: '', prices: [] as string[],
  })

  useModalEffects(quoteFor !== null, () => setQuoteFor(null))

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rfqs')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load RFQs')
      setRfqs(data.rfqs || [])
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to load', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openQuote = (rfq: Rfq, supplier: Supplier) => {
    const existing = rfq.quotes.find(quote => quote.supplierId === supplier.id)
    setQuoteFor({ rfq, supplier })
    setQuoteForm({
      reference: existing?.reference || '',
      vatRate: String(existing?.vatRate ?? 20),
      leadDays: existing?.leadDays === null || existing?.leadDays === undefined ? '' : String(existing.leadDays),
      validUntil: existing?.validUntil ? new Date(existing.validUntil).toISOString().slice(0, 10) : '',
      notes: existing?.notes || '',
      prices: rfq.requisition.lineItems.map((_, index) => String(existing?.lineItems?.[index]?.unitPrice || '')),
    })
  }

  const updatePrice = (index: number, value: string) => {
    setQuoteForm(previous => ({
      ...previous,
      prices: previous.prices.map((price, i) => i === index ? value : price),
    }))
  }

  const saveQuote = async () => {
    if (!quoteFor) return
    if (quoteForm.prices.some(value => !Number.isFinite(Number(value)) || Number(value) <= 0)) {
      return setToast({ msg: 'Enter a positive price for every line', type: 'error' })
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/rfqs/${quoteFor.rfq.id}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: quoteFor.supplier.id,
          reference: quoteForm.reference || null,
          vatRate: Number(quoteForm.vatRate),
          leadDays: quoteForm.leadDays === '' ? null : Number(quoteForm.leadDays),
          validUntil: quoteForm.validUntil || null,
          notes: quoteForm.notes || null,
          lineItems: quoteForm.prices.map(unitPrice => ({ unitPrice: Number(unitPrice) })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to record quote')
      setQuoteFor(null)
      setToast({ msg: `${quoteFor.supplier.name} quote recorded` })
      load()
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Quote failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const award = async (rfq: Rfq, quote: Quote) => {
    const confirmed = window.confirm(`Award ${rfq.reference} to ${quote.supplier.name} for £${quote.totalAmount.toFixed(2)} including VAT?`)
    if (!confirmed) return
    setSaving(true)
    try {
      const res = await fetch(`/api/rfqs/${rfq.id}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Award failed')
      setToast({ msg: `${data.purchaseOrder.number} created` })
      await load()
      router.push('/pos')
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Award failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const filtered = filter === 'all' ? rfqs : rfqs.filter(rfq => rfq.status === filter)

  return (
    <div style={{ minHeight: '100dvh', background: '#06101e', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <header style={headerStyle}>
        <Link href="/apps" style={backStyle}><IcChevL size={18} color="#52749a" /> Apps</Link>
        <h1 style={titleStyle}><IcDoc size={20} color="#8b5cf6" /> RFQ comparison</h1>
        <p style={subStyle}>{rfqs.length} RFQs · compare price and lead time without automatic award</p>
        <ProcurementNav />
      </header>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'sent', 'awarded', 'closed', 'cancelled'] as const).map(value => (
          <button key={value} onClick={() => setFilter(value)} style={filterButton(filter === value)}>
            {value === 'all' ? 'All' : RFQ_META[value].label}
          </button>
        ))}
      </div>

      {loading ? <Empty text="Loading RFQs…" /> : filtered.length === 0 ? <Empty text="No RFQs in this view." /> : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(rfq => {
            const meta = RFQ_META[rfq.status]
            const comparison = new Map((rfq.comparison || []).map(row => [row.id, row]))
            return (
              <article key={rfq.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={mono}>{rfq.reference}</span>
                      <span style={statusPill(meta.color)}>{meta.label}</span>
                      <span style={{ ...mono, color: '#52749a' }}>{rfq.requisition.number}</span>
                    </div>
                    <div style={{ marginTop: 5, fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#eef3fa' }}>{rfq.requisition.project.name}</div>
                    <div style={{ marginTop: 3, fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>
                      {rfq.invitedSuppliers.length} invited · {rfq.quotes.length} quote{rfq.quotes.length === 1 ? '' : 's'}
                      {rfq.dueAt ? ` · due ${new Date(rfq.dueAt).toLocaleDateString('en-GB')}` : ''}
                    </div>
                  </div>
                  {rfq.requisition.purchaseOrder && (
                    <Link href="/pos" style={{ ...actionBtn('#22c55e'), textDecoration: 'none', alignSelf: 'flex-start' }}>{rfq.requisition.purchaseOrder.number}</Link>
                  )}
                </div>

                <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {rfq.invitedSuppliers.map(supplier => {
                    const quote = rfq.quotes.find(row => row.supplierId === supplier.id)
                    const compare = quote ? comparison.get(quote.id) : undefined
                    return (
                      <div key={supplier.id} style={{ background: '#1a2f4e', borderRadius: 10, padding: 10, border: quote?.status === 'awarded' ? '1px solid rgba(34,197,94,.5)' : '0.5px solid rgba(255,255,255,.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: '#eef3fa' }}>{supplier.name}</div>
                            <div style={{ marginTop: 2, fontFamily: SF, fontSize: 10, color: '#52749a' }}>
                              {supplier.paymentTerms || supplier.category}
                            </div>
                          </div>
                          {!quote && rfq.status === 'sent' && <button onClick={() => openQuote(rfq, supplier)} style={actionBtn('#8b5cf6')}>Enter quote</button>}
                          {quote && rfq.status === 'sent' && quote.status === 'received' && <button onClick={() => openQuote(rfq, supplier)} style={actionBtn('#52749a')}>Edit</button>}
                        </div>

                        {quote && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                              <Metric label="Net" value={`£${quote.netAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
                              <Metric label="Lead" value={quote.leadDays === null ? '—' : `${quote.leadDays}d`} />
                              <Metric label="Status" value={quote.status.replace('_', ' ')} />
                            </div>
                            {compare && (
                              <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {compare.varianceFromLowest === 0
                                  ? <span style={factPill('#22c55e')}>Lowest net price</span>
                                  : compare.varianceFromLowest !== null
                                    ? <span style={factPill('#f59e0b')}>+£{compare.varianceFromLowest.toFixed(2)} ({compare.pctAboveLowest}%)</span>
                                    : null}
                                {compare.fastestLead && <span style={factPill('#38bdf8')}>Fastest quoted lead</span>}
                              </div>
                            )}
                            {rfq.status === 'sent' && quote.status === 'received' && (
                              <button onClick={() => award(rfq, quote)} disabled={saving} style={{ ...actionBtn('#22c55e'), marginTop: 8 }}>Award & create PO</button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <TabBar />

      {quoteFor && (
        <Modal title={`${quoteFor.rfq.reference} · ${quoteFor.supplier.name}`} close={() => setQuoteFor(null)}>
          <label style={labelStyle}>Supplier quote reference</label>
          <input value={quoteForm.reference} onChange={e => setQuoteForm(v => ({ ...v, reference: e.target.value }))} style={inputStyle} placeholder="e.g. Q-1042" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>VAT %</label>
              <input type="number" min="0" max="100" step="0.1" value={quoteForm.vatRate} onChange={e => setQuoteForm(v => ({ ...v, vatRate: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Lead days</label>
              <input type="number" min="0" step="1" value={quoteForm.leadDays} onChange={e => setQuoteForm(v => ({ ...v, leadDays: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <label style={labelStyle}>Valid until</label>
          <input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm(v => ({ ...v, validUntil: e.target.value }))} style={inputStyle} />

          <label style={labelStyle}>Price each requisition line</label>
          {quoteFor.rfq.requisition.lineItems.map((line, index) => (
            <div key={index} style={{ background: '#152641', padding: 10, borderRadius: 9 }}>
              <div style={{ fontFamily: SF, fontSize: 12, color: '#eef3fa', fontWeight: 700 }}>{line.description}</div>
              <div style={{ marginTop: 2, fontFamily: SF, fontSize: 10, color: '#52749a' }}>{line.quantity} {line.unit || 'item'}</div>
              <input type="number" min="0.01" step="0.01" value={quoteForm.prices[index] || ''} onChange={e => updatePrice(index, e.target.value)} placeholder="Unit price £" style={{ ...inputStyle, marginTop: 7 }} />
            </div>
          ))}
          <label style={labelStyle}>Notes</label>
          <textarea rows={2} value={quoteForm.notes} onChange={e => setQuoteForm(v => ({ ...v, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={saveQuote} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Save supplier quote'}</button>
        </Modal>
      )}
    </div>
  )
}

function ProcurementNav() {
  return (
    <nav style={{ display: 'flex', gap: 6, marginTop: 12 }}>
      <Link href="/requisitions" style={navLink(false)}>Requisitions</Link>
      <Link href="/rfqs" style={navLink(true)}>RFQs</Link>
      <Link href="/pos" style={navLink(false)}>POs</Link>
    </nav>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 8, padding: 7 }}>
      <div style={{ fontFamily: SF, fontSize: 9, color: '#52749a', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 2, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#eef3fa' }}>{value}</div>
    </div>
  )
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.58)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '88vh', overflowY: 'auto', background: '#0a1426', borderRadius: '20px 20px 0 0', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#eef3fa', fontFamily: SF, fontSize: 17 }}>{title}</h2>
          <button onClick={close} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><IcX size={19} color="#52749a" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 50, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 13 }}>{text}</div>
}

const headerStyle: React.CSSProperties = { padding: '20px 16px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,.96)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,.07)' }
const backStyle: React.CSSProperties = { display: 'flex', gap: 4, alignItems: 'center', marginBottom: 9, color: '#52749a', textDecoration: 'none', fontFamily: SF, fontSize: 12 }
const titleStyle: React.CSSProperties = { margin: 0, display: 'flex', gap: 7, alignItems: 'center', color: '#eef3fa', fontFamily: SF, fontSize: 21 }
const subStyle: React.CSSProperties = { margin: '3px 0 0', color: '#52749a', fontFamily: SF, fontSize: 11 }
const cardStyle: React.CSSProperties = { background: '#152641', border: '0.5px solid rgba(255,255,255,.08)', borderRadius: 13, padding: 13 }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#8ea8c5', fontWeight: 700 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#1a2f4e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '9px 10px', color: '#eef3fa', fontFamily: SF, fontSize: 12, outline: 'none' }
const labelStyle: React.CSSProperties = { marginTop: 3, fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 700 }
const primaryBtn: React.CSSProperties = { background: '#8b5cf6', border: 0, borderRadius: 10, padding: 11, color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const actionBtn = (color: string): React.CSSProperties => ({ background: color + '20', color, border: `0.5px solid ${color}66`, borderRadius: 8, padding: '6px 9px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer' })
const statusPill = (color: string): React.CSSProperties => ({ background: color + '22', color, border: `0.5px solid ${color}55`, borderRadius: 99, padding: '2px 7px', fontFamily: SF, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' })
const factPill = (color: string): React.CSSProperties => ({ background: color + '18', color, borderRadius: 99, padding: '3px 7px', fontFamily: SF, fontSize: 9, fontWeight: 700 })
const filterButton = (active: boolean): React.CSSProperties => ({ flexShrink: 0, background: active ? '#8b5cf6' : '#152641', color: active ? '#fff' : '#8ea8c5', border: 0, borderRadius: 99, padding: '6px 11px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const navLink = (active: boolean): React.CSSProperties => ({ flex: 1, textAlign: 'center', textDecoration: 'none', borderRadius: 8, padding: '6px 8px', fontFamily: SF, fontSize: 11, fontWeight: 700, background: active ? '#8b5cf6' : '#152641', color: active ? '#fff' : '#8ea8c5' })

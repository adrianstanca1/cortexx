'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcDoc, IcPlus, IcX } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type LineItem = { description: string; quantity: number; unit: string; unitPrice: number; total: number }
type Project = { id: string; name: string }
type CostCode = { id: string; code: string; name: string }
type Supplier = { id: string; name: string; category: string; contactEmail?: string | null }
type Requisition = {
  id: string
  number: string
  projectId: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'rfq_open' | 'converted' | 'cancelled'
  lineItems: LineItem[]
  estimatedNet: number
  neededBy: string | null
  requestedBy: string | null
  notes: string | null
  project: Project
  costCode?: CostCode | null
  rfqs?: Array<{ id: string; reference: string; status: string; dueAt: string | null; _count?: { quotes: number } }>
  purchaseOrder?: { id: string; number: string; status: string; total: number } | null
}

const SF = 'var(--font-system)'
const UNITS = ['item', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'day']
const STATUS: Record<Requisition['status'], { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#52749a' },
  submitted: { label: 'Approval', color: '#a78bfa' },
  approved: { label: 'Approved', color: '#38bdf8' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  rfq_open: { label: 'RFQ open', color: '#f59e0b' },
  converted: { label: 'Converted', color: '#22c55e' },
  cancelled: { label: 'Cancelled', color: '#64748b' },
}
const blankItem = (): LineItem => ({ description: '', quantity: 1, unit: 'item', unitPrice: 0, total: 0 })

export default function RequisitionsPage() {
  const router = useRouter()
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [costCodes, setCostCodes] = useState<CostCode[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [rfqFor, setRfqFor] = useState<Requisition | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [filter, setFilter] = useState<'all' | Requisition['status']>('all')
  const [form, setForm] = useState({
    projectId: '', costCodeId: '', neededBy: '', notes: '', items: [blankItem()],
  })
  const [rfqForm, setRfqForm] = useState({ supplierIds: [] as string[], dueAt: '', notes: '' })

  useModalEffects(showAdd || rfqFor !== null, () => { setShowAdd(false); setRfqFor(null) })

  const load = useCallback(async () => {
    try {
      const [reqRes, projectRes, codeRes, supplierRes] = await Promise.all([
        fetch('/api/requisitions'),
        fetch('/api/projects'),
        fetch('/api/cost-codes'),
        fetch('/api/suppliers'),
      ])
      if (!reqRes.ok) throw new Error('Failed to load requisitions')
      const [reqData, projectData, codeData, supplierData] = await Promise.all([
        reqRes.json() as Promise<{ requisitions?: Requisition[] }>,
        projectRes.ok ? projectRes.json() as Promise<{ projects?: Project[] }> : Promise.resolve({ projects: [] as Project[] }),
        codeRes.ok ? codeRes.json() as Promise<{ codes?: CostCode[] }> : Promise.resolve({ codes: [] as CostCode[] }),
        supplierRes.ok ? supplierRes.json() as Promise<{ suppliers?: Supplier[] }> : Promise.resolve({ suppliers: [] as Supplier[] }),
      ])
      setRequisitions(reqData.requisitions || [])
      setProjects(projectData.projects || [])
      setCostCodes(codeData.codes || [])
      setSuppliers(supplierData.suppliers || [])
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Failed to load', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setForm(previous => ({
      ...previous,
      items: previous.items.map((item, i) => {
        if (i !== index) return item
        const next = { ...item, ...patch }
        next.total = (Number(next.quantity) || 0) * (Number(next.unitPrice) || 0)
        return next
      }),
    }))
  }

  const create = async () => {
    if (!form.projectId) return setToast({ msg: 'Select a project', type: 'error' })
    const lines = form.items.filter(item => item.description.trim())
    if (!lines.length) return setToast({ msg: 'Add at least one item', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: form.projectId,
          costCodeId: form.costCodeId || null,
          neededBy: form.neededBy || null,
          notes: form.notes || null,
          lineItems: lines,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to create requisition')
      setShowAdd(false)
      setForm({ projectId: '', costCodeId: '', neededBy: '', notes: '', items: [blankItem()] })
      setToast({ msg: `${data.number} created` })
      load()
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Create failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (requisition: Requisition, status: Requisition['status']) => {
    const body: Record<string, unknown> = { status }
    if (status === 'rejected') {
      const reason = window.prompt('Reason for rejection', '')
      if (reason === null) return
      body.rejectionReason = reason
    }
    try {
      const res = await fetch(`/api/requisitions/${requisition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Status update failed')
      setToast({ msg: `${requisition.number} · ${STATUS[status].label}` })
      load()
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'Status update failed', type: 'error' })
    }
  }

  const openRfq = (requisition: Requisition) => {
    setRfqFor(requisition)
    setRfqForm({ supplierIds: [], dueAt: '', notes: '' })
  }

  const toggleSupplier = (id: string) => {
    setRfqForm(previous => ({
      ...previous,
      supplierIds: previous.supplierIds.includes(id)
        ? previous.supplierIds.filter(value => value !== id)
        : [...previous.supplierIds, id],
    }))
  }

  const issueRfq = async () => {
    if (!rfqFor || !rfqForm.supplierIds.length) return setToast({ msg: 'Select at least one supplier', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch(`/api/requisitions/${rfqFor.id}/rfq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfqForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to issue RFQ')
      setRfqFor(null)
      setToast({ msg: `${data.rfq.reference} issued` })
      router.push('/rfqs')
    } catch (error) {
      setToast({ msg: error instanceof Error ? error.message : 'RFQ failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const filtered = filter === 'all' ? requisitions : requisitions.filter(row => row.status === filter)

  return (
    <div style={{ minHeight: '100dvh', background: '#06101e', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <header style={headerStyle}>
        <Link href="/apps" style={backStyle}><IcChevL size={18} color="#52749a" /> Apps</Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={titleStyle}><IcDoc size={20} color="#f59e0b" /> Requisitions</h1>
            <p style={subStyle}>{requisitions.length} total · request → approval → RFQ</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={primaryIconBtn} aria-label="New requisition"><IcPlus size={18} color="#fff" /></button>
        </div>
        <ProcurementNav active="requisitions" />
      </header>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'draft', 'submitted', 'approved', 'rfq_open', 'converted', 'rejected'] as const).map(value => (
          <button key={value} onClick={() => setFilter(value)} style={filterButton(filter === value)}>
            {value === 'all' ? 'All' : STATUS[value].label}
          </button>
        ))}
      </div>

      {loading ? <Empty text="Loading requisitions…" /> : filtered.length === 0 ? <Empty text="No requisitions in this view." /> : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {filtered.map(row => {
            const meta = STATUS[row.status]
            return (
              <article key={row.id} style={cardStyle}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={monoSmall}>{row.number}</span>
                      <span style={statusPill(meta.color)}>{meta.label}</span>
                      {row.costCode && <span style={{ ...monoSmall, color: '#f59e0b' }}>{row.costCode.code}</span>}
                    </div>
                    <div style={{ marginTop: 5, fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#eef3fa' }}>{row.project.name}</div>
                    <div style={{ marginTop: 3, fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>
                      {(row.lineItems || []).length} item{row.lineItems?.length === 1 ? '' : 's'} · estimate £{row.estimatedNet.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      {row.neededBy ? ` · needed ${new Date(row.neededBy).toLocaleDateString('en-GB')}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 9, borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {row.status === 'draft' && <button onClick={() => changeStatus(row, 'submitted')} style={actionBtn('#a78bfa')}>Submit</button>}
                  {row.status === 'rejected' && <button onClick={() => changeStatus(row, 'submitted')} style={actionBtn('#a78bfa')}>Resubmit</button>}
                  {row.status === 'submitted' && <button onClick={() => changeStatus(row, 'approved')} style={actionBtn('#38bdf8')}>Approve</button>}
                  {row.status === 'submitted' && <button onClick={() => changeStatus(row, 'rejected')} style={actionBtn('#ef4444')}>Reject</button>}
                  {row.status === 'approved' && <button onClick={() => openRfq(row)} style={actionBtn('#f59e0b')}>Create RFQ</button>}
                  {row.rfqs?.length ? <Link href="/rfqs" style={{ ...actionBtn('#8b5cf6'), textDecoration: 'none' }}>RFQs {row.rfqs.length}</Link> : null}
                  {row.purchaseOrder && <Link href="/pos" style={{ ...actionBtn('#22c55e'), textDecoration: 'none' }}>{row.purchaseOrder.number}</Link>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <Modal title="New requisition" close={() => setShowAdd(false)}>
          <label style={labelStyle}>Project *</label>
          <select value={form.projectId} onChange={e => setForm(v => ({ ...v, projectId: e.target.value }))} style={inputStyle}>
            <option value="">Select project</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <label style={labelStyle}>Cost code</label>
          <select value={form.costCodeId} onChange={e => setForm(v => ({ ...v, costCodeId: e.target.value }))} style={inputStyle}>
            <option value="">Uncoded</option>
            {costCodes.map(code => <option key={code.id} value={code.id}>{code.code} · {code.name}</option>)}
          </select>
          <label style={labelStyle}>Needed by</label>
          <input type="date" value={form.neededBy} onChange={e => setForm(v => ({ ...v, neededBy: e.target.value }))} style={inputStyle} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Items</label>
            <button onClick={() => setForm(v => ({ ...v, items: [...v.items, blankItem()] }))} style={smallBtn}>+ Item</button>
          </div>
          {form.items.map((item, index) => (
            <div key={index} style={{ background: '#152641', borderRadius: 10, padding: 10, display: 'grid', gap: 7 }}>
              <input value={item.description} onChange={e => updateItem(index, { description: e.target.value })} placeholder="Description" style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })} style={inputStyle} />
                <select value={item.unit} onChange={e => updateItem(index, { unit: e.target.value })} style={inputStyle}>
                  {UNITS.map(unit => <option key={unit}>{unit}</option>)}
                </select>
                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, { unitPrice: Number(e.target.value) })} placeholder="Est. £" style={inputStyle} />
              </div>
              {form.items.length > 1 && <button onClick={() => setForm(v => ({ ...v, items: v.items.filter((_, i) => i !== index) }))} style={dangerTextBtn}>Remove</button>}
            </div>
          ))}
          <label style={labelStyle}>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={create} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Create requisition'}</button>
        </Modal>
      )}

      {rfqFor && (
        <Modal title={`Issue RFQ · ${rfqFor.number}`} close={() => setRfqFor(null)}>
          <p style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', margin: 0 }}>Select suppliers to invite. Quote comparison will remain factual; award is a manual Company Admin action.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {suppliers.map(supplier => (
              <label key={supplier.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#152641', padding: 10, borderRadius: 9, fontFamily: SF, fontSize: 12, color: '#eef3fa' }}>
                <input type="checkbox" checked={rfqForm.supplierIds.includes(supplier.id)} onChange={() => toggleSupplier(supplier.id)} />
                <span style={{ flex: 1 }}>{supplier.name}</span>
                <span style={{ color: '#52749a', fontSize: 10 }}>{supplier.category}</span>
              </label>
            ))}
          </div>
          <label style={labelStyle}>Quote due</label>
          <input type="date" value={rfqForm.dueAt} onChange={e => setRfqForm(v => ({ ...v, dueAt: e.target.value }))} style={inputStyle} />
          <label style={labelStyle}>RFQ notes</label>
          <textarea value={rfqForm.notes} onChange={e => setRfqForm(v => ({ ...v, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={issueRfq} disabled={saving} style={primaryBtn}>{saving ? 'Issuing…' : `Issue to ${rfqForm.supplierIds.length} supplier${rfqForm.supplierIds.length === 1 ? '' : 's'}`}</button>
        </Modal>
      )}
    </div>
  )
}

function ProcurementNav({ active }: { active: 'requisitions' | 'rfqs' | 'pos' }) {
  return (
    <nav style={{ display: 'flex', gap: 6, marginTop: 12 }}>
      {[
        ['/requisitions', 'Requisitions', 'requisitions'],
        ['/rfqs', 'RFQs', 'rfqs'],
        ['/pos', 'POs', 'pos'],
      ].map(([href, label, key]) => (
        <Link key={key} href={href} style={{
          flex: 1, textAlign: 'center', textDecoration: 'none', borderRadius: 8, padding: '6px 8px',
          fontFamily: SF, fontSize: 11, fontWeight: 700,
          background: active === key ? '#f59e0b' : '#152641',
          color: active === key ? '#fff' : '#8ea8c5',
        }}>{label}</Link>
      ))}
    </nav>
  )
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.58)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '88vh', overflowY: 'auto', background: '#0a1426', borderRadius: '20px 20px 0 0', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#eef3fa', fontFamily: SF, fontSize: 18 }}>{title}</h2>
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

const headerStyle: React.CSSProperties = { padding: '20px 16px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.96)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }
const backStyle: React.CSSProperties = { display: 'flex', gap: 4, alignItems: 'center', marginBottom: 9, color: '#52749a', textDecoration: 'none', fontFamily: SF, fontSize: 12 }
const titleStyle: React.CSSProperties = { margin: 0, display: 'flex', gap: 7, alignItems: 'center', color: '#eef3fa', fontFamily: SF, fontSize: 21 }
const subStyle: React.CSSProperties = { margin: '3px 0 0', color: '#52749a', fontFamily: SF, fontSize: 11 }
const cardStyle: React.CSSProperties = { background: '#152641', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 13, padding: 13 }
const monoSmall: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#8ea8c5', fontWeight: 700 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '9px 10px', color: '#eef3fa', fontFamily: SF, fontSize: 12, outline: 'none' }
const labelStyle: React.CSSProperties = { marginTop: 3, fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 700 }
const primaryBtn: React.CSSProperties = { background: '#f59e0b', border: 0, borderRadius: 10, padding: 11, color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const primaryIconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const smallBtn: React.CSSProperties = { background: '#1a2f4e', border: '0.5px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '5px 9px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }
const dangerTextBtn: React.CSSProperties = { justifySelf: 'start', background: 'transparent', border: 0, color: '#fca5a5', fontFamily: SF, fontSize: 10, cursor: 'pointer' }
const actionBtn = (color: string): React.CSSProperties => ({ background: color + '20', color, border: `0.5px solid ${color}66`, borderRadius: 8, padding: '6px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' })
const statusPill = (color: string): React.CSSProperties => ({ background: color + '22', color, border: `0.5px solid ${color}55`, borderRadius: 99, padding: '2px 7px', fontFamily: SF, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' })
const filterButton = (active: boolean): React.CSSProperties => ({ flexShrink: 0, background: active ? '#f59e0b' : '#152641', color: active ? '#fff' : '#8ea8c5', border: 0, borderRadius: 99, padding: '6px 11px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' })

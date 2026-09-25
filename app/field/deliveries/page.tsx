'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcCheck, IcClock, IcDoc, IcTruck } from '@/components/ui/Icons'

type Project = { id: string; name: string }
type LineItem = { description: string; quantity: number; unit?: string; unitPrice: number; total: number }
type ReceiptLine = { lineIndex: number; quantity: number }
type DeliveryEvidence = { photoUrls?: string[]; signatureUrl?: string | null; signedBy?: string | null; condition?: string | null; storageLocation?: string | null }
type GoodsReceipt = { id: string; deliveredAt: string; deliveryNote?: string | null; receivedBy?: string | null; lineItems?: ReceiptLine[]; notes?: string | null; evidence?: DeliveryEvidence }
type PO = {
  id: string
  number: string
  projectId?: string | null
  supplier: string
  status: string
  lineItems: LineItem[]
  expectedDelivery?: string | null
  receivedAt?: string | null
  project?: Project | null
  goodsReceipts?: GoodsReceipt[]
}
type QtyMap = Record<number, string>

const SF = 'var(--font-system)'
const RECEIVABLE = new Set(['sent', 'part_received'])

export default function FieldDeliveriesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [pos, setPos] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState<PO | null>(null)
  const [qty, setQty] = useState<QtyMap>({})
  const [deliveryNote, setDeliveryNote] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signedBy, setSignedBy] = useState('')
  const [condition, setCondition] = useState('Good')
  const [storageLocation, setStorageLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [poRes, projectRes] = await Promise.all([
        fetch('/api/pos', { cache: 'no-store' }),
        fetch('/api/projects', { cache: 'no-store' }),
      ])
      const poData = poRes.ok ? await poRes.json() : { pos: [] }
      const projectData = projectRes.ok ? await projectRes.json() : { projects: [] }
      const nextProjects = (projectData.projects || []).map((p: Project) => ({ id: p.id, name: p.name }))
      setProjects(nextProjects)
      setPos(poData.pos || [])
      setProjectId(prev => prev || nextProjects[0]?.id || '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const projectPos = useMemo(
    () => pos.filter(po => !projectId || po.projectId === projectId || po.project?.id === projectId)
      .filter(po => ['sent', 'part_received', 'received'].includes(po.status)),
    [pos, projectId],
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const late = projectPos.filter(po => RECEIVABLE.has(po.status) && po.expectedDelivery && new Date(po.expectedDelivery).getTime() < today.getTime())
  const dueToday = projectPos.filter(po => RECEIVABLE.has(po.status) && po.expectedDelivery && sameDay(new Date(po.expectedDelivery), today))
  const open = projectPos.filter(po => RECEIVABLE.has(po.status))

  const receivedMap = (po: PO) => {
    const map = new Map<number, number>()
    for (const receipt of po.goodsReceipts || []) {
      for (const line of receipt.lineItems || []) {
        if (!Number.isInteger(Number(line.lineIndex))) continue
        const index = Number(line.lineIndex)
        map.set(index, (map.get(index) || 0) + (Number(line.quantity) || 0))
      }
    }
    return map
  }

  const beginReceive = (po: PO) => {
    const already = receivedMap(po)
    const initial: QtyMap = {}
    po.lineItems.forEach((line, index) => {
      const remaining = Math.max(0, Number(line.quantity || 0) - (already.get(index) || 0))
      initial[index] = remaining > 0 ? String(remaining) : '0'
    })
    setQty(initial)
    setDeliveryNote('')
    setNotes('')
    setPhotoFiles([])
    setSignatureFile(null)
    setSignedBy('')
    setCondition('Good')
    setStorageLocation('')
    setMessage('')
    setReceiving(po)
  }

  const uploadEvidenceFile = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/uploads', { method: 'POST', body: fd })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.url) throw new Error(body?.error || 'Evidence upload failed')
    return String(body.url)
  }

  const submitReceipt = async () => {
    if (!receiving || saving) return
    const already = receivedMap(receiving)
    const lines = receiving.lineItems.flatMap((line, index) => {
      const remaining = Math.max(0, Number(line.quantity || 0) - (already.get(index) || 0))
      const quantity = Number(qty[index] || 0)
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > remaining) return [{ invalid: true, lineIndex: index, quantity, remaining }]
      return quantity > 0 ? [{ lineIndex: index, quantity }] : []
    })
    const invalid = lines.find(line => 'invalid' in line)
    if (invalid && 'remaining' in invalid) {
      setMessage(`Quantity on line ${invalid.lineIndex + 1} must be between 0 and ${invalid.remaining}`)
      return
    }
    const lineItems = lines.filter((line): line is ReceiptLine => !('invalid' in line))
    if (!lineItems.length) {
      setMessage('Enter at least one received quantity.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const photoUrls: string[] = []
      for (const file of photoFiles.slice(0, 6)) photoUrls.push(await uploadEvidenceFile(file))
      const signatureUrl = signatureFile ? await uploadEvidenceFile(signatureFile) : null
      const res = await fetch(`/api/pos/${receiving.id}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems,
          deliveryNote: deliveryNote.trim() || null,
          notes: notes.trim() || null,
          deliveredAt: new Date().toISOString(),
          evidence: {
            photoUrls,
            signatureUrl,
            signedBy: signedBy.trim() || null,
            condition: condition.trim() || null,
            storageLocation: storageLocation.trim() || null,
          },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Failed to record delivery')
      setReceiving(null)
      setMessage('Delivery recorded')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to record delivery')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="module-page" style={{ minHeight: '100dvh', background: 'var(--bg0)', paddingBottom: 100 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, padding: '16px 18px 13px', background: 'rgba(6,16,30,.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <Link href="/field" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--t2)', textDecoration: 'none', fontFamily: SF, fontSize: 12 }}>
          <IcChevL size={15} color="var(--t2)" /> Field operations
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,.14)', display: 'grid', placeItems: 'center' }}>
            <IcTruck size={22} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ margin: 0, color: 'var(--t1)', fontFamily: SF, fontSize: 23, letterSpacing: '-.03em' }}>Site deliveries</h1>
            <p style={{ margin: '3px 0 0', color: 'var(--t2)', fontFamily: SF, fontSize: 11 }}>Expected materials, shortages and goods received.</p>
          </div>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={selectStyle}>
          {!projects.length && <option value="">No active project</option>}
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </header>

      <main style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          <Metric label="Open" value={open.length} color="#f59e0b" />
          <Metric label="Due today" value={dueToday.length} color="#06b6d4" />
          <Metric label="Late" value={late.length} color={late.length ? '#ef4444' : '#10b981'} />
        </div>

        {message && !receiving && (
          <div style={{ marginBottom: 12, padding: 11, borderRadius: 10, background: message === 'Delivery recorded' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.10)', color: message === 'Delivery recorded' ? '#10b981' : '#ef4444', fontFamily: SF, fontSize: 12 }}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={emptyStyle}>Loading deliveries…</div>
        ) : projectPos.length === 0 ? (
          <div style={emptyStyle}>
            <IcTruck size={26} color="var(--t3)" />
            <div style={{ marginTop: 9 }}>No sent purchase orders for this project.</div>
            <Link href="/pos" style={{ color: '#f59e0b', display: 'inline-block', marginTop: 10 }}>Open purchase orders</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projectPos.map(po => {
              const already = receivedMap(po)
              const remainingLines = po.lineItems.map((line, index) => ({
                ...line,
                index,
                received: already.get(index) || 0,
                remaining: Math.max(0, Number(line.quantity || 0) - (already.get(index) || 0)),
              }))
              const isLate = RECEIVABLE.has(po.status) && po.expectedDelivery && new Date(po.expectedDelivery).getTime() < today.getTime()
              const isOpen = RECEIVABLE.has(po.status)
              return (
                <section key={po.id} style={{ borderRadius: 14, background: 'var(--surface-strong)', border: `1px solid ${isLate ? 'rgba(239,68,68,.35)' : 'rgba(255,255,255,.07)'}`, overflow: 'hidden' }}>
                  <div style={{ padding: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ color: 'var(--t1)', fontFamily: SF, fontWeight: 900, fontSize: 14 }}>{po.number} · {po.supplier}</div>
                        <div style={{ color: isLate ? '#ef4444' : 'var(--t2)', fontFamily: SF, fontSize: 10.5, marginTop: 4 }}>
                          {po.expectedDelivery ? `${isLate ? 'Late · ' : ''}Expected ${new Date(po.expectedDelivery).toLocaleDateString('en-GB')}` : 'No expected delivery date'}
                        </div>
                      </div>
                      <span style={{ color: po.status === 'received' ? '#10b981' : '#f59e0b', fontFamily: SF, fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase' }}>{po.status.replaceAll('_', ' ')}</span>
                    </div>

                    <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {remainingLines.map(line => (
                        <div key={line.index} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 8px', borderRadius: 8, background: '#0b1a30' }}>
                          <span style={{ color: '#c8d7ea', fontFamily: SF, fontSize: 11, flex: 1 }}>{line.description}</span>
                          <span style={{ color: line.remaining > 0 ? '#fbbf24' : '#10b981', fontFamily: SF, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
                            {line.remaining > 0 ? `${line.remaining} ${line.unit || ''} left` : 'received'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {isOpen && (
                      <button type="button" onClick={() => beginReceive(po)} style={{ width: '100%', marginTop: 11, border: 'none', borderRadius: 10, padding: '11px 12px', background: '#f59e0b', color: 'var(--bg0)', fontFamily: SF, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                        Record goods received
                      </button>
                    )}
                  </div>

                  {(po.goodsReceipts || []).length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '9px 13px', color: 'var(--t2)', fontFamily: SF, fontSize: 10.5 }}>
                      <IcCheck size={12} color="#10b981" /> {(po.goodsReceipts || []).length} receipt{(po.goodsReceipts || []).length === 1 ? '' : 's'} logged
                      {(po.goodsReceipts || []).some(r => (r.evidence?.photoUrls || []).length > 0 || r.evidence?.signatureUrl || r.evidence?.signedBy) && <span style={{ color: '#8b5cf6' }}> · evidence attached</span>}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 16, borderRadius: 12, background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcDoc size={16} color="#8b5cf6" />
            <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 12, fontWeight: 800 }}>Commercial control stays linked</div>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--t2)', fontFamily: SF, fontSize: 10.5, lineHeight: 1.45 }}>
            Field receipts update the original purchase order and procurement audit trail. No duplicate delivery ledger is created.
          </p>
          <Link href="/pos" style={{ color: '#a78bfa', fontFamily: SF, fontSize: 11, fontWeight: 800, display: 'inline-block', marginTop: 8 }}>Open full procurement →</Link>
        </div>
      </main>

      {receiving && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(2,8,18,.78)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', maxHeight: '88dvh', overflowY: 'auto', background: 'var(--bg1)', borderRadius: '20px 20px 0 0', borderTop: '1px solid rgba(255,255,255,.1)', padding: '18px 16px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ color: 'var(--t1)', fontFamily: SF, fontSize: 18, fontWeight: 900 }}>Receive {receiving.number}</div>
                <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 11, marginTop: 3 }}>{receiving.supplier}</div>
              </div>
              <button type="button" onClick={() => setReceiving(null)} style={{ border: 'none', background: 'transparent', color: 'var(--t2)', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {receiving.lineItems.map((line, index) => {
              const already = receivedMap(receiving).get(index) || 0
              const remaining = Math.max(0, Number(line.quantity || 0) - already)
              if (remaining <= 0) return null
              return (
                <label key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10, alignItems: 'center', marginBottom: 9 }}>
                  <span>
                    <span style={{ display: 'block', color: 'var(--t1)', fontFamily: SF, fontSize: 12, fontWeight: 700 }}>{line.description}</span>
                    <span style={{ display: 'block', color: 'var(--t3)', fontFamily: SF, fontSize: 10, marginTop: 2 }}>{remaining} {line.unit || ''} outstanding</span>
                  </span>
                  <input type="number" min="0" max={remaining} step="any" value={qty[index] || ''} onChange={e => setQty(current => ({ ...current, [index]: e.target.value }))} style={inputStyle} />
                </label>
              )
            })}

            <label style={labelStyle}>Delivery note / reference<input value={deliveryNote} maxLength={160} onChange={e => setDeliveryNote(e.target.value)} placeholder="e.g. DN-38122" style={inputStyle} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <label style={labelStyle}>Condition<input value={condition} maxLength={120} onChange={e => setCondition(e.target.value)} placeholder="Good / damaged / wet…" style={inputStyle} /></label>
              <label style={labelStyle}>Storage location<input value={storageLocation} maxLength={160} onChange={e => setStorageLocation(e.target.value)} placeholder="Laydown area / Level 3" style={inputStyle} /></label>
            </div>
            <label style={labelStyle}>Delivery photos (max 6)
              <input type="file" accept="image/*" capture="environment" multiple onChange={e => setPhotoFiles(Array.from(e.target.files || []).slice(0,6))} style={{ ...inputStyle, padding: 8 }} />
              {photoFiles.length > 0 && <span style={{ color: '#10b981', marginTop: 3 }}>{photoFiles.length} photo{photoFiles.length === 1 ? '' : 's'} ready</span>}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <label style={labelStyle}>Signed by<input value={signedBy} maxLength={120} onChange={e => setSignedBy(e.target.value)} placeholder="Name receiving / checking delivery" style={inputStyle} /></label>
              <label style={labelStyle}>Signed-note photo
                <input type="file" accept="image/*" capture="environment" onChange={e => setSignatureFile(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: 8 }} />
              </label>
            </div>
            <label style={labelStyle}>Shortages / damage / notes<textarea value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Damaged packs, missing items, quarantine instructions…" style={{ ...inputStyle, resize: 'vertical' }} /></label>

            {message && <div style={{ color: '#ef4444', fontFamily: SF, fontSize: 11, marginBottom: 9 }}>{message}</div>}
            <button type="button" disabled={saving} onClick={submitReceipt} style={{ width: '100%', border: 'none', borderRadius: 11, padding: '12px 14px', background: '#10b981', color: 'var(--bg0)', fontFamily: SF, fontSize: 12, fontWeight: 900, opacity: saving ? .6 : 1, cursor: 'pointer' }}>
              {saving ? 'Recording…' : 'Confirm goods received'}
            </button>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ borderRadius: 11, background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)', padding: 10 }}>
      <div style={{ color, fontFamily: SF, fontSize: 20, fontWeight: 900 }}>{value}</div>
      <div style={{ color: 'var(--t2)', fontFamily: SF, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  marginTop: 13, width: '100%', boxSizing: 'border-box', borderRadius: 11,
  border: '1px solid rgba(255,255,255,.09)', background: 'var(--surface-strong)', color: 'var(--t1)',
  padding: '11px 12px', fontFamily: SF, fontSize: 13,
}
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', borderRadius: 9, border: '1px solid rgba(255,255,255,.09)',
  background: 'var(--surface-strong)', color: 'var(--t1)', padding: '10px 11px', fontFamily: SF, fontSize: 12,
}
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--t2)', fontFamily: SF,
  fontSize: 10.5, fontWeight: 800, marginTop: 10,
}
const emptyStyle: React.CSSProperties = {
  padding: '32px 18px', borderRadius: 13, background: 'var(--surface-strong)', border: '1px solid rgba(255,255,255,.07)',
  color: 'var(--t2)', textAlign: 'center', fontFamily: SF, fontSize: 12,
}

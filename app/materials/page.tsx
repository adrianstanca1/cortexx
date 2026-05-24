'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcWrench, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSearch, IcAlert } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Material {
  id: string
  name: string
  code: string | null
  category: string | null
  unit: string
  unitCost: number
  stockLevel: number
  reorderPoint: number
  supplier: string | null
  location: string | null
  notes: string | null
  archivedAt: string | null
}

const SF = 'var(--font-system)'
const UNITS = ['item', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'pack', 'roll', 'sheet']

export default function MaterialsPage() {
  const [items, setItems] = useState<Material[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeItem, setActiveItem] = useState<Material | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [form, setForm] = useState({ name: '', code: '', category: '', unit: 'item', unitCost: '', stockLevel: '', reorderPoint: '', supplier: '', location: '' })

  useModalEffects(showAdd || activeItem !== null, () => { setShowAdd(false); setActiveItem(null); setAdjustingId(null) })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (activeCat) params.set('category', activeCat)
    if (search.trim()) params.set('search', search.trim())
    if (lowStockOnly) params.set('lowStock', 'true')
    fetch(`/api/materials?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setItems(d.materials || []); setCategories(d.categories || []); setLowStockCount(d.lowStockCount || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [activeCat, search, lowStockOnly])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || null,
          category: form.category.trim() || null,
          unit: form.unit,
          unitCost: form.unitCost === '' ? 0 : Number(form.unitCost),
          stockLevel: form.stockLevel === '' ? 0 : Number(form.stockLevel),
          reorderPoint: form.reorderPoint === '' ? 0 : Number(form.reorderPoint),
          supplier: form.supplier.trim() || null,
          location: form.location.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ name: '', code: '', category: '', unit: 'item', unitCost: '', stockLevel: '', reorderPoint: '', supplier: '', location: '' })
      load()
      setToast({ msg: 'Material added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const adjustStock = async (id: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustStock: delta }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activeItem?.id === id) setActiveItem(updated)
      setAdjustingId(null); setAdjustDelta('')
      load()
    } catch { setToast({ msg: 'Adjust failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveItem(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Materials</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {items.length} items{lowStockCount > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· {lowStockCount} low stock</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add material" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / code / supplier…" style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
          <div style={{ position: 'absolute', top: 12, left: 10, pointerEvents: 'none' }}><IcSearch size={14} color="#52749a" /></div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center', paddingBottom: 2 }}>
          <button onClick={() => setLowStockOnly(s => !s)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: lowStockOnly ? '#ef4444' : 'rgba(239,68,68,0.12)', color: lowStockOnly ? '#fff' : '#ef4444', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IcAlert size={11} color={lowStockOnly ? '#fff' : '#ef4444'} /> Low stock
          </button>
          <button onClick={() => setActiveCat(null)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: !activeCat ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: !activeCat ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: !activeCat ? 700 : 400, cursor: 'pointer' }}>All</button>
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCat(c)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: activeCat === c ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: activeCat === c ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: activeCat === c ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcWrench size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No materials</p>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add first</button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(it => {
            const low = it.reorderPoint > 0 && it.stockLevel <= it.reorderPoint
            return (
              <button key={it.id} onClick={() => setActiveItem(it)} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: `0.5px solid ${low ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{it.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                    {it.category || 'Uncategorised'}{it.supplier ? ` · ${it.supplier}` : ''}{it.location ? ` · ${it.location}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: low ? '#ef4444' : '#eef3fa', fontWeight: 700 }}>{it.stockLevel}{it.unit !== 'item' ? ` ${it.unit}` : ''}</div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a' }}>£{it.unitCost.toFixed(2)} / {it.unit}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Add material</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Name (e.g. 25mm OSB sheet)" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Code" style={inputStyle} />
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Category" list="mat-cats" style={inputStyle} />
              <datalist id="mat-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Cost £</label>
                <input type="number" step="0.01" value={form.unitCost} onChange={e => setForm(p => ({ ...p, unitCost: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Per</label>
                <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>In stock</label>
                <input type="number" step="0.1" value={form.stockLevel} onChange={e => setForm(p => ({ ...p, stockLevel: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Reorder at</label>
                <input type="number" step="0.1" value={form.reorderPoint} onChange={e => setForm(p => ({ ...p, reorderPoint: e.target.value }))} style={inputStyle} />
              </div>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (yard / van / site)" style={{ ...inputStyle, alignSelf: 'flex-end' }} />
            </div>
            <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} placeholder="Supplier" style={inputStyle} />
            <button onClick={save} disabled={saving || !form.name.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Add</>}
            </button>
          </div>
        </div>
      )}

      {activeItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>{activeItem.name}</h2>
                {activeItem.code && <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', marginTop: 2 }}>{activeItem.code}</div>}
              </div>
              <button onClick={() => setActiveItem(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: '#1a2f4e', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 2 }}>In stock</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: activeItem.reorderPoint > 0 && activeItem.stockLevel <= activeItem.reorderPoint ? '#ef4444' : '#eef3fa', fontWeight: 700 }}>
                  {activeItem.stockLevel} {activeItem.unit}
                </div>
                {activeItem.reorderPoint > 0 && (
                  <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 1 }}>Reorder ≤ {activeItem.reorderPoint}</div>
                )}
              </div>
              <div style={{ background: '#1a2f4e', padding: '10px 12px', borderRadius: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 2 }}>Unit cost</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: '#10b981', fontWeight: 700 }}>£{activeItem.unitCost.toFixed(2)}</div>
                <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 1 }}>per {activeItem.unit}</div>
              </div>
            </div>

            {adjustingId === activeItem.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#1a2f4e', padding: '8px 10px', borderRadius: 10 }}>
                <input autoFocus type="number" step="0.1" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} placeholder="±qty (e.g. -2)" style={{ ...inputStyle, padding: '6px 10px', fontSize: 13 }} />
                <button onClick={() => adjustStock(activeItem.id, Number(adjustDelta))} disabled={!adjustDelta} style={{ padding: '6px 10px', borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Apply</button>
                <button onClick={() => { setAdjustingId(null); setAdjustDelta('') }} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#52749a', fontFamily: SF, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setAdjustingId(activeItem.id); setAdjustDelta('-1') }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: '0.5px solid rgba(239,68,68,0.4)', color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>− Used</button>
                <button onClick={() => { setAdjustingId(activeItem.id); setAdjustDelta('1') }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '0.5px solid rgba(16,185,129,0.4)', color: '#10b981', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Received</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>
              {activeItem.supplier && <div><span style={{ color: '#52749a' }}>Supplier:</span> {activeItem.supplier}</div>}
              {activeItem.location && <div><span style={{ color: '#52749a' }}>Location:</span> {activeItem.location}</div>}
              {activeItem.category && <div><span style={{ color: '#52749a' }}>Category:</span> {activeItem.category}</div>}
              {activeItem.notes && <div style={{ marginTop: 6, padding: 10, background: '#1a2f4e', borderRadius: 8, whiteSpace: 'pre-wrap' }}>{activeItem.notes}</div>}
            </div>

            <button onClick={() => remove(activeItem.id)} style={{ marginTop: 6, padding: '10px', borderRadius: 10, background: confirmDelete === activeItem.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeItem.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" />
              {confirmDelete === activeItem.id ? 'Sure?' : 'Delete material'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcLayers, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSearch } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface CostItem {
  id: string
  code: string | null
  description: string
  category: string | null
  unit: string
  unitCost: number
  vendor: string | null
  notes: string | null
  archivedAt: string | null
}

const SF = 'var(--font-system)'
const UNITS = ['item', 'hour', 'day', 'm', 'm²', 'm³', 'kg', 'tonne', 'l', 'visit']

export default function CostCatalogPage() {
  const [items, setItems] = useState<CostItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CostItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '', description: '', category: '', unit: 'item', unitCost: '', vendor: '', notes: '',
  })

  useModalEffects(showAdd || editing !== null, () => { setShowAdd(false); setEditing(null) })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (activeCat) params.set('category', activeCat)
    if (search.trim()) params.set('search', search.trim())
    fetch(`/api/cost-catalog?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setItems(d.items || []); setCategories(d.categories || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [activeCat, search])
  useEffect(() => { load() }, [load])

  const openEdit = (item: CostItem) => {
    setEditing(item)
    setForm({
      code: item.code || '',
      description: item.description,
      category: item.category || '',
      unit: item.unit,
      unitCost: String(item.unitCost),
      vendor: item.vendor || '',
      notes: item.notes || '',
    })
  }

  const save = async () => {
    if (!form.description.trim()) return
    const unitCost = form.unitCost === '' ? 0 : Number(form.unitCost)
    if (isNaN(unitCost) || unitCost < 0) {
      setToast({ msg: 'Unit cost must be a number ≥ 0', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/cost-catalog/${editing.id}` : '/api/cost-catalog'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim() || null,
          description: form.description.trim(),
          category: form.category.trim() || null,
          unit: form.unit,
          unitCost,
          vendor: form.vendor.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false); setEditing(null)
      setForm({ code: '', description: '', category: '', unit: 'item', unitCost: '', vendor: '', notes: '' })
      load()
      setToast({ msg: editing ? 'Item updated' : 'Item added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/cost-catalog/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setEditing(null)
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  // Group by category
  const grouped: Record<string, CostItem[]> = {}
  for (const it of items) {
    const cat = it.category || 'Uncategorised'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(it)
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Cost catalog</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{items.length} items · {categories.length} categories</p>
          </div>
          <button onClick={() => { setEditing(null); setForm({ code: '', description: '', category: '', unit: 'item', unitCost: '', vendor: '', notes: '' }); setShowAdd(true) }} aria-label="Add item" style={{ width: 36, height: 36, borderRadius: 10, background: '#06b6d4', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search description / code / vendor…" style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
          <div style={{ position: 'absolute', top: 12, left: 10, pointerEvents: 'none' }}><IcSearch size={14} color="#52749a" /></div>
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => setActiveCat(null)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: !activeCat ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: !activeCat ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: !activeCat ? 700 : 400, cursor: 'pointer' }}>All</button>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCat(c)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: activeCat === c ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: activeCat === c ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: activeCat === c ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcLayers size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No items in the catalog</p>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Add first item
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingLeft: 4 }}>{cat} · {list.length}</div>
              <div style={{ background: '#152641', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {list.map((it, i) => (
                  <button key={it.id} onClick={() => openEdit(it)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < list.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{it.description}</div>
                      <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 1 }}>
                        {it.code && <><span style={{ fontFamily: 'ui-monospace, monospace' }}>{it.code}</span> · </>}
                        {it.vendor && <span>{it.vendor}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: '#eef3fa', fontWeight: 700 }}>£{it.unitCost.toFixed(2)}</div>
                      <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a' }}>per {it.unit}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {(showAdd || editing) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => { setShowAdd(false); setEditing(null) }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>{editing ? 'Edit item' : 'Add item'}</h2>
              <button onClick={() => { setShowAdd(false); setEditing(null) }} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Code (optional)" style={inputStyle} />
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Category" list="cost-categories" style={inputStyle} />
              <datalist id="cost-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Cost (£)</label>
                <input type="number" step="0.01" value={form.unitCost} onChange={e => setForm(p => ({ ...p, unitCost: e.target.value }))} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Per</label>
                <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor" style={{ ...inputStyle, alignSelf: 'flex-end' }} />
            </div>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />

            <div style={{ display: 'flex', gap: 8 }}>
              {editing && (
                <button onClick={() => remove(editing.id)} style={{ padding: '12px 14px', borderRadius: 10, background: confirmDelete === editing.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === editing.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IcTrash size={13} color="#ef4444" />
                  {confirmDelete === editing.id ? 'Sure?' : ''}
                </button>
              )}
              <button onClick={save} disabled={saving || !form.description.trim()} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.description.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {saving ? 'Saving…' : <><IcCheck size={15} color="#fff" /> {editing ? 'Save' : 'Add'}</>}
              </button>
            </div>
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

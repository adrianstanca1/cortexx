'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcTeam, IcChevL, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Supplier {
  id: string
  name: string
  category: 'materials' | 'plant' | 'services' | 'other'
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  postcode: string | null
  paymentTerms: string | null
  accountNumber: string | null
  notes: string | null
  archivedAt: string | null
}

const CATEGORY_LABEL: Record<Supplier['category'], string> = {
  materials: 'Materials', plant: 'Plant', services: 'Services', other: 'Other',
}
const CATEGORY_COLOR: Record<Supplier['category'], string> = {
  materials: '#f59e0b', plant: '#06b6d4', services: '#8b5cf6', other: '#52749a',
}
const SF = 'var(--font-system)'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | Supplier['category']>('all')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', category: 'materials' as Supplier['category'],
    contactName: '', contactEmail: '', contactPhone: '',
    address: '', postcode: '', paymentTerms: '', accountNumber: '', notes: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (includeArchived) params.set('includeArchived', '1')
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/suppliers?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load')
      const d = await res.json()
      setSuppliers(d.suppliers || [])
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [categoryFilter, includeArchived, search])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', category: 'materials', contactName: '', contactEmail: '', contactPhone: '', address: '', postcode: '', paymentTerms: '', accountNumber: '', notes: '' })
    setShowModal(true)
  }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({
      name: s.name, category: s.category,
      contactName: s.contactName || '', contactEmail: s.contactEmail || '', contactPhone: s.contactPhone || '',
      address: s.address || '', postcode: s.postcode || '',
      paymentTerms: s.paymentTerms || '', accountNumber: s.accountNumber || '', notes: s.notes || '',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return setToast({ msg: 'Name required', type: 'error' })
    setSaving(true)
    try {
      const url = editing ? `/api/suppliers/${editing.id}` : '/api/suppliers'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: editing ? 'Saved' : 'Supplier added', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const toggleArchive = async (s: Supplier) => {
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !s.archivedAt }) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IcTeam size={20} color="#8b5cf6" /> Suppliers
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {suppliers.filter(s => !s.archivedAt).length} active
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add supplier" style={{ background: '#8b5cf6', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Add</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'materials', 'plant', 'services', 'other'] as const).map(c => {
          const active = categoryFilter === c
          const color = c === 'all' ? '#8b5cf6' : CATEGORY_COLOR[c as Supplier['category']]
          return (
            <button key={c} onClick={() => setCategoryFilter(c)} style={{ background: active ? color : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: active ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
              {c === 'all' ? 'All' : CATEGORY_LABEL[c as Supplier['category']]}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or contact…" style={{ flex: 1, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: '#eef3fa', fontFamily: SF, fontSize: 13, outline: 'none' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: SF, fontSize: 12, color: '#8ea8c5', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} />
          Archived
        </label>
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && suppliers.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No suppliers yet. Add your first one.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {suppliers.map(s => (
          <div key={s.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, opacity: s.archivedAt ? 0.55 : 1 }}>
            <div onClick={() => openEdit(s)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ background: CATEGORY_COLOR[s.category] + '33', color: CATEGORY_COLOR[s.category], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{CATEGORY_LABEL[s.category]}</span>
                {s.archivedAt && <span style={{ color: '#52749a', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>ARCHIVED</span>}
                {s.paymentTerms && <span style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{s.paymentTerms}</span>}
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                {s.contactName || '—'}{s.postcode ? ` · ${s.postcode}` : ''}{s.accountNumber ? ` · A/C ${s.accountNumber}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {s.contactEmail && <a href={`mailto:${s.contactEmail}`} style={{ ...pillBtn('#1a2f4e', '#c1d2e8'), textDecoration: 'none' }}>Email</a>}
              {s.contactPhone && <a href={`tel:${s.contactPhone}`} style={{ ...pillBtn('#1a2f4e', '#c1d2e8'), textDecoration: 'none' }}>Call</a>}
              <button onClick={() => toggleArchive(s)} style={pillBtn('#1a2f4e', '#c1d2e8')}>{s.archivedAt ? 'Restore' : 'Archive'}</button>
              <button onClick={() => setConfirmDelete(s.id)} aria-label="Delete" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                <IcTrash size={11} color="#fca5a5" /> Delete
              </button>
            </div>
            {confirmDelete === s.id && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this supplier?</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => remove(s.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', width: '100%', maxHeight: '85vh', borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>{editing ? 'Edit supplier' : 'Add supplier'}</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Name *">
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Category">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(CATEGORY_LABEL) as Supplier['category'][]).map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))} style={{ background: form.category === c ? CATEGORY_COLOR[c] : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.category === c ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Contact name">
                  <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input type="tel" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Email">
                <input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} style={inputStyle} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <Field label="Address">
                  <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Postcode">
                  <input type="text" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Payment terms">
                  <input type="text" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} style={inputStyle} placeholder="Net 30" />
                </Field>
                <Field label="Account number">
                  <input type="text" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#8b5cf6', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <TabBar />
    </div>
  )
}

const inputStyle = { background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#eef3fa', fontFamily: SF, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600, marginBottom: 4 }}>{label}</label>{children}</div>
}
function pillBtn(bg: string, color = '#fff', borderColor = 'rgba(255,255,255,0.1)'): React.CSSProperties {
  return { background: bg, border: `0.5px solid ${borderColor}`, borderRadius: 8, padding: '6px 10px', color, fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }
}

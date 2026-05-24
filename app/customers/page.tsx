'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcTeam, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSearch, IcDoc } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Customer {
  id: string
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  postcode: string | null
  notes: string | null
  archivedAt: string | null
  createdAt: string
  _count?: { quotes: number }
}

const SF = 'var(--font-system)'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', contactName: '', contactEmail: '', contactPhone: '', address: '', postcode: '', notes: '',
  })

  useModalEffects(showAdd || activeCustomer !== null, () => { setShowAdd(false); setActiveCustomer(null) })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (showArchived) params.set('archived', 'true')
    if (search.trim()) params.set('search', search.trim())
    fetch(`/api/customers?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setCustomers(d.customers || []); setTotal(d.total || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [showArchived, search])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          address: form.address.trim() || null,
          postcode: form.postcode.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ name: '', contactName: '', contactEmail: '', contactPhone: '', address: '', postcode: '', notes: '' })
      load()
      setToast({ msg: 'Customer added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleArchive = async (c: Customer) => {
    try {
      const res = await fetch(`/api/customers/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !c.archivedAt }),
      })
      if (!res.ok) throw new Error('Failed')
      setActiveCustomer(null)
      load()
    } catch {
      setToast({ msg: 'Archive failed', type: 'error' })
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
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveCustomer(null)
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Customers</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {total} active · showing {customers.length}{showArchived ? ' (archived)' : ''}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add customer" style={{ width: 36, height: 36, borderRadius: 10, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <IcSearch size={14} color="#52749a" className="" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / contact / email…" style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
          <div style={{ position: 'absolute', top: 12, left: 10, pointerEvents: 'none' }}><IcSearch size={14} color="#52749a" /></div>
        </div>
        <button onClick={() => setShowArchived(s => !s)} style={{ background: showArchived ? 'rgba(255,255,255,0.1)' : 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: showArchived ? '#eef3fa' : '#52749a', borderRadius: 99, padding: '3px 12px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          {showArchived ? '← Active customers' : 'Show archived'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : customers.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcTeam size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{total === 0 ? 'No customers yet' : 'No matches'}</p>
          {total === 0 && !showArchived && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Add first customer
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {customers.map(c => (
            <button key={c.id} onClick={() => setActiveCustomer(c)} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', textAlign: 'left', opacity: c.archivedAt ? 0.5 : 1 }}>
              <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: '#2563eb22', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 14, fontWeight: 700 }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{c.name}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                  {c.contactName || '—'}{c.contactEmail ? ` · ${c.contactEmail}` : ''}
                </div>
              </div>
              {c._count && c._count.quotes > 0 && (
                <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IcDoc size={11} color="#52749a" /> {c._count.quotes}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Add customer</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Customer / company name" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} placeholder="Contact name" style={inputStyle} />
              <input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="Phone" style={inputStyle} />
            </div>
            <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="Email" style={inputStyle} />
            <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Address" style={inputStyle} />
            <input value={form.postcode} onChange={e => setForm(p => ({ ...p, postcode: e.target.value }))} placeholder="Postcode" style={inputStyle} />
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
            <button onClick={create} disabled={saving || !form.name.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Add</>}
            </button>
          </div>
        </div>
      )}

      {activeCustomer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveCustomer(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>{activeCustomer.name}</h2>
                {activeCustomer.archivedAt && <div style={{ fontFamily: SF, fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Archived</div>}
              </div>
              <button onClick={() => setActiveCustomer(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>
              {activeCustomer.contactName && <div><span style={{ color: '#52749a' }}>Contact:</span> {activeCustomer.contactName}</div>}
              {activeCustomer.contactEmail && <div><span style={{ color: '#52749a' }}>Email:</span> <a href={`mailto:${activeCustomer.contactEmail}`} style={{ color: '#60a5fa' }}>{activeCustomer.contactEmail}</a></div>}
              {activeCustomer.contactPhone && <div><span style={{ color: '#52749a' }}>Phone:</span> <a href={`tel:${activeCustomer.contactPhone}`} style={{ color: '#60a5fa' }}>{activeCustomer.contactPhone}</a></div>}
              {activeCustomer.address && <div><span style={{ color: '#52749a' }}>Address:</span> {activeCustomer.address}{activeCustomer.postcode ? `, ${activeCustomer.postcode}` : ''}</div>}
              {activeCustomer.notes && <div style={{ marginTop: 6, padding: 10, background: '#1a2f4e', borderRadius: 8, whiteSpace: 'pre-wrap' }}>{activeCustomer.notes}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Link href={`/quotes?customerId=${activeCustomer.id}`} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(139,92,246,0.18)', border: '0.5px solid rgba(139,92,246,0.4)', color: '#a78bfa', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <IcDoc size={12} color="#a78bfa" /> Quotes ({activeCustomer._count?.quotes || 0})
              </Link>
              <button onClick={() => toggleArchive(activeCustomer)} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#8ea8c5', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {activeCustomer.archivedAt ? 'Unarchive' : 'Archive'}
              </button>
              <button onClick={() => remove(activeCustomer.id)} style={{ padding: '10px 14px', borderRadius: 10, background: confirmDelete === activeCustomer.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeCustomer.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                <IcTrash size={12} color="#ef4444" />
                {confirmDelete === activeCustomer.id ? 'Sure?' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcWrench, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSearch, IcAlert } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type ServiceBucket = 'ok' | 'soon' | 'overdue' | 'none'
type Status = 'in_service' | 'in_yard' | 'in_service_centre' | 'out_of_service'
type Ownership = 'owned' | 'hired'

interface Equipment {
  id: string
  name: string
  code: string | null
  category: string | null
  serial: string | null
  ownership: Ownership
  hireCompany: string | null
  location: string | null
  status: Status
  lastServicedAt: string | null
  nextServiceAt: string | null
  notes: string | null
  archivedAt: string | null
  serviceBucket: ServiceBucket
}

const SF = 'var(--font-system)'
const STATUS_LABEL: Record<Status, string> = {
  in_service: 'In service',
  in_yard: 'In yard',
  in_service_centre: 'At service centre',
  out_of_service: 'Out of service',
}
const STATUS_COLOR: Record<Status, string> = {
  in_service: '#22c55e',
  in_yard: '#52749a',
  in_service_centre: '#f59e0b',
  out_of_service: '#ef4444',
}
const SERVICE_COLOR: Record<ServiceBucket, string> = { ok: '#22c55e', soon: '#f59e0b', overdue: '#ef4444', none: '#52749a' }

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([])
  const [alerts, setAlerts] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeItem, setActiveItem] = useState<Equipment | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', code: '', category: '', serial: '', ownership: 'owned' as Ownership, hireCompany: '', location: '', status: 'in_yard' as Status, lastServicedAt: '', nextServiceAt: '',
  })

  useModalEffects(showAdd || activeItem !== null, () => { setShowAdd(false); setActiveItem(null) })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (statusFilter !== 'all') params.set('status', statusFilter)
    fetch(`/api/equipment?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setItems(d.equipment || []); setAlerts(d.alerts || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [search, statusFilter])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || null,
          category: form.category.trim() || null,
          serial: form.serial.trim() || null,
          ownership: form.ownership,
          hireCompany: form.hireCompany.trim() || null,
          location: form.location.trim() || null,
          status: form.status,
          lastServicedAt: form.lastServicedAt || null,
          nextServiceAt: form.nextServiceAt || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ name: '', code: '', category: '', serial: '', ownership: 'owned', hireCompany: '', location: '', status: 'in_yard', lastServicedAt: '', nextServiceAt: '' })
      load()
      setToast({ msg: 'Equipment added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }
  const setStatus = async (e: Equipment, status: Status) => {
    try {
      const res = await fetch(`/api/equipment/${e.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activeItem?.id === e.id) setActiveItem({ ...updated, serviceBucket: e.serviceBucket })
      load()
    } catch { setToast({ msg: 'Status change failed', type: 'error' }) }
  }
  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Equipment</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {items.length} items
              {alerts > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· {alerts} service alerts</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add equipment" style={{ width: 36, height: 36, borderRadius: 10, background: '#52749a', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / code / serial…" style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
          <div style={{ position: 'absolute', top: 12, left: 10, pointerEvents: 'none' }}><IcSearch size={14} color="#52749a" /></div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {(['all', 'in_service', 'in_yard', 'in_service_centre', 'out_of_service'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 99, border: 'none', background: statusFilter === s ? '#52749a' : 'rgba(255,255,255,0.06)', color: statusFilter === s ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: statusFilter === s ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
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
          <p style={{ marginTop: 12, fontSize: 14 }}>No equipment registered</p>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#52749a', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Add first item
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(e => (
            <button key={e.id} onClick={() => setActiveItem(e)} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: '#52749a22', color: '#52749a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcWrench size={18} color="#52749a" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{e.name}</span>
                  {e.code && <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a' }}>{e.code}</span>}
                </div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                  {e.category || 'Uncategorised'}
                  {e.ownership === 'hired' && e.hireCompany && <> · hired from {e.hireCompany}</>}
                  {e.location && <> · {e.location}</>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <span style={{ padding: '1px 7px', borderRadius: 99, background: `${STATUS_COLOR[e.status]}22`, color: STATUS_COLOR[e.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[e.status]}55`, textTransform: 'uppercase' }}>
                  {STATUS_LABEL[e.status]}
                </span>
                {e.serviceBucket !== 'none' && e.serviceBucket !== 'ok' && (
                  <span style={{ fontFamily: SF, fontSize: 10, color: SERVICE_COLOR[e.serviceBucket], fontWeight: 600 }}>
                    <IcAlert size={9} color={SERVICE_COLOR[e.serviceBucket]} /> Service {e.serviceBucket}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Add equipment</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Equipment name (e.g. Hilti TE-50)" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Asset code" style={inputStyle} />
              <input value={form.serial} onChange={e => setForm(p => ({ ...p, serial: e.target.value }))} placeholder="Serial" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Category (e.g. drill, ladder)" style={inputStyle} />
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select value={form.ownership} onChange={e => setForm(p => ({ ...p, ownership: e.target.value as Ownership }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="owned">Owned</option>
                <option value="hired">Hired</option>
              </select>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))} style={{ ...inputStyle, appearance: 'none' }}>
                {(Object.keys(STATUS_LABEL) as Status[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            {form.ownership === 'hired' && (
              <input value={form.hireCompany} onChange={e => setForm(p => ({ ...p, hireCompany: e.target.value }))} placeholder="Hire company" style={inputStyle} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Last serviced</label>
                <input type="date" value={form.lastServicedAt} onChange={e => setForm(p => ({ ...p, lastServicedAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={labelStyle}>Next service</label>
                <input type="date" value={form.nextServiceAt} onChange={e => setForm(p => ({ ...p, nextServiceAt: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>
            <button onClick={save} disabled={saving || !form.name.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#52749a', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>{activeItem.category || 'Uncategorised'} · {activeItem.ownership}</div>
              </div>
              <button onClick={() => setActiveItem(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>
              {activeItem.code && <div><span style={{ color: '#52749a' }}>Code:</span> <span style={{ fontFamily: 'ui-monospace, monospace' }}>{activeItem.code}</span></div>}
              {activeItem.serial && <div><span style={{ color: '#52749a' }}>Serial:</span> <span style={{ fontFamily: 'ui-monospace, monospace' }}>{activeItem.serial}</span></div>}
              {activeItem.location && <div><span style={{ color: '#52749a' }}>Location:</span> {activeItem.location}</div>}
              {activeItem.hireCompany && <div><span style={{ color: '#52749a' }}>Hired from:</span> {activeItem.hireCompany}</div>}
              {activeItem.lastServicedAt && <div><span style={{ color: '#52749a' }}>Last serviced:</span> {new Date(activeItem.lastServicedAt).toLocaleDateString('en-GB')}</div>}
              {activeItem.nextServiceAt && <div><span style={{ color: '#52749a' }}>Next service:</span> <span style={{ color: SERVICE_COLOR[activeItem.serviceBucket] }}>{new Date(activeItem.nextServiceAt).toLocaleDateString('en-GB')}</span></div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
                <button key={s} onClick={() => setStatus(activeItem, s)} disabled={activeItem.status === s} style={{ padding: '8px', borderRadius: 8, border: `0.5px solid ${activeItem.status === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.1)'}`, background: activeItem.status === s ? `${STATUS_COLOR[s]}22` : 'rgba(255,255,255,0.04)', color: activeItem.status === s ? STATUS_COLOR[s] : '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: activeItem.status === s ? 'default' : 'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <button onClick={() => remove(activeItem.id)} style={{ marginTop: 4, padding: '10px', borderRadius: 10, background: confirmDelete === activeItem.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeItem.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" />
              {confirmDelete === activeItem.id ? 'Sure?' : 'Delete equipment'}
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

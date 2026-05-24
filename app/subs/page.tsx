'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcTeam, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSearch, IcAlert } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'none'
interface Sub {
  id: string
  name: string
  trade: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  postcode: string | null
  cisStatus: 'gross' | '20' | '30'
  utrNumber: string | null
  insuranceExpiry: string | null
  qualificationsExpiry: string | null
  notes: string | null
  archivedAt: string | null
  insuranceStatus: ExpiryStatus
  qualificationsStatus: ExpiryStatus
}

const SF = 'var(--font-system)'
const COMMON_TRADES = ['Carpentry', 'Plumbing', 'Electrical', 'Plastering', 'Roofing', 'Bricklaying', 'Painting', 'Tiling', 'Groundwork', 'Steel', 'Glazing', 'M&E']
const STATUS_COLOR: Record<ExpiryStatus, string> = { valid: '#22c55e', expiring: '#f59e0b', expired: '#ef4444', none: '#52749a' }

export default function SubsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [alerts, setAlerts] = useState(0)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeSub, setActiveSub] = useState<Sub | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', trade: '', contactName: '', contactEmail: '', contactPhone: '', cisStatus: '20', utrNumber: '', insuranceExpiry: '', qualificationsExpiry: '',
  })

  useModalEffects(showAdd || activeSub !== null, () => { setShowAdd(false); setActiveSub(null) })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (showArchived) params.set('archived', 'true')
    if (search.trim()) params.set('search', search.trim())
    fetch(`/api/subs?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setSubs(d.subs || []); setAlerts(d.alerts || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [showArchived, search])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/subs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          trade: form.trade.trim() || null,
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          cisStatus: form.cisStatus,
          utrNumber: form.utrNumber.trim() || null,
          insuranceExpiry: form.insuranceExpiry || null,
          qualificationsExpiry: form.qualificationsExpiry || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ name: '', trade: '', contactName: '', contactEmail: '', contactPhone: '', cisStatus: '20', utrNumber: '', insuranceExpiry: '', qualificationsExpiry: '' })
      load()
      setToast({ msg: 'Subcontractor added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleArchive = async (s: Sub) => {
    try {
      const res = await fetch(`/api/subs/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !s.archivedAt }),
      })
      if (!res.ok) throw new Error('Failed')
      setActiveSub(null); load()
    } catch {
      setToast({ msg: 'Failed', type: 'error' })
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
      const res = await fetch(`/api/subs/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveSub(null); load()
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Subcontractors</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {subs.length} {showArchived ? 'archived' : 'active'}
              {alerts > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· {alerts} alerts</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add subcontractor" style={{ width: 36, height: 36, borderRadius: 10, background: '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / trade / contact…" style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
          <div style={{ position: 'absolute', top: 12, left: 10, pointerEvents: 'none' }}><IcSearch size={14} color="#52749a" /></div>
        </div>
        <button onClick={() => setShowArchived(s => !s)} style={{ background: showArchived ? 'rgba(255,255,255,0.1)' : 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: showArchived ? '#eef3fa' : '#52749a', borderRadius: 99, padding: '3px 12px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          {showArchived ? '← Active' : 'Show archived'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : subs.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcTeam size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No subcontractors</p>
          {!showArchived && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Add first sub
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subs.map(s => (
            <button key={s.id} onClick={() => setActiveSub(s)} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', textAlign: 'left', opacity: s.archivedAt ? 0.55 : 1 }}>
              <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: '#2563eb22', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>
                {s.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{s.name}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                  {s.trade || 'Trade not set'}{s.contactName ? ` · ${s.contactName}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <span style={{ padding: '1px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', fontFamily: SF, fontSize: 9, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase' }}>CIS {s.cisStatus}</span>
                {(s.insuranceStatus === 'expired' || s.insuranceStatus === 'expiring' || s.qualificationsStatus === 'expired' || s.qualificationsStatus === 'expiring') && (
                  <IcAlert size={13} color={(s.insuranceStatus === 'expired' || s.qualificationsStatus === 'expired') ? '#ef4444' : '#f59e0b'} />
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Add subcontractor</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Company name" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.trade} onChange={e => setForm(p => ({ ...p, trade: e.target.value }))} placeholder="Trade" list="sub-trades" style={inputStyle} />
              <datalist id="sub-trades">{COMMON_TRADES.map(t => <option key={t} value={t} />)}</datalist>
              <select value={form.cisStatus} onChange={e => setForm(p => ({ ...p, cisStatus: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="gross">CIS — Gross</option>
                <option value="20">CIS — 20%</option>
                <option value="30">CIS — 30%</option>
              </select>
            </div>
            <input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} placeholder="Contact name" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="Email" style={inputStyle} />
              <input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="Phone" style={inputStyle} />
            </div>
            <input value={form.utrNumber} onChange={e => setForm(p => ({ ...p, utrNumber: e.target.value }))} placeholder="UTR number (10 digits)" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Insurance expiry</label>
                <input type="date" value={form.insuranceExpiry} onChange={e => setForm(p => ({ ...p, insuranceExpiry: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={labelStyle}>Quals expiry</label>
                <input type="date" value={form.qualificationsExpiry} onChange={e => setForm(p => ({ ...p, qualificationsExpiry: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>
            <button onClick={save} disabled={saving || !form.name.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Add</>}
            </button>
          </div>
        </div>
      )}

      {activeSub && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveSub(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>{activeSub.name}</h2>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>{activeSub.trade || 'Trade not set'} · CIS {activeSub.cisStatus}</div>
              </div>
              <button onClick={() => setActiveSub(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ExpiryCard label="Insurance" date={activeSub.insuranceExpiry} status={activeSub.insuranceStatus} />
              <ExpiryCard label="Qualifications" date={activeSub.qualificationsExpiry} status={activeSub.qualificationsStatus} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>
              {activeSub.contactName && <div><span style={{ color: '#52749a' }}>Contact:</span> {activeSub.contactName}</div>}
              {activeSub.contactEmail && <div><span style={{ color: '#52749a' }}>Email:</span> <a href={`mailto:${activeSub.contactEmail}`} style={{ color: '#60a5fa' }}>{activeSub.contactEmail}</a></div>}
              {activeSub.contactPhone && <div><span style={{ color: '#52749a' }}>Phone:</span> <a href={`tel:${activeSub.contactPhone}`} style={{ color: '#60a5fa' }}>{activeSub.contactPhone}</a></div>}
              {activeSub.utrNumber && <div><span style={{ color: '#52749a' }}>UTR:</span> <span style={{ fontFamily: 'ui-monospace, monospace' }}>{activeSub.utrNumber}</span></div>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => toggleArchive(activeSub)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#8ea8c5', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {activeSub.archivedAt ? 'Unarchive' : 'Archive'}
              </button>
              <button onClick={() => remove(activeSub.id)} style={{ padding: '10px 14px', borderRadius: 10, background: confirmDelete === activeSub.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeSub.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                <IcTrash size={12} color="#ef4444" />
                {confirmDelete === activeSub.id ? 'Sure?' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExpiryCard({ label, date, status }: { label: string; date: string | null; status: ExpiryStatus }) {
  return (
    <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${STATUS_COLOR[status]}44` }}>
      <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: STATUS_COLOR[status], fontWeight: 700, marginTop: 2 }}>
        {date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
      </div>
      <div style={{ fontFamily: SF, fontSize: 10, color: STATUS_COLOR[status], fontWeight: 600, marginTop: 1, textTransform: 'capitalize' }}>{status === 'none' ? '' : status}</div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

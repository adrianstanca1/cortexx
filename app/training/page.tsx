'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcHardhat, IcChevL, IcPlus, IcX, IcCheck, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Member { id: string; name: string; role: string }
interface Certification {
  id: string
  memberId: string | null
  holderName: string
  type: string
  number: string | null
  issuedDate: string | null
  expiryDate: string | null
  notes: string | null
  createdAt: string
  member?: Member | null
  statusBucket: 'valid' | 'expiring' | 'expired' | 'no_expiry'
}
interface Counts { valid: number; expiring: number; expired: number; total: number }

const SF = 'var(--font-system)'
const COMMON_TYPES = ['CSCS', 'IPAF', 'PASMA', 'SSSTS', 'SMSTS', 'Asbestos Awareness', 'First Aid at Work', 'Working at Heights']
const STATUS_COLOR: Record<Certification['statusBucket'], string> = {
  valid: '#10b981',
  expiring: '#f59e0b',
  expired: '#ef4444',
  no_expiry: '#52749a',
}
const STATUS_LABEL: Record<Certification['statusBucket'], string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
  no_expiry: 'No expiry',
}

export default function TrainingPage() {
  const [certs, setCerts] = useState<Certification[]>([])
  const [counts, setCounts] = useState<Counts>({ valid: 0, expiring: 0, expired: 0, total: 0 })
  const [team, setTeam] = useState<Member[]>([])
  const [filter, setFilter] = useState<'all' | Certification['statusBucket']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    memberId: '',
    holderName: '',
    type: 'CSCS',
    number: '',
    issuedDate: '',
    expiryDate: '',
    notes: '',
  })

  useModalEffects(showAdd, () => setShowAdd(false))

  const load = useCallback(() => {
    fetch('/api/training')
      .then(r => { if (!r.ok) throw new Error('Failed to load certifications'); return r.json() })
      .then(d => { setCerts(d.certifications || []); setCounts(d.counts || { valid: 0, expiring: 0, expired: 0, total: 0 }); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/team').then(r => r.ok ? r.json() : null).then(d => {
      const ts: Member[] = (d?.team || []).map((m: { id: string; name: string; role: string }) => ({ id: m.id, name: m.name, role: m.role }))
      setTeam(ts)
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.holderName.trim() || !form.type.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: form.memberId || null,
          holderName: form.holderName.trim(),
          type: form.type.trim(),
          number: form.number.trim() || null,
          issuedDate: form.issuedDate || null,
          expiryDate: form.expiryDate || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ memberId: '', holderName: '', type: 'CSCS', number: '', issuedDate: '', expiryDate: '', notes: '' })
      load()
      setToast({ msg: 'Certification added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to add', type: 'error' })
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
      const res = await fetch(`/api/training/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  // Auto-fill holderName when picking a member
  const pickMember = (id: string) => {
    const m = team.find(t => t.id === id)
    setForm(prev => ({ ...prev, memberId: id, holderName: m?.name || prev.holderName }))
  }

  const filtered = filter === 'all' ? certs : certs.filter(c => c.statusBucket === filter)

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Training & CSCS</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {counts.total} certifications · {counts.expired} expired
              {counts.expiring > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· {counts.expiring} expiring soon</span>}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add certification" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
          {(['valid', 'expiring', 'expired'] as const).map(b => (
            <button key={b} onClick={() => setFilter(filter === b ? 'all' : b)} style={{ background: filter === b ? `${STATUS_COLOR[b]}28` : 'rgba(255,255,255,0.04)', border: `0.5px solid ${filter === b ? STATUS_COLOR[b] : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: STATUS_COLOR[b] }}>{counts[b]}</div>
              <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#52749a', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{STATUS_LABEL[b]}</div>
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
          <IcHardhat size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{certs.length === 0 ? 'No certifications recorded yet' : 'Nothing in this filter'}</p>
          {certs.length === 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Add first certification
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{c.holderName}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {c.type}{c.number ? ` · #${c.number}` : ''}
                  {c.expiryDate && <span style={{ color: '#52749a' }}> · expires {new Date(c.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </div>
              </div>
              <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 99, background: `${STATUS_COLOR[c.statusBucket]}22`, color: STATUS_COLOR[c.statusBucket], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${STATUS_COLOR[c.statusBucket]}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {STATUS_LABEL[c.statusBucket]}
              </span>
              <button onClick={() => remove(c.id)} aria-label={confirmDelete === c.id ? 'Confirm delete' : 'Delete'} style={{ flexShrink: 0, background: confirmDelete === c.id ? 'rgba(239,68,68,0.2)' : 'none', border: 'none', borderRadius: 4, padding: confirmDelete === c.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={13} color="#ef4444" />
                {confirmDelete === c.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: SF }}>Sure?</span>}
              </button>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.3, fontFamily: SF }}>Add certification</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={labelStyle}>Member (optional)</label>
              <select value={form.memberId} onChange={e => pickMember(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">— Not in team list —</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Holder name</label>
              <input value={form.holderName} onChange={e => setForm(p => ({ ...p, holderName: e.target.value }))} placeholder="Person on the card" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  {COMMON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Card / cert number</label>
                <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="Optional" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Issued</label>
                <input type="date" value={form.issuedDate} onChange={e => setForm(p => ({ ...p, issuedDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={labelStyle}>Expires</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <button onClick={create} disabled={saving || !form.holderName.trim() || !form.type.trim()} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.holderName.trim() || !form.type.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Add certification</>}
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

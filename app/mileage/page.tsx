'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcTruck, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcSend, IcPound } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Member { id: string; name: string }
interface MileageEntry {
  id: string
  memberId: string | null
  date: string
  fromAddress: string
  toAddress: string
  fromPostcode: string | null
  toPostcode: string | null
  miles: number
  vehicleType: 'car' | 'van' | 'motorbike'
  purpose: string | null
  ratePence: number
  amount: number
  approved: boolean
  notes: string | null
  member?: Member | null
}
interface Totals { miles: number; amount: number }

const SF = 'var(--font-system)'
const VEHICLE_RATE: Record<MileageEntry['vehicleType'], number> = { car: 45, van: 45, motorbike: 24 }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MileagePage() {
  const [entries, setEntries] = useState<MileageEntry[]>([])
  const [totals, setTotals] = useState<Totals>({ miles: 0, amount: 0 })
  const [team, setTeam] = useState<Member[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [approvedFilter, setApprovedFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    memberId: '',
    date: new Date().toISOString().slice(0, 10),
    fromAddress: '',
    fromPostcode: '',
    toAddress: '',
    toPostcode: '',
    miles: '',
    vehicleType: 'car' as MileageEntry['vehicleType'],
    purpose: '',
  })

  useModalEffects(showAdd, () => setShowAdd(false))

  const load = useCallback(() => {
    const params = new URLSearchParams({ month })
    if (approvedFilter === 'approved') params.set('approved', 'true')
    if (approvedFilter === 'pending') params.set('approved', 'false')
    fetch(`/api/mileage?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setEntries(d.entries || []); setTotals(d.totals || { miles: 0, amount: 0 }); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/team').then(r => r.ok ? r.json() : null).then(d => {
      const ts: Member[] = (d?.team || []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))
      setTeam(ts)
      setForm(prev => prev.memberId ? prev : { ...prev, memberId: ts[0]?.id || '' })
    }).catch(() => {})
  }, [month, approvedFilter])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.fromAddress.trim() || !form.toAddress.trim() || !form.miles) return
    setSaving(true)
    try {
      const res = await fetch('/api/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: form.memberId || null,
          date: form.date,
          fromAddress: form.fromAddress.trim(),
          fromPostcode: form.fromPostcode.trim() || null,
          toAddress: form.toAddress.trim(),
          toPostcode: form.toPostcode.trim() || null,
          miles: Number(form.miles),
          vehicleType: form.vehicleType,
          purpose: form.purpose.trim() || null,
          ratePence: VEHICLE_RATE[form.vehicleType],
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, fromAddress: '', fromPostcode: '', toAddress: '', toPostcode: '', miles: '', purpose: '' }))
      load()
      setToast({ msg: 'Mileage logged' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleApprove = async (e: MileageEntry) => {
    try {
      const res = await fetch(`/api/mileage/${e.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: !e.approved }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Approve failed', type: 'error' })
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
      const res = await fetch(`/api/mileage/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const exportCsv = () => {
    const head = 'Date,Member,From,From postcode,To,To postcode,Miles,Vehicle,Purpose,Rate (p),Amount (£),Approved'
    const rows = entries.map(e => [
      new Date(e.date).toISOString().slice(0, 10),
      e.member?.name || '',
      `"${e.fromAddress.replace(/"/g, '""')}"`,
      e.fromPostcode || '',
      `"${e.toAddress.replace(/"/g, '""')}"`,
      e.toPostcode || '',
      e.miles.toFixed(1),
      e.vehicleType,
      `"${(e.purpose || '').replace(/"/g, '""')}"`,
      e.ratePence.toFixed(0),
      e.amount.toFixed(2),
      e.approved ? 'Y' : 'N',
    ].join(','))
    const blob = new Blob([head + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mileage-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  })()

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Mileage</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{monthLabel} · HMRC rate</p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Log journey" style={{ width: 36, height: 36, borderRadius: 10, background: '#06b6d4', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{ background: '#152641', borderRadius: 10, padding: '8px 12px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Miles</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: '#06b6d4', fontWeight: 700, marginTop: 2 }}>{totals.miles.toFixed(0)}</div>
          </div>
          <div style={{ background: '#152641', borderRadius: 10, padding: '8px 12px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Claimable</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: '#10b981', fontWeight: 700, marginTop: 2 }}>£{totals.amount.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark', padding: '5px 10px', fontSize: 12, width: 'auto' }} />
          {(['all', 'pending', 'approved'] as const).map(f => (
            <button key={f} onClick={() => setApprovedFilter(f)} style={{ padding: '4px 10px', borderRadius: 99, border: 'none', background: approvedFilter === f ? '#06b6d4' : 'rgba(255,255,255,0.06)', color: approvedFilter === f ? '#fff' : '#52749a', fontFamily: SF, fontSize: 11, fontWeight: approvedFilter === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
          {entries.length > 0 && (
            <button onClick={exportCsv} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 99, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <IcSend size={11} color="#8ea8c5" /> CSV
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcTruck size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No journeys this month</p>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Log first journey
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 600 }}>
                  {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                {e.member && <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>· {e.member.name}</span>}
                <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 14, color: '#10b981', fontWeight: 700 }}>£{e.amount.toFixed(2)}</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', lineHeight: 1.3 }}>
                {e.fromAddress}{e.fromPostcode ? ` (${e.fromPostcode})` : ''} <span style={{ color: '#52749a' }}>→</span> {e.toAddress}{e.toPostcode ? ` (${e.toPostcode})` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontFamily: SF, fontSize: 11, color: '#52749a' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: '#06b6d4', fontWeight: 600 }}>{e.miles.toFixed(1)} mi</span>
                <span>·</span>
                <span style={{ textTransform: 'capitalize' }}>{e.vehicleType} @ {e.ratePence}p</span>
                {e.purpose && <><span>·</span><span>{e.purpose}</span></>}
                <button onClick={() => toggleApprove(e)} style={{ marginLeft: 'auto', background: e.approved ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)', border: `0.5px solid ${e.approved ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`, color: e.approved ? '#10b981' : '#f59e0b', borderRadius: 8, padding: '2px 8px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                  {e.approved ? '✓ Approved' : 'Pending'}
                </button>
                <button onClick={() => remove(e.id)} aria-label={confirmDelete === e.id ? 'Confirm delete' : 'Delete'} style={{ background: confirmDelete === e.id ? 'rgba(239,68,68,0.18)' : 'transparent', border: 'none', borderRadius: 4, padding: confirmDelete === e.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IcTrash size={11} color="#ef4444" />
                  {confirmDelete === e.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Sure?</span>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Log journey</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Member</label>
                <select value={form.memberId} onChange={e => setForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">— Personal —</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>From</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 6 }}>
                <input value={form.fromAddress} onChange={e => setForm(p => ({ ...p, fromAddress: e.target.value }))} placeholder="Address" style={inputStyle} />
                <input value={form.fromPostcode} onChange={e => setForm(p => ({ ...p, fromPostcode: e.target.value }))} placeholder="Postcode" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>To</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 6 }}>
                <input value={form.toAddress} onChange={e => setForm(p => ({ ...p, toAddress: e.target.value }))} placeholder="Address" style={inputStyle} />
                <input value={form.toPostcode} onChange={e => setForm(p => ({ ...p, toPostcode: e.target.value }))} placeholder="Postcode" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Miles</label>
                <input type="number" step="0.1" value={form.miles} onChange={e => setForm(p => ({ ...p, miles: e.target.value }))} placeholder="0.0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Vehicle</label>
                <select value={form.vehicleType} onChange={e => setForm(p => ({ ...p, vehicleType: e.target.value as MileageEntry['vehicleType'] }))} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="car">Car (45p)</option>
                  <option value="van">Van (45p)</option>
                  <option value="motorbike">Motorbike (24p)</option>
                </select>
              </div>
            </div>

            <input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} placeholder="Purpose (e.g. site visit, supplier collection)" style={inputStyle} />

            {form.miles && !isNaN(Number(form.miles)) && (
              <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>
                <span>Claim at {VEHICLE_RATE[form.vehicleType]}p × {Number(form.miles).toFixed(1)} mi</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, color: '#10b981' }}>
                  £{((Number(form.miles) * VEHICLE_RATE[form.vehicleType]) / 100).toFixed(2)}
                </span>
              </div>
            )}

            <button onClick={create} disabled={saving || !form.fromAddress.trim() || !form.toAddress.trim() || !form.miles} style={{ padding: '14px 0', borderRadius: 14, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.fromAddress.trim() || !form.toAddress.trim() || !form.miles ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Log journey</>}
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

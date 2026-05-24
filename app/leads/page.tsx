'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcArrowRight, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcPound } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Lead {
  id: string
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  source: string | null
  status: 'new' | 'qualified' | 'proposing' | 'won' | 'lost'
  value: number
  notes: string | null
  lostReason: string | null
  convertedAt: string | null
  createdAt: string
}

const SF = 'var(--font-system)'
const STAGES: Lead['status'][] = ['new', 'qualified', 'proposing', 'won', 'lost']
const STAGE_LABEL: Record<Lead['status'], string> = {
  new: 'New',
  qualified: 'Qualified',
  proposing: 'Proposing',
  won: 'Won',
  lost: 'Lost',
}
const STAGE_COLOR: Record<Lead['status'], string> = {
  new: '#3b82f6',
  qualified: '#06b6d4',
  proposing: '#f59e0b',
  won: '#22c55e',
  lost: '#ef4444',
}
const SOURCES = ['website', 'referral', 'repeat', 'cold', 'tender', 'social']

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [pipelineValue, setPipelineValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    source: 'website',
    value: '',
    notes: '',
  })

  useModalEffects(showAdd, () => setShowAdd(false))

  const load = useCallback(() => {
    fetch('/api/leads')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json() })
      .then(d => { setLeads(d.leads || []); setOpenCount(d.openCount || 0); setPipelineValue(d.pipelineValue || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          source: form.source.trim() || null,
          value: form.value === '' ? 0 : Number(form.value),
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm({ name: '', contactName: '', contactEmail: '', contactPhone: '', source: 'website', value: '', notes: '' })
      load()
      setToast({ msg: 'Lead added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const moveStage = async (l: Lead, next: Lead['status']) => {
    try {
      const res = await fetch(`/api/leads/${l.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Stage change failed', type: 'error' })
    }
  }

  const convert = async (l: Lead) => {
    setConverting(l.id)
    try {
      const res = await fetch(`/api/leads/${l.id}?action=convert`, { method: 'POST' })
      if (!res.ok) throw new Error('Convert failed')
      const data = await res.json()
      setToast({ msg: `Converted to customer "${data.customer.name}"` })
      load()
      setTimeout(() => router.push('/customers'), 800)
    } catch {
      setToast({ msg: 'Conversion failed', type: 'error' })
    } finally {
      setConverting(null)
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
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const byStage: Record<Lead['status'], Lead[]> = { new: [], qualified: [], proposing: [], won: [], lost: [] }
  leads.forEach(l => byStage[l.status].push(l))

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Leads</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {openCount} in pipeline · <span style={{ fontFamily: 'ui-monospace, monospace', color: '#22c55e' }}>£{pipelineValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span> potential
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} aria-label="Add lead" style={{ width: 36, height: 36, borderRadius: 10, background: '#06b6d4', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : leads.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcArrowRight size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No leads yet</p>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Add first lead
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STAGES.map(stage => byStage[stage].length > 0 && (
            <div key={stage}>
              <div style={{ fontFamily: SF, fontSize: 11, color: STAGE_COLOR[stage], fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                {STAGE_LABEL[stage]} <span style={{ color: '#52749a' }}>· {byStage[stage].length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {byStage[stage].map(l => {
                  const stageIdx = STAGES.indexOf(l.status)
                  const nextStage = stageIdx < 3 ? STAGES[stageIdx + 1] : null
                  return (
                    <div key={l.id} style={{ background: '#152641', borderRadius: 12, padding: '12px', border: `0.5px solid ${l.status === 'won' ? 'rgba(34,197,94,0.3)' : l.status === 'lost' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, opacity: l.status === 'lost' ? 0.65 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{l.name}</div>
                          {l.contactName && <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 1 }}>{l.contactName}{l.contactEmail ? ` · ${l.contactEmail}` : ''}</div>}
                          {l.source && <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 4, textTransform: 'capitalize' }}>via {l.source}</div>}
                        </div>
                        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 700, color: l.value > 0 ? '#22c55e' : '#52749a', flexShrink: 0 }}>
                          £{l.value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {nextStage && (
                          <button onClick={() => moveStage(l, nextStage)} style={{ background: `${STAGE_COLOR[nextStage]}22`, border: `0.5px solid ${STAGE_COLOR[nextStage]}55`, color: STAGE_COLOR[nextStage], borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            → {STAGE_LABEL[nextStage]}
                          </button>
                        )}
                        {l.status !== 'won' && l.status !== 'lost' && (
                          <>
                            <button onClick={() => convert(l)} disabled={converting === l.id} style={{ background: 'rgba(34,197,94,0.2)', border: '0.5px solid rgba(34,197,94,0.5)', color: '#22c55e', borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <IcCheck size={11} color="#22c55e" /> {converting === l.id ? 'Converting…' : 'Won — convert'}
                            </button>
                            <button onClick={() => moveStage(l, 'lost')} style={{ background: 'rgba(239,68,68,0.12)', border: '0.5px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Lost
                            </button>
                          </>
                        )}
                        {(l.status === 'won' || l.status === 'lost') && (
                          <button onClick={() => moveStage(l, 'new')} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#8ea8c5', borderRadius: 8, padding: '3px 9px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Reopen
                          </button>
                        )}
                        <button onClick={() => remove(l.id)} aria-label={confirmDelete === l.id ? 'Confirm delete' : 'Delete'} style={{ marginLeft: 'auto', background: confirmDelete === l.id ? 'rgba(239,68,68,0.18)' : 'transparent', border: 'none', borderRadius: 4, padding: confirmDelete === l.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <IcTrash size={11} color="#ef4444" />
                          {confirmDelete === l.id && <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Sure?</span>}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Add lead</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Company / project name" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} placeholder="Contact name" style={inputStyle} />
              <input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} placeholder="Phone" style={inputStyle} />
            </div>
            <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} placeholder="Email" style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Source</label>
                <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Est. value (£)</label>
                <input type="number" step="100" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} placeholder="0" style={inputStyle} />
              </div>
            </div>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
            <button onClick={create} disabled={saving || !form.name.trim()} style={{ padding: '14px 0', borderRadius: 14, background: '#06b6d4', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Add lead</>}
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

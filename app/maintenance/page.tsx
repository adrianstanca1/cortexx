'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcWrench, IcChevL, IcPlus, IcX, IcTrash, IcCheck } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Schedule {
  id: string
  equipmentId: string
  title: string
  type: 'service' | 'inspection' | 'calibration' | 'repair'
  status: 'scheduled' | 'due' | 'completed' | 'overdue' | 'cancelled'
  dueDate: string
  intervalDays: number | null
  completedAt: string | null
  performedBy: string | null
  cost: number
  notes: string | null
  createdAt: string
  updatedAt: string
  equipment?: { id: string; name: string; code: string | null; status: string } | null
}
interface Equipment { id: string; name: string; code?: string | null }

const TYPE_LABEL: Record<Schedule['type'], string> = {
  service: 'Service', inspection: 'Inspection', calibration: 'Calibration', repair: 'Repair',
}
const STATUS_COLOR: Record<Schedule['status'], string> = {
  scheduled: '#06b6d4', due: '#f59e0b', overdue: '#ef4444', completed: '#10b981', cancelled: '#52749a',
}
const SF = 'var(--font-system)'
const niceDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const money = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`

export default function MaintenancePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Schedule['status']>('all')
  const [overdueCount, setOverdueCount] = useState(0)
  const [dueSoonCount, setDueSoonCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [form, setForm] = useState({
    equipmentId: '', title: '', type: 'service' as Schedule['type'],
    dueDate: '', intervalDays: '', cost: '', notes: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/maintenance?${params.toString()}`),
        fetch('/api/equipment'),
      ])
      if (!sRes.ok) throw new Error('Failed to load')
      const sd = await sRes.json()
      setSchedules(sd.schedules || [])
      setOverdueCount(sd.overdueCount || 0)
      setDueSoonCount(sd.dueSoonCount || 0)
      if (eRes.ok) {
        const ed = await eRes.json()
        setEquipment((ed.equipment || []).map((e: Equipment) => ({ id: e.id, name: e.name, code: e.code })))
      }
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    const inFortnight = new Date(); inFortnight.setDate(inFortnight.getDate() + 14)
    setForm({ equipmentId: equipment[0]?.id || '', title: '', type: 'service', dueDate: inFortnight.toISOString().slice(0, 10), intervalDays: '', cost: '', notes: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title required', type: 'error' })
    if (!form.equipmentId) return setToast({ msg: 'Pick equipment', type: 'error' })
    if (!form.dueDate) return setToast({ msg: 'Due date required', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: form.equipmentId,
          title: form.title.trim(),
          type: form.type,
          dueDate: form.dueDate,
          intervalDays: form.intervalDays ? Number(form.intervalDays) : null,
          cost: form.cost ? Number(form.cost) : 0,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Scheduled', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const complete = async (s: Schedule) => {
    try {
      const res = await fetch(`/api/maintenance/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error()
      if (data?.next) setToast({ msg: `Completed · next due ${niceDate(data.next.dueDate)}`, type: 'success' })
      else setToast({ msg: 'Completed', type: 'success' })
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' })
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
              <IcWrench size={20} color="#06b6d4" /> Maintenance
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {overdueCount} overdue · {dueSoonCount} due in 7d
            </p>
          </div>
          <button onClick={openAdd} aria-label="Schedule" style={{ background: '#06b6d4', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Schedule</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'scheduled', 'due', 'overdue', 'completed', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ background: statusFilter === s ? '#06b6d4' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: statusFilter === s ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && schedules.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No schedules. Add a service interval for a piece of kit.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {schedules.map(s => {
          const isOverdue = s.status !== 'completed' && s.status !== 'cancelled' && new Date(s.dueDate) < new Date()
          const color = STATUS_COLOR[isOverdue ? 'overdue' : s.status]
          return (
            <div key={s.id} style={{ background: '#152641', border: `0.5px solid ${isOverdue ? '#ef444466' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ background: '#1a2f4e', color: '#c1d2e8', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{TYPE_LABEL[s.type]}</span>
                <span style={{ background: color + '33', color, padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{isOverdue ? 'OVERDUE' : s.status}</span>
                {s.intervalDays && <span style={{ color: '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>EVERY {s.intervalDays}d</span>}
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                {s.equipment?.name || '—'}{s.equipment?.code ? ` (${s.equipment.code})` : ''} · due {niceDate(s.dueDate)}
                {s.cost > 0 ? ` · ${money(s.cost)}` : ''}
                {s.completedAt ? ` · completed ${niceDate(s.completedAt)}` : ''}
              </div>
              {s.notes && (
                <div style={{ marginTop: 8, padding: 8, background: '#0a1426', borderRadius: 6, fontFamily: SF, fontSize: 12, color: '#c1d2e8', whiteSpace: 'pre-wrap' }}>{s.notes}</div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {s.status !== 'completed' && s.status !== 'cancelled' && (
                  <button onClick={() => complete(s)} style={pillBtn('#10b981')}>
                    <IcCheck size={11} color="#fff" /> Mark done
                  </button>
                )}
                <button onClick={() => setConfirmDelete(s.id)} aria-label="Delete" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                  <IcTrash size={11} color="#fca5a5" /> Delete
                </button>
              </div>
              {confirmDelete === s.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this schedule?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(s.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', width: '100%', maxHeight: '85vh', borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Schedule maintenance</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Equipment *">
                <select value={form.equipmentId} onChange={e => setForm(f => ({ ...f, equipmentId: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {equipment.map(e => <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Title *">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="6-monthly LOLER inspection" />
              </Field>
              <Field label="Type">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(TYPE_LABEL) as Schedule['type'][]).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ background: form.type === t ? '#06b6d4' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.type === t ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Due *">
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Repeat every (days)">
                  <input type="number" min="1" max="3650" value={form.intervalDays} onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value }))} style={inputStyle} placeholder="180" />
                </Field>
              </div>
              <Field label="Expected cost (£)">
                <input type="number" min="0" step="10" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#06b6d4', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Schedule'}
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
  return { background: bg, border: `0.5px solid ${borderColor}`, borderRadius: 8, padding: '6px 10px', color, fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }
}

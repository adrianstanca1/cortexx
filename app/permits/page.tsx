'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcAlert, IcChevL, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Permit {
  id: string
  projectId: string
  title: string
  type: 'hot_work' | 'confined_space' | 'excavation' | 'working_at_height' | 'electrical' | 'general'
  status: 'draft' | 'active' | 'expired' | 'cancelled'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  location: string | null
  issuedBy: string | null
  issuedTo: string | null
  validFrom: string | null
  validTo: string | null
  conditions: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const TYPE_LABEL: Record<Permit['type'], string> = {
  hot_work: 'Hot work',
  confined_space: 'Confined space',
  excavation: 'Excavation',
  working_at_height: 'Working at height',
  electrical: 'Electrical',
  general: 'General',
}
const STATUS_COLOR: Record<Permit['status'], string> = {
  draft: '#52749a', active: '#10b981', expired: '#ef4444', cancelled: '#8ea8c5',
}
const RISK_COLOR: Record<Permit['riskLevel'], string> = {
  low: '#10b981', medium: '#06b6d4', high: '#f59e0b', critical: '#ef4444',
}
const SF = 'var(--font-system)'

export default function PermitsPage() {
  const [permits, setPermits] = useState<Permit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Permit['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [form, setForm] = useState({
    projectId: '', title: '', type: 'general' as Permit['type'],
    riskLevel: 'medium' as Permit['riskLevel'], location: '',
    issuedTo: '', validFrom: '', validTo: '', conditions: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [pmRes, prjRes] = await Promise.all([
        fetch(`/api/permits?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!pmRes.ok) throw new Error('Failed to load permits')
      const pmData = await pmRes.json()
      setPermits(pmData.permits || [])
      if (prjRes.ok) {
        const pd = await prjRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ projectId: projects[0]?.id || '', title: '', type: 'general', riskLevel: 'medium', location: '', issuedTo: '', validFrom: '', validTo: '', conditions: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.projectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/permits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'draft' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Permit added', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const setStatus = async (p: Permit, status: Permit['status']) => {
    try {
      const res = await fetch(`/api/permits/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/permits/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

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
              <IcAlert size={20} color="#f59e0b" /> Permits to work
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {permits.length} permits · {permits.filter(p => p.status === 'active').length} active
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add permit" style={{ background: '#f59e0b', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Raise</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'draft', 'active', 'expired', 'cancelled'] as const).map(s => {
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ background: active ? '#f59e0b' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: active ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
              {s}
            </button>
          )
        })}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && permits.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No permits yet. Raise one for hot work, working at height, confined spaces…</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {permits.map(p => (
          <div key={p.id} style={{ background: '#152641', border: `0.5px solid ${p.status === 'active' && p.validTo && new Date(p.validTo) < new Date(Date.now() + 1000 * 60 * 60 * 24) ? '#ef444466' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ background: '#1a2f4e', color: '#c1d2e8', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{TYPE_LABEL[p.type]}</span>
                  <span style={{ background: RISK_COLOR[p.riskLevel] + '33', border: `0.5px solid ${RISK_COLOR[p.riskLevel]}66`, color: RISK_COLOR[p.riskLevel], padding: '2px 7px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{p.riskLevel}</span>
                  <span style={{ background: STATUS_COLOR[p.status] + '33', color: STATUS_COLOR[p.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{p.status}</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                  {p.project?.name || '—'}{p.location ? ` · ${p.location}` : ''}
                </div>
                {(p.validFrom || p.validTo) && (
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 4 }}>
                    Valid {fmt(p.validFrom)} → {fmt(p.validTo)}
                  </div>
                )}
                {p.conditions && (
                  <div style={{ fontFamily: SF, fontSize: 12, color: '#c1d2e8', marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.conditions}</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {p.status === 'draft' && (
                <button onClick={() => setStatus(p, 'active')} style={pillBtn('#10b981')}>Activate</button>
              )}
              {p.status === 'active' && (
                <>
                  <button onClick={() => setStatus(p, 'expired')} style={pillBtn('#1a2f4e', '#fca5a5')}>Expire</button>
                  <button onClick={() => setStatus(p, 'cancelled')} style={pillBtn('#1a2f4e', '#c1d2e8')}>Cancel</button>
                </>
              )}
              <button onClick={() => setConfirmDelete(p.id)} aria-label="Delete permit" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                <IcTrash size={11} color="#fca5a5" /> Delete
              </button>
            </div>
            {confirmDelete === p.id && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this permit?</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => remove(p.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Raise permit</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Project *">
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Title *">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Welding to steel beam B-12" />
              </Field>
              <Field label="Type">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(TYPE_LABEL) as Permit['type'][]).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ background: form.type === t ? '#f59e0b' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.type === t ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Risk level">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['low', 'medium', 'high', 'critical'] as const).map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, riskLevel: r }))} style={{ background: form.riskLevel === r ? RISK_COLOR[r] : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.riskLevel === r ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Location">
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="Roof level 3, west wing" />
              </Field>
              <Field label="Issued to">
                <input type="text" value={form.issuedTo} onChange={e => setForm(f => ({ ...f, issuedTo: e.target.value }))} style={inputStyle} placeholder="ABC Plumbing Ltd" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Valid from">
                  <input type="datetime-local" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Valid to">
                  <input type="datetime-local" value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Conditions / controls">
                <textarea value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Fire watch in attendance, extinguisher within reach, area cleared 6m radius…" />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#f59e0b', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Raise permit'}
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

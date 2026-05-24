'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcDoc, IcChevL, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Tender {
  id: string
  projectId: string | null
  title: string
  clientName: string | null
  status: 'draft' | 'submitted' | 'won' | 'lost' | 'withdrawn'
  totalValue: number
  deadline: string | null
  submittedAt: string | null
  decidedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const STATUS_COLOR: Record<Tender['status'], string> = {
  draft: '#52749a', submitted: '#06b6d4', won: '#10b981', lost: '#ef4444', withdrawn: '#8ea8c5',
}
const STATUS_LABEL: Record<Tender['status'], string> = {
  draft: 'Draft', submitted: 'Submitted', won: 'Won', lost: 'Lost', withdrawn: 'Withdrawn',
}
const SF = 'var(--font-system)'
const money = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Tender['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [pipelineValue, setPipelineValue] = useState(0)

  const [form, setForm] = useState({
    title: '', clientName: '', projectId: '', totalValue: '', deadline: '', notes: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [tRes, prjRes] = await Promise.all([
        fetch(`/api/tenders?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!tRes.ok) throw new Error('Failed to load tenders')
      const td = await tRes.json()
      setTenders(td.tenders || [])
      setPipelineValue(td.pipelineValue || 0)
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

  const wonValue = useMemo(() => tenders.filter(t => t.status === 'won').reduce((s, t) => s + t.totalValue, 0), [tenders])

  const openAdd = () => {
    setForm({ title: '', clientName: '', projectId: '', totalValue: '', deadline: '', notes: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    const value = Number(form.totalValue || 0)
    if (!isFinite(value) || value < 0) return setToast({ msg: 'Invalid value', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/tenders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          clientName: form.clientName.trim() || undefined,
          projectId: form.projectId || undefined,
          totalValue: value,
          deadline: form.deadline || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Tender added', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const setStatus = async (t: Tender, status: Tender['status']) => {
    try {
      const res = await fetch(`/api/tenders/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/tenders/${id}`, { method: 'DELETE' })
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
              <IcDoc size={20} color="#3b82f6" /> Tenders
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              Pipeline {money(pipelineValue)} · won {money(wonValue)}
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add tender" style={{ background: '#3b82f6', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Add</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'draft', 'submitted', 'won', 'lost', 'withdrawn'] as const).map(s => {
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ background: active ? '#3b82f6' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: active ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
              {s}
            </button>
          )
        })}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && tenders.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No tenders yet. Add one to start tracking the pipeline.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {tenders.map(t => {
          const isOverdue = t.status === 'draft' && t.deadline && new Date(t.deadline) < new Date()
          return (
            <div key={t.id} style={{ background: '#152641', border: `0.5px solid ${isOverdue ? '#ef444466' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ background: STATUS_COLOR[t.status] + '33', color: STATUS_COLOR[t.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{STATUS_LABEL[t.status]}</span>
                    {isOverdue && <span style={{ color: '#ef4444', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>OVERDUE</span>}
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                    {t.clientName || '—'}{t.project ? ` · ${t.project.name}` : ''}{t.deadline ? ` · due ${new Date(t.deadline).toLocaleDateString('en-GB')}` : ''}
                  </div>
                </div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, color: '#eef3fa', fontWeight: 700, flexShrink: 0 }}>{money(t.totalValue)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {t.status === 'draft' && <button onClick={() => setStatus(t, 'submitted')} style={pillBtn('#06b6d4')}>Submit</button>}
                {t.status === 'submitted' && (
                  <>
                    <button onClick={() => setStatus(t, 'won')} style={pillBtn('#10b981')}>Won</button>
                    <button onClick={() => setStatus(t, 'lost')} style={pillBtn('#1a2f4e', '#fca5a5')}>Lost</button>
                  </>
                )}
                {t.status !== 'draft' && t.status !== 'withdrawn' && (
                  <button onClick={() => setStatus(t, 'draft')} style={pillBtn('#1a2f4e', '#c1d2e8')}>Reopen</button>
                )}
                <button onClick={() => setConfirmDelete(t.id)} aria-label="Delete tender" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                  <IcTrash size={11} color="#fca5a5" /> Delete
                </button>
              </div>
              {confirmDelete === t.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this tender?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(t.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Add tender</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <IcX size={18} color="#52749a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Title *">
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Phase 2 fit-out tender" />
              </Field>
              <Field label="Client">
                <input type="text" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} style={inputStyle} placeholder="ABC Property Group" />
              </Field>
              <Field label="Project (optional)">
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">— None —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Total value (£)">
                  <input type="number" min="0" step="100" value={form.totalValue} onChange={e => setForm(f => ({ ...f, totalValue: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Deadline">
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#3b82f6', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save tender'}
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

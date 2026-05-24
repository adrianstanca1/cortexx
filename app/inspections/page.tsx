'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcCheck, IcChevL, IcPlus, IcX, IcTrash, IcAlert } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface ChecklistItem { id: string; label: string; result?: 'pass' | 'fail' | 'na'; note?: string }
interface Inspection {
  id: string
  projectId: string
  title: string
  type: 'general' | 'safety' | 'quality' | 'scaffold' | 'electrical'
  status: 'draft' | 'in_progress' | 'passed' | 'failed'
  checklistItems: ChecklistItem[]
  overallResult: 'pass' | 'fail' | null
  conductedBy: string | null
  scheduledAt: string | null
  completedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const TYPE_LABEL: Record<Inspection['type'], string> = {
  general: 'General', safety: 'Safety', quality: 'Quality', scaffold: 'Scaffold', electrical: 'Electrical',
}
const TYPE_COLOR: Record<Inspection['type'], string> = {
  general: '#52749a', safety: '#ef4444', quality: '#06b6d4', scaffold: '#f59e0b', electrical: '#8b5cf6',
}
const STATUS_COLOR: Record<Inspection['status'], string> = {
  draft: '#52749a', in_progress: '#06b6d4', passed: '#10b981', failed: '#ef4444',
}
const STATUS_LABEL: Record<Inspection['status'], string> = {
  draft: 'Draft', in_progress: 'In progress', passed: 'Passed', failed: 'Failed',
}
const SF = 'var(--font-system)'

const DEFAULT_CHECKLISTS: Record<Inspection['type'], string[]> = {
  general: ['Site induction complete', 'PPE worn correctly', 'Site signage in place', 'Welfare facilities clean'],
  safety: ['First aid kit available + in date', 'Fire extinguishers in place', 'Emergency exits clear', 'Hazards signposted', 'Toolbox talk delivered today'],
  quality: ['Workmanship matches spec', 'Materials match approved samples', 'Tolerances within limits', 'No obvious defects'],
  scaffold: ['Tag in date (<7 days)', 'Toe boards in place', 'Guard rails secure', 'Ladder access safe', 'Brace bracing complete'],
  electrical: ['Earth bonding present', 'No exposed conductors', 'PAT testing in date', 'RCD protection in place'],
}

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Inspection['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [form, setForm] = useState({
    projectId: '', title: '', type: 'general' as Inspection['type'], scheduledAt: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [iRes, prjRes] = await Promise.all([
        fetch(`/api/inspections?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!iRes.ok) throw new Error('Failed to load inspections')
      const id = await iRes.json()
      setInspections(id.inspections || [])
      if (prjRes.ok) {
        const pd = await prjRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ projectId: projects[0]?.id || '', title: '', type: 'general', scheduledAt: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.projectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setSaving(true)
    try {
      const checklist = DEFAULT_CHECKLISTS[form.type].map((label, i) => ({ id: `item-${i}`, label }))
      const res = await fetch('/api/inspections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, checklistItems: checklist }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Inspection added', type: 'success' })
      setShowModal(false); load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const updateItem = async (i: Inspection, itemId: string, result: 'pass' | 'fail' | 'na') => {
    const items = i.checklistItems.map(it => it.id === itemId ? { ...it, result } : it)
    try {
      const res = await fetch(`/api/inspections/${i.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItems: items, status: i.status === 'draft' ? 'in_progress' : i.status }),
      })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const setStatus = async (i: Inspection, status: Inspection['status']) => {
    try {
      const res = await fetch(`/api/inspections/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/inspections/${id}`, { method: 'DELETE' })
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
              <IcCheck size={20} color="#10b981" /> Inspections
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {inspections.length} total · {inspections.filter(i => i.status === 'failed').length} failed
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add inspection" style={{ background: '#10b981', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Schedule</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'draft', 'in_progress', 'passed', 'failed'] as const).map(s => {
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ background: active ? '#10b981' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: active ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
              {s.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && inspections.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No inspections yet. Schedule a safety / quality / scaffold check.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {inspections.map(i => {
          const isOpen = expanded === i.id
          const total = i.checklistItems.length
          const done = i.checklistItems.filter(it => it.result).length
          const failed = i.checklistItems.filter(it => it.result === 'fail').length
          return (
            <div key={i.id} style={{ background: '#152641', border: `0.5px solid ${i.status === 'failed' ? '#ef444466' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
              <div onClick={() => setExpanded(isOpen ? null : i.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ background: TYPE_COLOR[i.type] + '33', color: TYPE_COLOR[i.type], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{TYPE_LABEL[i.type]}</span>
                  <span style={{ background: STATUS_COLOR[i.status] + '33', color: STATUS_COLOR[i.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{STATUS_LABEL[i.status]}</span>
                  {failed > 0 && i.status !== 'passed' && <span style={{ color: '#ef4444', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{failed} FAIL</span>}
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>{i.title}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                  {i.project?.name || '—'}{i.scheduledAt ? ` · ${new Date(i.scheduledAt).toLocaleDateString('en-GB')}` : ''} · {done}/{total} checked
                </div>
              </div>

              {isOpen && (
                <>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {i.checklistItems.map(item => (
                      <div key={item.id} style={{ background: '#0a1426', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>{item.label}</div>
                        {(['pass', 'fail', 'na'] as const).map(r => (
                          <button key={r} onClick={() => updateItem(i, item.id, r)} style={{ background: item.result === r ? (r === 'pass' ? '#10b981' : r === 'fail' ? '#ef4444' : '#52749a') : 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', color: item.result === r ? '#fff' : '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {i.status !== 'passed' && (
                      <button onClick={() => setStatus(i, 'passed')} style={pillBtn('#10b981')}>
                        <IcCheck size={11} color="#fff" /> Pass
                      </button>
                    )}
                    {i.status !== 'failed' && (
                      <button onClick={() => setStatus(i, 'failed')} style={pillBtn('#ef4444')}>
                        <IcAlert size={11} color="#fff" /> Fail
                      </button>
                    )}
                    {(i.status === 'passed' || i.status === 'failed') && (
                      <button onClick={() => setStatus(i, 'in_progress')} style={pillBtn('#1a2f4e', '#c1d2e8')}>Reopen</button>
                    )}
                    <button onClick={() => setConfirmDelete(i.id)} aria-label="Delete" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                      <IcTrash size={11} color="#fca5a5" /> Delete
                    </button>
                  </div>
                </>
              )}

              {confirmDelete === i.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this inspection?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(i.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Schedule inspection</h2>
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
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Weekly scaffold inspection — block A" />
              </Field>
              <Field label="Type">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.keys(TYPE_LABEL) as Inspection['type'][]).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ background: form.type === t ? TYPE_COLOR[t] : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.type === t ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Scheduled for">
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} style={inputStyle} />
              </Field>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: 10 }}>
                A starter checklist for <strong>{TYPE_LABEL[form.type]}</strong> ({DEFAULT_CHECKLISTS[form.type].length} items) will be pre-populated. Tap items on the card to mark pass / fail / N/A.
              </div>
              <button onClick={save} disabled={saving} style={{ background: '#10b981', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
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

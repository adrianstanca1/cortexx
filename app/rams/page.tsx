'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import { IcHardhat, IcChevL, IcPlus, IcX, IcTrash, IcCheck, IcSpark, IcEdit } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'
import { RAMS_TEMPLATES, RAMS_TEMPLATE_KEYS } from '@/lib/rams-templates'

interface Rams {
  id: string
  projectId: string
  title: string
  type: 'rams' | 'risk_assessment' | 'method_statement'
  hazards: string | null
  controls: string | null
  ppe: string | null
  reviewBy: string | null
  signedBy: string | null
  signedAt: string | null
  status: 'draft' | 'active' | 'expired' | 'archived'
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}
interface Project { id: string; name: string }

const TYPE_LABEL: Record<Rams['type'], string> = {
  rams: 'RAMS', risk_assessment: 'Risk assessment', method_statement: 'Method statement',
}
const STATUS_COLOR: Record<Rams['status'], string> = {
  draft: '#52749a', active: '#10b981', expired: '#ef4444', archived: '#8ea8c5',
}
const SF = 'var(--font-system)'

export default function RamsPage() {
  const [docs, setDocs] = useState<Rams[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | Rams['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [signing, setSigning] = useState<string | null>(null)
  const [signName, setSignName] = useState('')

  const [form, setForm] = useState({
    projectId: '', title: '', type: 'rams' as Rams['type'],
    hazards: '', controls: '', ppe: '', reviewBy: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  const [showGenerate, setShowGenerate] = useState(false)
  const [genProjectId, setGenProjectId] = useState('')
  const [genTemplate, setGenTemplate] = useState(RAMS_TEMPLATE_KEYS[0])
  const [genDescription, setGenDescription] = useState('')
  const [genAi, setGenAi] = useState(false)
  const [genSaving, setGenSaving] = useState(false)

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const [rRes, prjRes] = await Promise.all([
        fetch(`/api/rams?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!rRes.ok) throw new Error('Failed to load RAMS docs')
      const rd = await rRes.json()
      setDocs(rd.docs || [])
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

  // "Review due within 14d" threshold captured once via useState's lazy
  // initializer (guaranteed to run exactly once).
  const [reviewDueThreshold] = useState(() => Date.now() + 1000 * 60 * 60 * 24 * 14)

  const resetForm = () => {
    setForm({ projectId: projects[0]?.id || '', title: '', type: 'rams', hazards: '', controls: '', ppe: 'Hard hat\nHi-vis\nSafety boots', reviewBy: '' })
    setEditingId(null)
  }

  const openAdd = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (d: Rams) => {
    setEditingId(d.id)
    setForm({
      projectId: d.projectId,
      title: d.title,
      type: d.type,
      hazards: d.hazards || '',
      controls: d.controls || '',
      ppe: d.ppe || '',
      reviewBy: d.reviewBy ? new Date(d.reviewBy).toISOString().split('T')[0] : '',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.projectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setSaving(true)
    try {
      const payload = {
        projectId: form.projectId,
        title: form.title.trim(),
        type: form.type,
        hazards: form.hazards || null,
        controls: form.controls || null,
        ppe: form.ppe || null,
        reviewBy: form.reviewBy || null,
      }
      if (editingId) {
        const res = await fetch(`/api/rams/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to update')
        setToast({ msg: 'Document updated', type: 'success' })
      } else {
        const res = await fetch('/api/rams', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'draft' }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to save')
        setToast({ msg: 'Document added', type: 'success' })
      }
      setShowModal(false)
      resetForm()
      load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' }) }
    finally { setSaving(false) }
  }

  const setStatus = async (d: Rams, status: Rams['status']) => {
    try {
      const res = await fetch(`/api/rams/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error()
      load()
    } catch { setToast({ msg: 'Update failed', type: 'error' }) }
  }

  const sign = async (id: string) => {
    if (!signName.trim()) return setToast({ msg: 'Enter your name', type: 'error' })
    try {
      const res = await fetch(`/api/rams/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedBy: signName.trim(), status: 'active' }) })
      if (!res.ok) throw new Error()
      setSigning(null); setSignName(''); setToast({ msg: 'Signed off', type: 'success' }); load()
    } catch { setToast({ msg: 'Sign-off failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/rams/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  const generate = async () => {
    if (!genProjectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setGenSaving(true)
    try {
      const res = await fetch('/api/rams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: genProjectId,
          template: genTemplate,
          workDescription: genDescription,
          ai: genAi,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Generate failed')
      setToast({ msg: 'RAMS generated', type: 'success' })
      setShowGenerate(false)
      setGenDescription('')
      setGenAi(false)
      load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Generate failed', type: 'error' })
    } finally {
      setGenSaving(false)
    }
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
              <IcHardhat size={20} color="#22c55e" /> RAMS
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {docs.length} documents · {docs.filter(d => d.status === 'active').length} active
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setGenProjectId(projects[0]?.id || ''); setShowGenerate(true) }} aria-label="Generate RAMS" style={{ background: '#8b5cf6', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <IcSpark size={14} color="#fff" />
              <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Generate</span>
            </button>
            <button onClick={openAdd} aria-label="Add RAMS" style={{ background: '#22c55e', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <IcPlus size={14} color="#fff" />
              <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Add</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {(['all', 'draft', 'active', 'expired', 'archived'] as const).map(s => {
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ background: active ? '#22c55e' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: active ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0, textTransform: 'capitalize' }}>
              {s}
            </button>
          )
        })}
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && docs.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No RAMS yet. Add one before your team starts work.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {docs.map(d => {
          const reviewDue = d.reviewBy && new Date(d.reviewBy).getTime() < reviewDueThreshold
          return (
            <div key={d.id} style={{ background: '#152641', border: `0.5px solid ${reviewDue && d.status === 'active' ? '#f59e0b66' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ background: '#1a2f4e', color: '#c1d2e8', padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{TYPE_LABEL[d.type]}</span>
                    <span style={{ background: STATUS_COLOR[d.status] + '33', color: STATUS_COLOR[d.status], padding: '2px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{d.status}</span>
                    {d.signedBy && <span style={{ color: '#10b981', fontFamily: SF, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}><IcCheck size={10} color="#10b981" /> Signed</span>}
                    {reviewDue && d.status === 'active' && <span style={{ color: '#f59e0b', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>REVIEW DUE</span>}
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                    {d.project?.name || '—'}{d.reviewBy ? ` · review by ${new Date(d.reviewBy).toLocaleDateString('en-GB')}` : ''}
                    {d.signedBy ? ` · signed by ${d.signedBy} on ${d.signedAt ? new Date(d.signedAt).toLocaleDateString('en-GB') : ''}` : ''}
                  </div>
                  {(d.hazards || d.controls || d.ppe) && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {d.hazards && <Section label="Hazards" body={d.hazards} />}
                      {d.controls && <Section label="Controls" body={d.controls} />}
                      {d.ppe && <Section label="PPE" body={d.ppe} />}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {d.status === 'draft' && !d.signedBy && (
                  <button onClick={() => { setSigning(d.id); setSignName('') }} style={pillBtn('#10b981')}>Sign off & activate</button>
                )}
                {d.status === 'active' && (
                  <button onClick={() => setStatus(d, 'expired')} style={pillBtn('#1a2f4e', '#fca5a5')}>Expire</button>
                )}
                {(d.status === 'expired' || d.status === 'archived') && (
                  <button onClick={() => setStatus(d, 'draft')} style={pillBtn('#1a2f4e', '#c1d2e8')}>Reopen draft</button>
                )}
                {d.status !== 'archived' && (
                  <button onClick={() => setStatus(d, 'archived')} style={pillBtn('#1a2f4e', '#c1d2e8')}>Archive</button>
                )}
                <button onClick={() => openEdit(d)} aria-label="Edit RAMS" style={pillBtn('#1a2f4e', '#8ea8c5')}>
                  <IcEdit size={11} color="#8ea8c5" /> Edit
                </button>
                <button onClick={() => setConfirmDelete(d.id)} aria-label="Delete RAMS" style={pillBtn('transparent', '#fca5a5', '#ef444466')}>
                  <IcTrash size={11} color="#fca5a5" /> Delete
                </button>
              </div>
              {signing === d.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(16,185,129,0.1)', border: '0.5px solid rgba(16,185,129,0.4)', borderRadius: 8 }}>
                  <div style={{ fontFamily: SF, fontSize: 12, color: '#10b981', marginBottom: 6 }}>Sign as:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" value={signName} onChange={e => setSignName(e.target.value)} placeholder="Your name" autoFocus style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => setSigning(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => sign(d.id)} style={{ background: '#10b981', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Sign</button>
                  </div>
                </div>
              )}
              {confirmDelete === d.id && (
                <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this document?</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => remove(d.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal
        open={showGenerate}
        title="Generate RAMS from template"
        onClose={() => setShowGenerate(false)}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 18 }}>
            <Button variant="ghost" onClick={() => setShowGenerate(false)} disabled={genSaving}>Cancel</Button>
            <Button variant="primary" loading={genSaving} onClick={generate}>Generate draft</Button>
          </div>
        }
      >
        <FormField
          id="gen-project"
          as="select"
          label="Project *"
          value={genProjectId}
          onChange={e => setGenProjectId(e.target.value)}
          options={[{ value: '', label: 'Select…' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
        />

        <FormField
          id="gen-template"
          as="select"
          label="Template *"
          value={genTemplate}
          onChange={e => setGenTemplate(e.target.value)}
          options={RAMS_TEMPLATE_KEYS.map(k => ({ value: k, label: RAMS_TEMPLATES[k].title }))}
        />

        <FormField
          id="gen-desc"
          as="textarea"
          label="Work description"
          value={genDescription}
          onChange={e => setGenDescription(e.target.value)}
          placeholder="e.g. Installing fascia boards to gable end using MEWP"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <input
            id="gen-ai"
            type="checkbox"
            checked={genAi}
            onChange={e => setGenAi(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#8b5cf6' }}
          />
          <label htmlFor="gen-ai" style={{ fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>
            Enhance with AI (requires local LLM)
          </label>
        </div>
      </Modal>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => { setShowModal(false); resetForm() }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0a1426', width: '100%', maxHeight: '85vh', borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>{editingId ? 'Edit RAMS document' : 'Add RAMS document'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
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
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Working at height — gable end" />
              </Field>
              <Field label="Type">
                <div style={{ display: 'flex', gap: 6 }}>
                  {(Object.keys(TYPE_LABEL) as Rams['type'][]).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ background: form.type === t ? '#22c55e' : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.type === t ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Hazards (one per line)">
                <textarea value={form.hazards} onChange={e => setForm(f => ({ ...f, hazards: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Fall from height\nFalling tools\nWeather (wind > 23 mph)" />
              </Field>
              <Field label="Controls / mitigations">
                <textarea value={form.controls} onChange={e => setForm(f => ({ ...f, controls: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Scaffold inspected by competent person before each use…" />
              </Field>
              <Field label="PPE required (one per line)">
                <textarea value={form.ppe} onChange={e => setForm(f => ({ ...f, ppe: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <Field label="Review by">
                <input type="date" value={form.reviewBy} onChange={e => setForm(f => ({ ...f, reviewBy: e.target.value }))} style={inputStyle} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#22c55e', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : (editingId ? 'Save changes' : 'Save document')}
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

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ background: '#0a1426', borderRadius: 8, padding: 8 }}>
      <div style={{ fontFamily: SF, fontSize: 10, color: '#8ea8c5', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: SF, fontSize: 12, color: '#c1d2e8', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{body}</div>
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

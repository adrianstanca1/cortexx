'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcLayers, IcChevL, IcPlus, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Drawing {
  id: string
  number: string | null
  title: string
  discipline: 'arch' | 'struct' | 'mep' | 'civil' | 'fire' | 'other'
  revision: string
  fileUrl: string | null
  uploadedBy: string | null
  notes: string | null
  isSuperseded: boolean
  supersededAt: string | null
  createdAt: string
  updatedAt: string
  projectId: string
  project?: { id: string; name: string } | null
}

interface Project { id: string; name: string }

const DISC_LABEL: Record<Drawing['discipline'], string> = {
  arch: 'Architectural',
  struct: 'Structural',
  mep: 'MEP',
  civil: 'Civil',
  fire: 'Fire',
  other: 'Other',
}
const DISC_COLOR: Record<Drawing['discipline'], string> = {
  arch: '#3b82f6',
  struct: '#8b5cf6',
  mep: '#f59e0b',
  civil: '#22c55e',
  fire: '#ef4444',
  other: '#52749a',
}
const SF = 'var(--font-system)'

export default function DrawingsPage() {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [discFilter, setDiscFilter] = useState<'all' | Drawing['discipline']>('all')
  const [includeSuperseded, setIncludeSuperseded] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  const [form, setForm] = useState({
    projectId: '',
    number: '',
    title: '',
    discipline: 'arch' as Drawing['discipline'],
    revision: 'C01',
    fileUrl: '',
    notes: '',
  })

  useModalEffects(showModal, () => setShowModal(false))

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (discFilter !== 'all') params.set('discipline', discFilter)
      if (includeSuperseded) params.set('includeSuperseded', '1')
      if (search.trim()) params.set('q', search.trim())
      const [drawingsRes, projectsRes] = await Promise.all([
        fetch(`/api/drawings?${params.toString()}`),
        fetch('/api/projects?status=active'),
      ])
      if (!drawingsRes.ok) throw new Error('Failed to load drawings')
      const drawingsData = await drawingsRes.json()
      setDrawings(drawingsData.drawings || [])
      if (projectsRes.ok) {
        const pd = await projectsRes.json()
        setProjects((pd.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [discFilter, includeSuperseded, search])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ projectId: projects[0]?.id || '', number: '', title: '', discipline: 'arch', revision: 'C01', fileUrl: '', notes: '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.title.trim()) return setToast({ msg: 'Title is required', type: 'error' })
    if (!form.projectId) return setToast({ msg: 'Pick a project', type: 'error' })
    setSaving(true)
    try {
      const res = await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setToast({ msg: 'Drawing added', type: 'success' })
      setShowModal(false)
      load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Save failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const supersede = async (d: Drawing) => {
    try {
      const res = await fetch(`/api/drawings/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuperseded: !d.isSuperseded }),
      })
      if (!res.ok) throw new Error()
      setToast({ msg: d.isSuperseded ? 'Restored' : 'Superseded', type: 'success' })
      load()
    } catch {
      setToast({ msg: 'Failed to update', type: 'error' })
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/drawings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null)
      setToast({ msg: 'Drawing deleted', type: 'success' })
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
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
              <IcLayers size={20} color="#2563eb" /> Drawings
            </h1>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {drawings.length} active{includeSuperseded ? ' + superseded' : ''}
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add drawing" style={{ background: '#2563eb', border: 'none', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <IcPlus size={14} color="#fff" />
            <span style={{ fontFamily: SF, fontSize: 13, color: '#fff', fontWeight: 600 }}>Upload</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {(['all', 'arch', 'struct', 'mep', 'civil', 'fire', 'other'] as const).map(d => {
          const active = discFilter === d
          const color = d === 'all' ? '#2563eb' : DISC_COLOR[d as Drawing['discipline']]
          return (
            <button key={d} onClick={() => setDiscFilter(d)} style={{ background: active ? color : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 12, color: active ? '#fff' : '#c1d2e8', fontWeight: 600, flexShrink: 0 }}>
              {d === 'all' ? 'All' : DISC_LABEL[d as Drawing['discipline']]}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or number…"
          style={{ flex: 1, background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: '#eef3fa', fontFamily: SF, fontSize: 13, outline: 'none' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: SF, fontSize: 12, color: '#8ea8c5', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeSuperseded} onChange={e => setIncludeSuperseded(e.target.checked)} />
          Superseded
        </label>
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && drawings.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No drawings yet. Tap Upload to add the first.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
        {drawings.map(d => (
          <div key={d.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14, opacity: d.isSuperseded ? 0.5 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: DISC_COLOR[d.discipline] + '33', border: `0.5px solid ${DISC_COLOR[d.discipline]}66`, color: DISC_COLOR[d.discipline], padding: '2px 7px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {d.discipline}
                  </span>
                  <span style={{ background: '#1a2f4e', color: '#c1d2e8', padding: '2px 7px', borderRadius: 6, fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>Rev {d.revision}</span>
                  {d.isSuperseded && <span style={{ color: '#52749a', fontFamily: SF, fontSize: 10 }}>SUPERSEDED</span>}
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.number ? `${d.number} — ` : ''}{d.title}
                </div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                  {d.project?.name || '—'} · {new Date(d.updatedAt).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {d.fileUrl && (
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#1a2f4e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', textDecoration: 'none', color: '#c1d2e8', fontFamily: SF, fontSize: 12, fontWeight: 600 }}>Open file ↗</a>
              )}
              <button onClick={() => supersede(d)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {d.isSuperseded ? 'Restore' : 'Supersede'}
              </button>
              <button onClick={() => setConfirmDelete(d.id)} aria-label="Delete drawing" style={{ background: 'transparent', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '6px 10px', color: '#fca5a5', fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={11} color="#fca5a5" /> Delete
              </button>
            </div>
            {confirmDelete === d.id && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: SF, fontSize: 12, color: '#fca5a5' }}>Delete this drawing entry?</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 10px', color: '#c1d2e8', fontFamily: SF, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => remove(d.id)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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
              <h2 style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: '#eef3fa' }}>Upload drawing</h2>
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
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="Ground floor plan" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Drawing number">
                  <input type="text" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} style={inputStyle} placeholder="A-100" />
                </Field>
                <Field label="Revision">
                  <input type="text" value={form.revision} onChange={e => setForm(f => ({ ...f, revision: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label="Discipline">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['arch', 'struct', 'mep', 'civil', 'fire', 'other'] as const).map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, discipline: d }))} style={{ background: form.discipline === d ? DISC_COLOR[d] : '#152641', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: form.discipline === d ? '#fff' : '#c1d2e8', fontFamily: SF, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {DISC_LABEL[d]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="File URL">
                <input type="url" value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} style={inputStyle} placeholder="https://drive.example.com/…" />
              </Field>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </Field>
              <button onClick={save} disabled={saving} style={{ background: '#2563eb', border: 'none', borderRadius: 10, padding: 12, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save drawing'}
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
  return (
    <div>
      <label style={{ display: 'block', fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

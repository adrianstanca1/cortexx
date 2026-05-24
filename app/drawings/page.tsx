'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcLayers, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcDoc } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Project { id: string; name: string }
interface Revision {
  id: string
  drawingId: string
  revision: string
  fileUrl: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string | null
  notes: string | null
  uploadedAt: string
}
interface Drawing {
  id: string
  projectId: string
  number: string
  title: string
  discipline: string | null
  status: 'draft' | 'approved' | 'superseded' | 'archived'
  notes: string | null
  archivedAt: string | null
  createdAt: string
  project?: Project | null
  revisions: Revision[]
  _count?: { revisions: number }
}

const SF = 'var(--font-system)'
const DISCIPLINES = ['Architectural', 'Structural', 'Electrical', 'Mechanical', 'Plumbing', 'Civil', 'Fire', 'Landscape']
const STATUS_COLOR: Record<Drawing['status'], string> = { draft: '#52749a', approved: '#22c55e', superseded: '#f59e0b', archived: '#6b7280' }
const STATUS_LABEL: Record<Drawing['status'], string> = { draft: 'Draft', approved: 'Approved', superseded: 'Superseded', archived: 'Archived' }

export default function DrawingsPage() {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [disciplines, setDisciplines] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filterProj, setFilterProj] = useState<string | null>(null)
  const [filterDisc, setFilterDisc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeDwg, setActiveDwg] = useState<Drawing | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingRev, setUploadingRev] = useState(false)

  // AI revision compare state — scoped to the active drawing's detail sheet.
  const [compareSelection, setCompareSelection] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  type RevCompareResult = {
    summary: string
    changes: { description: string; severity: 'minor' | 'moderate' | 'major'; affects?: string }[]
    designIntent: 'preserved' | 'modified' | 'unclear'
    reviewRecommended: boolean
    notes?: string
    earlier?: { revision: string }
    later?: { revision: string }
  }
  const [revCompareResult, setRevCompareResult] = useState<RevCompareResult | null>(null)
  const [revCompareError, setRevCompareError] = useState<string | null>(null)

  const runRevCompare = async (drawingId: string) => {
    if (compareSelection.length !== 2) return
    setComparing(true)
    setRevCompareResult(null)
    setRevCompareError(null)
    try {
      const res = await fetch(`/api/drawings/${drawingId}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aRev: compareSelection[0], bRev: compareSelection[1] }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.code === 'VISION_UNAVAILABLE'
          ? `Vision model not installed. Run: ollama pull ${json.config?.model || 'moondream'}`
          : json.code === 'UNREADABLE_FORMAT'
          ? json.error
          : json.error || 'Failed to compare revisions'
        setRevCompareError(msg)
        return
      }
      setRevCompareResult(json)
      setToast({ msg: `Compared — ${(json.changes || []).length} change${(json.changes || []).length === 1 ? '' : 's'} flagged` })
    } catch (e) {
      setRevCompareError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setComparing(false)
    }
  }
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const revFileInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ projectId: '', number: '', title: '', discipline: 'Architectural', notes: '' })
  const [revLabel, setRevLabel] = useState('A')
  const [revNotes, setRevNotes] = useState('')

  useModalEffects(showAdd || activeDwg !== null, () => { setShowAdd(false); setActiveDwg(null); setCompareSelection([]); setRevCompareResult(null); setRevCompareError(null) })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (filterProj) params.set('projectId', filterProj)
    if (filterDisc) params.set('discipline', filterDisc)
    fetch(`/api/drawings?${params}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setDrawings(d.drawings || []); setDisciplines(d.disciplines || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
      setProjects(ps)
      setForm(prev => prev.projectId ? prev : { ...prev, projectId: ps[0]?.id || '' })
    }).catch(() => {})
  }, [filterProj, filterDisc])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.title.trim() || !form.projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/drawings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: form.projectId,
          number: form.number.trim() || undefined,
          title: form.title.trim(),
          discipline: form.discipline || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowAdd(false)
      setForm(prev => ({ ...prev, number: '', title: '', notes: '' }))
      load()
      setToast({ msg: 'Drawing added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally { setSaving(false) }
  }

  const uploadRevision = async (file: File) => {
    if (!activeDwg || !revLabel.trim()) return
    setUploadingRev(true)
    try {
      // Upload bytes via /api/uploads
      const fd = new FormData()
      fd.append('file', file, file.name)
      const up = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!up.ok) throw new Error((await up.json().catch(() => ({})) as { error?: string }).error || 'Upload failed')
      const uploaded = await up.json() as { url: string; size: number; mimeType: string }
      // Create revision row
      const res = await fetch(`/api/drawings/${activeDwg.id}/revisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: revLabel.trim(),
          fileUrl: uploaded.url,
          fileName: file.name,
          fileSize: uploaded.size,
          mimeType: uploaded.mimeType,
          notes: revNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      // Refresh detail
      const refreshed = await fetch(`/api/drawings/${activeDwg.id}`).then(r => r.json()).catch(() => null)
      if (refreshed?.drawing) setActiveDwg(refreshed.drawing)
      load()
      setRevNotes('')
      setRevLabel(nextRevisionLabel(revLabel))
      setToast({ msg: `Rev ${revLabel} uploaded` })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Upload failed', type: 'error' })
    } finally {
      setUploadingRev(false)
    }
  }

  const setStatus = async (d: Drawing, status: Drawing['status']) => {
    try {
      const res = await fetch(`/api/drawings/${d.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (activeDwg?.id === d.id) setActiveDwg({ ...updated, revisions: activeDwg.revisions })
      load()
    } catch { setToast({ msg: 'Status change failed', type: 'error' }) }
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id); setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000); return
    }
    setConfirmDelete(null)
    try {
      const res = await fetch(`/api/drawings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setActiveDwg(null); load()
    } catch { setToast({ msg: 'Delete failed', type: 'error' }) }
  }

  const openDetail = async (d: Drawing) => {
    setActiveDwg(d)
    const fresh = await fetch(`/api/drawings/${d.id}`).then(r => r.json()).catch(() => null)
    if (fresh?.drawing) setActiveDwg(fresh.drawing)
  }

  // Group by project for the list
  const grouped: Record<string, { project: Project | null; items: Drawing[] }> = {}
  for (const d of drawings) {
    const key = d.project?.id || '_'
    if (!grouped[key]) grouped[key] = { project: d.project || null, items: [] }
    grouped[key].items.push(d)
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Drawings</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{drawings.length} drawings</p>
          </div>
          <button onClick={() => setShowAdd(true)} disabled={projects.length === 0} aria-label="Add drawing" style={{ width: 36, height: 36, borderRadius: 10, background: projects.length === 0 ? 'rgba(37,99,235,0.3)' : '#2563eb', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: projects.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button onClick={() => setFilterProj(null)} style={chip(!filterProj, '#2563eb')}>All projects</button>
          {projects.map(p => (
            <button key={p.id} onClick={() => setFilterProj(p.id)} style={chip(filterProj === p.id, '#2563eb')}>{p.name}</button>
          ))}
        </div>
        {disciplines.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 4 }}>
            <button onClick={() => setFilterDisc(null)} style={chip(!filterDisc, '#06b6d4', true)}>All disciplines</button>
            {disciplines.map(d => (
              <button key={d} onClick={() => setFilterDisc(d)} style={chip(filterDisc === d, '#06b6d4', true)}>{d}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : drawings.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcLayers size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No drawings</p>
          {projects.length > 0 && (
            <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add first drawing</button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.values(grouped).map(g => (
            <div key={g.project?.id || 'unassigned'}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingLeft: 4 }}>{g.project?.name || 'Unassigned'} · {g.items.length}</div>
              <div style={{ background: '#152641', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {g.items.map((d, i) => {
                  const currentRev = d.revisions[0]
                  return (
                    <button key={d.id} onClick={() => openDetail(d)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: i < g.items.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: '#2563eb22', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700 }}>
                        {currentRev?.revision || '—'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#52749a', fontWeight: 700 }}>{d.number}</span>
                          <span style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                        </div>
                        <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 1 }}>
                          {d.discipline || 'Unset'} · {d._count?.revisions || 0} rev{(d._count?.revisions || 0) === 1 ? '' : 's'}
                        </div>
                      </div>
                      <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 99, background: `${STATUS_COLOR[d.status]}22`, color: STATUS_COLOR[d.status], fontFamily: SF, fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COLOR[d.status]}55`, textTransform: 'uppercase' }}>{STATUS_LABEL[d.status]}</span>
                    </button>
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Add drawing</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>
            <div>
              <label style={labelStyle}>Project</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
              <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="Auto" style={inputStyle} />
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Drawing title" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Discipline</label>
              <select value={form.discipline} onChange={e => setForm(p => ({ ...p, discipline: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
            <button onClick={create} disabled={saving || !form.title.trim() || !form.projectId} style={{ padding: '14px 0', borderRadius: 14, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Add</>}
            </button>
          </div>
        </div>
      )}

      {activeDwg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setActiveDwg(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a', fontWeight: 700 }}>{activeDwg.number}</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: SF, marginTop: 2 }}>{activeDwg.title}</h2>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>{activeDwg.discipline || 'Unset'}{activeDwg.project ? ` · ${activeDwg.project.name}` : ''}</div>
              </div>
              <button onClick={() => setActiveDwg(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['draft', 'approved', 'superseded', 'archived'] as const).map(s => (
                <button key={s} onClick={() => setStatus(activeDwg, s)} disabled={activeDwg.status === s} style={{ padding: '4px 10px', borderRadius: 99, border: `0.5px solid ${activeDwg.status === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.1)'}`, background: activeDwg.status === s ? `${STATUS_COLOR[s]}22` : 'rgba(255,255,255,0.04)', color: activeDwg.status === s ? STATUS_COLOR[s] : '#8ea8c5', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: activeDwg.status === s ? 'default' : 'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <div style={{ background: '#1a2f4e', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Upload new revision</div>
              <input ref={revFileInput} type="file" accept=".pdf,image/*,.dwg" onChange={e => { const f = e.target.files?.[0]; if (f) uploadRevision(f); e.target.value = '' }} style={{ display: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 6 }}>
                <input value={revLabel} onChange={e => setRevLabel(e.target.value.toUpperCase())} placeholder="Rev" maxLength={10} style={{ ...inputStyle, padding: '8px 10px', fontSize: 13, textAlign: 'center', fontFamily: 'ui-monospace, monospace' }} />
                <input value={revNotes} onChange={e => setRevNotes(e.target.value)} placeholder="Revision notes (optional)" style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }} />
              </div>
              <button onClick={() => revFileInput.current?.click()} disabled={uploadingRev || !revLabel.trim()} style={{ padding: '8px 12px', borderRadius: 8, background: '#2563eb', border: 'none', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: uploadingRev ? 'wait' : 'pointer', opacity: !revLabel.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {uploadingRev ? 'Uploading…' : <><IcDoc size={12} color="#fff" /> Upload PDF / image</>}
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Revisions ({activeDwg.revisions.length})</div>
                {activeDwg.revisions.length >= 2 && (
                  <button
                    onClick={() => setCompareSelection(prev => prev.length === 0 && activeDwg.revisions.length >= 2 ? [activeDwg.revisions[1].id, activeDwg.revisions[0].id] : [])}
                    style={{ background: compareSelection.length > 0 ? '#8b5cf6' : 'rgba(139,92,246,0.15)', border: '0.5px solid rgba(139,92,246,0.4)', color: compareSelection.length > 0 ? '#fff' : '#a78bfa', borderRadius: 8, padding: '4px 10px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {compareSelection.length > 0 ? `Comparing ${compareSelection.length}/2` : '✨ Compare revs'}
                  </button>
                )}
              </div>
              {activeDwg.revisions.length === 0 ? (
                <div style={{ padding: 12, fontFamily: SF, fontSize: 12, color: '#52749a', textAlign: 'center', background: '#1a2f4e', borderRadius: 8 }}>No revisions uploaded yet</div>
              ) : (
                <div style={{ background: '#1a2f4e', borderRadius: 10, overflow: 'hidden' }}>
                  {activeDwg.revisions.map((r, i) => {
                    const selIdx = compareSelection.indexOf(r.id)
                    const isSel = selIdx !== -1
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < activeDwg.revisions.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', background: isSel ? 'rgba(139,92,246,0.10)' : 'transparent' }}>
                        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: i === 0 ? '#22c55e22' : '#52749a22', color: i === 0 ? '#22c55e' : '#52749a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700 }}>{r.revision}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: SF, fontSize: 12, color: '#eef3fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName || 'No file'}</div>
                          <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 1 }}>
                            {new Date(r.uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {r.fileSize !== null && ` · ${(r.fileSize / 1024).toFixed(0)} KB`}
                            {i === 0 && <span style={{ color: '#22c55e', fontWeight: 700, marginLeft: 4 }}>· CURRENT</span>}
                          </div>
                        </div>
                        {compareSelection.length > 0 && r.fileUrl && (
                          <button
                            onClick={() => {
                              setCompareSelection(prev => {
                                if (prev.includes(r.id)) return prev.filter(x => x !== r.id)
                                if (prev.length >= 2) return [prev[1], r.id]
                                return [...prev, r.id]
                              })
                            }}
                            style={{ background: isSel ? '#8b5cf6' : 'rgba(139,92,246,0.15)', border: '0.5px solid rgba(139,92,246,0.4)', color: isSel ? '#fff' : '#a78bfa', borderRadius: 6, padding: '4px 8px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer', minWidth: 28 }}
                          >
                            {isSel ? selIdx + 1 : '+'}
                          </button>
                        )}
                        {r.fileUrl && (
                          <a href={r.fileUrl} target="_blank" rel="noreferrer" style={{ background: 'rgba(37,99,235,0.2)', border: '0.5px solid rgba(37,99,235,0.4)', color: '#60a5fa', borderRadius: 6, padding: '4px 10px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>Open</a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {compareSelection.length === 2 && (
                <button
                  onClick={() => runRevCompare(activeDwg.id)}
                  disabled={comparing}
                  style={{ marginTop: 8, width: '100%', background: '#8b5cf6', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 12px', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: comparing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  ✨ {comparing ? 'Comparing revisions… (30–90s)' : 'Run AI compare'}
                </button>
              )}
              {revCompareResult && (
                <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(139,92,246,0.08)', borderRadius: 10, borderLeft: '3px solid #a78bfa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI comparison</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#8ea8c5' }}>
                      {revCompareResult.earlier?.revision} → {revCompareResult.later?.revision}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 99, background: revCompareResult.designIntent === 'preserved' ? 'rgba(34,197,94,0.18)' : revCompareResult.designIntent === 'modified' ? 'rgba(245,158,11,0.18)' : 'rgba(82,116,154,0.18)', color: revCompareResult.designIntent === 'preserved' ? '#22c55e' : revCompareResult.designIntent === 'modified' ? '#f59e0b' : '#8ea8c5', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{revCompareResult.designIntent}</span>
                    {revCompareResult.reviewRecommended && <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.18)', color: '#ef4444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>review</span>}
                  </div>
                  {revCompareResult.summary && <div style={{ fontFamily: SF, fontSize: 12, color: '#eef3fa', marginBottom: 8, lineHeight: 1.4 }}>{revCompareResult.summary}</div>}
                  {revCompareResult.changes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {revCompareResult.changes.map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: SF, fontSize: 9, fontWeight: 700, color: c.severity === 'major' ? '#ef4444' : c.severity === 'moderate' ? '#f59e0b' : '#52749a', textTransform: 'uppercase', letterSpacing: 0.4, padding: '1px 5px', borderRadius: 3, background: c.severity === 'major' ? 'rgba(239,68,68,0.18)' : c.severity === 'moderate' ? 'rgba(245,158,11,0.18)' : 'rgba(82,116,154,0.18)', flexShrink: 0, marginTop: 1 }}>{c.severity}</span>
                          <span style={{ fontFamily: SF, fontSize: 12, color: '#eef3fa', lineHeight: 1.35 }}>
                            {c.description}{c.affects && <span style={{ color: '#8ea8c5' }}> · {c.affects}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {revCompareResult.notes && <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 6, fontStyle: 'italic' }}>Note: {revCompareResult.notes}</div>}
                </div>
              )}
              {revCompareError && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, fontFamily: SF, fontSize: 12, color: '#ef4444' }}>{revCompareError}</div>
              )}
            </div>

            <button onClick={() => remove(activeDwg.id)} style={{ marginTop: 4, padding: '10px', borderRadius: 10, background: confirmDelete === activeDwg.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${confirmDelete === activeDwg.id ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, color: '#ef4444', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IcTrash size={12} color="#ef4444" /> {confirmDelete === activeDwg.id ? 'Sure?' : 'Delete drawing'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function nextRevisionLabel(current: string): string {
  // A → B → C, P01 → P02
  const m = current.match(/^([A-Za-z]*)(\d*)$/)
  if (!m) return current
  const prefix = m[1]
  const num = m[2]
  if (num) {
    const padded = String(parseInt(num) + 1).padStart(num.length, '0')
    return prefix + padded
  }
  if (prefix.length === 1) {
    const code = prefix.toUpperCase().charCodeAt(0)
    if (code >= 65 && code < 90) return String.fromCharCode(code + 1)
  }
  return current
}

const chip = (active: boolean, color: string, sub?: boolean): React.CSSProperties => ({
  flexShrink: 0, padding: sub ? '3px 9px' : '4px 10px', borderRadius: 99, border: 'none',
  background: active ? color : 'rgba(255,255,255,0.06)',
  color: active ? '#fff' : '#52749a',
  fontFamily: SF, fontSize: sub ? 10 : 11, fontWeight: active ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
})
const labelStyle: React.CSSProperties = { fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box' }

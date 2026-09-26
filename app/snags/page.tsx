'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcAlert, IcChevL, IcPlus, IcX, IcCheck, IcTrash, IcCamera, IcSpark } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Defect { description: string; severity: 'cosmetic' | 'minor' | 'major' | 'safety'; location?: string }
interface Analysis { defects: Defect[]; summary: string; notes?: string; loading?: boolean; error?: string }
const SEVERITY_COLOR: Record<Defect['severity'], string> = {
  cosmetic: 'var(--t3)',
  minor: '#3b82f6',
  major: '#f59e0b',
  safety: '#ef4444',
}

interface CloseoutEvidence { photoUrls?: string[]; signatureUrl?: string | null }

interface Snag {
  id: string
  title: string
  description: string | null
  location: string | null
  status: 'open' | 'in_progress' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  photoUrl: string | null
  dueDate: string | null
  resolution: string | null
  closeoutEvidence: CloseoutEvidence
  closedBy: string | null
  closeoutVerifiedAt: string | null
  closedAt: string | null
  createdAt: string
  projectId: string
  project?: { id: string; name: string } | null
}

interface Project { id: string; name: string }

const STATUS_COLOR: Record<Snag['status'], string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  closed: '#10b981',
}
const STATUS_LABEL: Record<Snag['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
}
const NEXT_STATUS: Record<Snag['status'], Snag['status']> = {
  open: 'in_progress',
  in_progress: 'closed',
  closed: 'open',
}
const PRIORITY_COLOR: Record<Snag['priority'], string> = {
  low: 'var(--t3)',
  medium: '#06b6d4',
  high: '#f59e0b',
  critical: '#ef4444',
}
const SF = 'var(--font-system)'

export default function SnagsPage() {
  const [snags, setSnags] = useState<Snag[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Snag['status']>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})
  const photoInputRef = useRef<HTMLInputElement>(null)
  const closeoutInputRef = useRef<HTMLInputElement>(null)
  const [closeoutSnag, setCloseoutSnag] = useState<Snag | null>(null)
  const [closeoutResolution, setCloseoutResolution] = useState('')
  const [closeoutPhotoUrl, setCloseoutPhotoUrl] = useState('')
  const [closeoutUploading, setCloseoutUploading] = useState(false)
  const [closeoutSaving, setCloseoutSaving] = useState(false)

  const analyze = async (snagId: string) => {
    setAnalyses(prev => ({ ...prev, [snagId]: { ...(prev[snagId] || { defects: [], summary: '' }), loading: true, error: undefined } }))
    try {
      const res = await fetch(`/api/snags/${snagId}/analyze`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.code === 'VISION_UNAVAILABLE'
          ? `Vision model not installed on server. Run: ollama pull ${json.config?.model || 'moondream'}`
          : json.error || 'Failed to analyse'
        setAnalyses(prev => ({ ...prev, [snagId]: { defects: [], summary: '', loading: false, error: msg } }))
        return
      }
      setAnalyses(prev => ({ ...prev, [snagId]: { defects: json.defects || [], summary: json.summary || '', notes: json.notes, loading: false } }))
      setToast({ msg: `Analysed — ${(json.defects || []).length} defect${(json.defects || []).length === 1 ? '' : 's'} flagged` })
    } catch (e) {
      setAnalyses(prev => ({ ...prev, [snagId]: { defects: [], summary: '', loading: false, error: e instanceof Error ? e.message : 'Failed' } }))
    }
  }
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    priority: 'medium' as Snag['priority'],
    projectId: '',
    dueDate: '',
    photoUrl: '',
  })
  const [photoUploading, setPhotoUploading] = useState(false)

  useModalEffects(showModal, () => setShowModal(false))
  useModalEffects(Boolean(closeoutSnag), () => setCloseoutSnag(null))

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setShowModal(true)
  }, [])

  const load = useCallback(() => {
    fetch('/api/snags')
      .then(r => { if (!r.ok) throw new Error('Failed to load snags'); return r.json() })
      .then(d => { setSnags(d.snags || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => {
        const ps: Project[] = (d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        setProjects(ps)
        setForm(prev => prev.projectId ? prev : { ...prev, projectId: ps[0]?.id || '' })
      })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const uploadPhoto = useCallback(async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setToast({ msg: `Photo too large (max 25 MB). This is ${Math.round(file.size / 1024 / 1024)} MB.`, type: 'error' })
      return
    }
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Upload failed')
      const data = await res.json() as { url: string }
      setForm(prev => ({ ...prev, photoUrl: data.url }))
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Photo upload failed', type: 'error' })
    } finally {
      setPhotoUploading(false)
    }
  }, [])

  const uploadCloseoutPhoto = useCallback(async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setToast({ msg: `Photo too large (max 25 MB). This is ${Math.round(file.size / 1024 / 1024)} MB.`, type: 'error' })
      return
    }
    setCloseoutUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Upload failed')
      const data = await res.json() as { url: string }
      setCloseoutPhotoUrl(data.url)
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Closeout photo upload failed', type: 'error' })
    } finally {
      setCloseoutUploading(false)
    }
  }, [])

  const create = async () => {
    if (!form.title.trim() || !form.projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/snags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          priority: form.priority,
          projectId: form.projectId,
          dueDate: form.dueDate || null,
          photoUrl: form.photoUrl || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      const newSnag = await res.json()
      setSnags(prev => [newSnag, ...prev])
      setShowModal(false)
      setForm({ title: '', description: '', location: '', priority: 'medium', projectId: form.projectId, dueDate: '', photoUrl: '' })
      setToast({ msg: 'Snag raised' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to add snag', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const cycleStatus = async (s: Snag) => {
    const next = NEXT_STATUS[s.status]
    if (next === 'closed') {
      setCloseoutSnag(s)
      setCloseoutResolution(s.resolution || '')
      setCloseoutPhotoUrl(s.closeoutEvidence?.photoUrls?.[0] || '')
      return
    }
    setSnags(prev => prev.map(x => x.id === s.id ? { ...x, status: next, closedAt: null, closedBy: null, closeoutVerifiedAt: null } : x))
    try {
      const res = await fetch(`/api/snags/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed')
      setSnags(prev => prev.map(x => x.id === s.id ? json : x))
      if (s.status === 'closed') setToast({ msg: 'Snag reopened; closeout evidence retained' })
    } catch (e) {
      setSnags(prev => prev.map(x => x.id === s.id ? s : x))
      setToast({ msg: e instanceof Error ? e.message : 'Failed to update status', type: 'error' })
    }
  }

  const closeSnag = async () => {
    if (!closeoutSnag || !closeoutResolution.trim() || !closeoutPhotoUrl) return
    setCloseoutSaving(true)
    try {
      const res = await fetch(`/api/snags/${closeoutSnag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          resolution: closeoutResolution.trim(),
          closeoutEvidence: { photoUrls: [closeoutPhotoUrl] },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to close snag')
      setSnags(prev => prev.map(x => x.id === closeoutSnag.id ? json : x))
      setCloseoutSnag(null)
      setCloseoutResolution('')
      setCloseoutPhotoUrl('')
      setToast({ msg: 'Snag closed with evidence' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Closeout failed', type: 'error' })
    } finally {
      setCloseoutSaving(false)
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
      const res = await fetch(`/api/snags/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setSnags(prev => prev.filter(s => s.id !== id))
      setToast({ msg: 'Snag deleted' })
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const filtered = filter === 'all' ? snags : snags.filter(s => s.status === filter)
  const openCount = snags.filter(s => s.status !== 'closed').length

  return (
    <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div className="module-header" data-kicker="Snags command" style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="var(--t3)" />
          <span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.4, fontFamily: SF }}>Snags</h1>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, fontFamily: SF }}>
              {snags.length} total{openCount > 0 ? ` · ${openCount} open` : ''}
            </p>
          </div>
          <button type="button" onClick={() => setShowModal(true)} aria-label="Add snag" disabled={projects.length === 0} style={{ width: 36, height: 36, borderRadius: 10, background: projects.length === 0 ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: projects.length === 0 ? 'not-allowed' : 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {(['all', 'open', 'in_progress', 'closed'] as const).map(t => (
            <button type="button" key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#090b0d' : 'var(--t3)', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontFamily: SF }}>
          <IcAlert size={32} color="var(--t3)" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{snags.length === 0 ? 'No snags raised yet' : 'Nothing in this filter'}</p>
          {snags.length === 0 && projects.length > 0 && (
            <button type="button" onClick={() => setShowModal(true)} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#090b0d', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Raise first snag
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => (
            <div key={s.id} style={{ background: 'var(--surface-raised)', borderRadius: 14, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, border: '0.5px solid rgba(255,255,255,0.07)', opacity: s.status === 'closed' ? 0.7 : 1 }}>
              <div style={{ display: 'flex', gap: 12 }}>
              {s.photoUrl ? (
                <a href={s.photoUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.photoUrl} alt="" width={56} height={56} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                </a>
              ) : (
                <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 10, background: `${STATUS_COLOR[s.status]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IcAlert size={26} color={STATUS_COLOR[s.status]} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontFamily: SF, fontSize: 9, fontWeight: 800, color: PRIORITY_COLOR[s.priority], textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.priority}</span>
                  {s.project && <span style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)' }}>· {s.project.name}</span>}
                </div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: 'var(--t1)', textDecoration: s.status === 'closed' ? 'line-through' : 'none' }}>{s.title}</div>
                {s.description && <div style={{ fontFamily: SF, fontSize: 12, color: 'var(--t2)', marginTop: 2, lineHeight: 1.35 }}>{s.description}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {s.location && <span style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)' }}>{s.location}</span>}
                  {s.dueDate && <span style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)' }}>Due {new Date(s.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <button type="button"
                  onClick={() => cycleStatus(s)}
                  aria-label={`Mark as ${STATUS_LABEL[NEXT_STATUS[s.status]]}`}
                  style={{ background: `${STATUS_COLOR[s.status]}22`, color: STATUS_COLOR[s.status], border: `1px solid ${STATUS_COLOR[s.status]}55`, borderRadius: 99, padding: '3px 9px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                >
                  {STATUS_LABEL[s.status]}
                </button>
                {s.photoUrl && (
                  <button type="button"
                    onClick={() => analyze(s.id)}
                    disabled={analyses[s.id]?.loading}
                    aria-label="Analyse photo with AI"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '0.5px solid rgba(139,92,246,0.4)', borderRadius: 99, padding: '3px 9px', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: analyses[s.id]?.loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <IcSpark size={10} color="#a78bfa" />
                    {analyses[s.id]?.loading ? 'Analysing…' : analyses[s.id]?.defects?.length ? 'Re-analyse' : 'Analyse'}
                  </button>
                )}
                <button type="button"
                  onClick={() => remove(s.id)}
                  aria-label={confirmDelete === s.id ? 'Confirm delete' : 'Delete snag'}
                  style={{ background: confirmDelete === s.id ? 'rgba(239,68,68,0.2)' : 'none', border: 'none', borderRadius: 4, padding: confirmDelete === s.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <IcTrash size={13} color="#ef4444" />
                  {confirmDelete === s.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: SF }}>Sure?</span>}
                </button>
              </div>
              </div>
              {s.status === 'closed' && (s.resolution || s.closeoutEvidence?.photoUrls?.length) && (
                <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.07)', borderRadius: 10, borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Verified closeout</div>
                  {s.resolution && <div style={{ fontFamily: SF, fontSize: 12, color: 'var(--t1)', lineHeight: 1.4 }}>{s.resolution}</div>}
                  {s.closedBy && <div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>Closed by {s.closedBy}{s.closeoutVerifiedAt ? ` · ${new Date(s.closeoutVerifiedAt).toLocaleDateString('en-GB')}` : ''}</div>}
                  {s.closeoutEvidence?.photoUrls?.[0] && (
                    <a href={s.closeoutEvidence.photoUrls[0]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.closeoutEvidence.photoUrls[0]} alt="Snag closeout evidence" width={96} height={72} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                    </a>
                  )}
                </div>
              )}
              {analyses[s.id] && !analyses[s.id].loading && (analyses[s.id].defects.length > 0 || analyses[s.id].error || analyses[s.id].summary) && (
                <div style={{ padding: '10px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: 10, borderLeft: '3px solid #a78bfa' }}>
                  {analyses[s.id].error ? (
                    <div style={{ fontFamily: SF, fontSize: 12, color: '#ef4444' }}>{analyses[s.id].error}</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <IcSpark size={12} color="#a78bfa" />
                        <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI analysis</span>
                      </div>
                      {analyses[s.id].summary && <div style={{ fontFamily: SF, fontSize: 12, color: 'var(--t1)', marginBottom: 8, lineHeight: 1.4 }}>{analyses[s.id].summary}</div>}
                      {analyses[s.id].defects.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {analyses[s.id].defects.map((d, i) => (
                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                              <span style={{ fontFamily: SF, fontSize: 9, fontWeight: 700, color: SEVERITY_COLOR[d.severity], textTransform: 'uppercase', letterSpacing: 0.4, padding: '1px 5px', borderRadius: 3, background: `${SEVERITY_COLOR[d.severity]}22`, flexShrink: 0, marginTop: 1 }}>{d.severity}</span>
                              <span style={{ fontFamily: SF, fontSize: 12, color: 'var(--t1)', lineHeight: 1.35 }}>
                                {d.description}{d.location && <span style={{ color: 'var(--t2)' }}> · {d.location}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {analyses[s.id].notes && <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t2)', marginTop: 6, fontStyle: 'italic' }}>Note: {analyses[s.id].notes}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <TabBar />

      {closeoutSnag && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setCloseoutSnag(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} />
          <div className="module-sheet" style={{ position: 'relative', background: 'var(--surface-raised)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', fontFamily: SF }}>Close snag</h2>
                <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3, fontFamily: SF }}>{closeoutSnag.title}</p>
              </div>
              <button onClick={() => setCloseoutSnag(null)} aria-label="Cancel closeout" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="var(--t3)" /></button>
            </div>
            <div>
              <label style={labelStyle}>Rectification / resolution *</label>
              <textarea value={closeoutResolution} onChange={e => setCloseoutResolution(e.target.value)} rows={4} placeholder="What was corrected, replaced or verified?" style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
            </div>
            <div>
              <label style={labelStyle}>Closeout evidence photo *</label>
              <input ref={closeoutInputRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadCloseoutPhoto(f); e.target.value = '' }} style={{ display: 'none' }} />
              {closeoutPhotoUrl ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={closeoutPhotoUrl} alt="Closeout evidence preview" width={96} height={72} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 10 }} />
                  <button onClick={() => closeoutInputRef.current?.click()} disabled={closeoutUploading} style={{ ...secondaryButtonStyle }}>Replace photo</button>
                </div>
              ) : (
                <button onClick={() => closeoutInputRef.current?.click()} disabled={closeoutUploading} style={{ ...secondaryButtonStyle, display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
                  <IcCamera size={16} color="var(--t2)" /> {closeoutUploading ? 'Uploading…' : 'Take / choose closeout photo'}
                </button>
              )}
            </div>
            <button onClick={closeSnag} disabled={closeoutSaving || closeoutUploading || !closeoutResolution.trim() || !closeoutPhotoUrl} style={{ padding: '13px 16px', borderRadius: 11, border: 'none', background: !closeoutResolution.trim() || !closeoutPhotoUrl ? 'rgba(16,185,129,0.3)' : '#10b981', color: '#fff', fontFamily: SF, fontWeight: 800, cursor: closeoutSaving ? 'wait' : 'pointer' }}>
              {closeoutSaving ? 'Closing…' : 'Verify & close snag'}
            </button>
            <p style={{ fontFamily: SF, fontSize: 10, color: 'var(--t3)', lineHeight: 1.45 }}>Closeout stores the resolution, evidence, closer and verification time for audit. Reopening does not delete that history.</p>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button type="button" aria-label="Close dialog" onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div className="module-sheet" style={{ position: 'relative', background: 'var(--surface-raised)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.3, fontFamily: SF }}>Raise snag</h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="var(--t3)" /></button>
            </div>

            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What's the issue?" style={inputStyle} />
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details (optional)" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Location (e.g. Plot 4, kitchen)" style={inputStyle} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label htmlFor="field-359" style={labelStyle}>Project</label>
                <select id="field-359" value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="field-365" style={labelStyle}>Priority</label>
                <select id="field-365" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Snag['priority'] }))} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="field-376" style={labelStyle}>Due date (optional)</label>
              <input id="field-376" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <div>
              <label htmlFor="field-381" style={labelStyle}>Photo (optional)</label>
              <input id="field-381" ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
              {form.photoUrl ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.photoUrl} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
                  <button type="button" onClick={() => setForm(p => ({ ...p, photoUrl: '' }))} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#ef4444', borderRadius: 8, padding: '6px 10px', fontFamily: SF, fontSize: 12, cursor: 'pointer' }}>Remove</button>
                </div>
              ) : (
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoUploading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--t2)', fontFamily: SF, fontSize: 13, cursor: photoUploading ? 'wait' : 'pointer', width: '100%', justifyContent: 'center' }}>
                  <IcCamera size={16} color="var(--t2)" />
                  {photoUploading ? 'Uploading…' : 'Attach photo'}
                </button>
              )}
            </div>

            <button type="button" onClick={create} disabled={saving || !form.title.trim() || !form.projectId} style={{ marginTop: 4, padding: '14px 0', borderRadius: 14, background: '#ef4444', border: 'none', color: '#090b0d', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.title.trim() || !form.projectId ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Saving…' : <><IcCheck size={16} color="#fff" /> Raise snag</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const secondaryButtonStyle: React.CSSProperties = { padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--t2)', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: 'var(--t1)', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcCamera, IcChevL, IcPlus, IcSpark } from '@/components/ui/Icons'

interface PhotoTags { tags: string[]; category: string; summary: string; loading?: boolean; error?: string }

interface PhotoDoc {
  id: string
  name: string
  url: string | null
  mimeType: string | null
  createdAt: string
  projectId: string | null
  project?: { id: string; name: string } | null
}

interface Project { id: string; name: string }

const SF = 'var(--font-system)'

export default function PhotosPage() {
  const [photos, setPhotos] = useState<PhotoDoc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoTags, setPhotoTags] = useState<Record<string, PhotoTags>>({})
  const [activePhoto, setActivePhoto] = useState<PhotoDoc | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelected, setCompareSelected] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  type CompareResult = { summary: string; changes: string[]; progress: 'progressed' | 'reversed' | 'stalled' | 'unrelated'; notes?: string; earlier: { id: string; name: string; url: string | null; createdAt: string }; later: { id: string; name: string; url: string | null; createdAt: string } }
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleCompareSelection = (id: string) => {
    setCompareSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id] // keep last + new
      return [...prev, id]
    })
  }

  const runCompare = async () => {
    if (compareSelected.length !== 2) return
    setComparing(true)
    setCompareResult(null)
    try {
      const res = await fetch('/api/photos/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aId: compareSelected[0], bId: compareSelected[1] }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.code === 'VISION_UNAVAILABLE'
          ? `Vision model not installed. Run: ollama pull ${json.config?.model || 'moondream'}`
          : json.error || 'Failed to compare'
        setToast({ msg, type: 'error' })
        return
      }
      setCompareResult(json)
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setComparing(false)
    }
  }

  const exitCompareMode = () => { setCompareMode(false); setCompareSelected([]); setCompareResult(null) }

  const tagPhoto = async (photoId: string) => {
    setPhotoTags(prev => ({ ...prev, [photoId]: { ...(prev[photoId] || { tags: [], category: '', summary: '' }), loading: true, error: undefined } }))
    try {
      const res = await fetch(`/api/documents/${photoId}/tag`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.code === 'VISION_UNAVAILABLE'
          ? `Vision model not installed. Run: ollama pull ${json.config?.model || 'moondream'}`
          : json.error || 'Failed to tag'
        setPhotoTags(prev => ({ ...prev, [photoId]: { tags: [], category: '', summary: '', loading: false, error: msg } }))
        return
      }
      setPhotoTags(prev => ({ ...prev, [photoId]: { tags: json.tags || [], category: json.category || 'other', summary: json.summary || '', loading: false } }))
      setToast({ msg: `Tagged: ${(json.tags || []).join(', ').slice(0, 60)}` })
    } catch (e) {
      setPhotoTags(prev => ({ ...prev, [photoId]: { tags: [], category: '', summary: '', loading: false, error: e instanceof Error ? e.message : 'Failed' } }))
    }
  }

  const load = useCallback(() => {
    fetch('/api/documents?type=photo&take=100')
      .then(r => { if (!r.ok) throw new Error('Failed to load photos'); return r.json() })
      .then(d => {
        const docs: PhotoDoc[] = (d.documents || []).filter((doc: PhotoDoc) => doc.url)
        setPhotos(docs)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => setProjects((d.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const handleFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const up = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!up.ok) throw new Error((await up.json().catch(() => ({})) as { error?: string }).error || 'Upload failed')
      const uploaded = await up.json() as { url: string; size: number; mimeType: string }
      const projectId = filter !== 'all' ? filter : null
      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          type: 'photo',
          projectId,
          url: uploaded.url,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
        }),
      })
      if (!docRes.ok) throw new Error('Saved upload but failed to file the document')
      const newDoc = await docRes.json() as PhotoDoc
      setPhotos(prev => [newDoc, ...prev])
      setToast({ msg: 'Photo added' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Upload failed', type: 'error' })
    } finally {
      setUploading(false)
    }
  }, [filter])

  const filtered = filter === 'all' ? photos : photos.filter(p => p.projectId === filter)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Photos</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {photos.length} total{filter !== 'all' ? ` · ${filtered.length} in filter` : ''}{compareMode ? ` · ${compareSelected.length}/2 selected` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {compareMode ? (
              <>
                <button onClick={exitCompareMode} aria-label="Exit compare mode" style={{ height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#8ea8c5', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '0 12px' }}>
                  Cancel
                </button>
                <button onClick={runCompare} disabled={compareSelected.length !== 2 || comparing} style={{ height: 36, borderRadius: 10, background: compareSelected.length === 2 ? '#8b5cf6' : 'rgba(139,92,246,0.3)', border: 'none', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: compareSelected.length === 2 && !comparing ? 'pointer' : 'not-allowed', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IcSpark size={12} color="#fff" />
                  {comparing ? 'Comparing…' : 'Compare'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setCompareMode(true); setCompareSelected([]); setCompareResult(null) }} aria-label="Compare photos" disabled={photos.length < 2} style={{ height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '0.5px solid rgba(139,92,246,0.4)', color: '#a78bfa', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: photos.length < 2 ? 'not-allowed' : 'pointer', opacity: photos.length < 2 ? 0.5 : 1, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IcSpark size={12} color="#a78bfa" />
                  Compare
                </button>
                <button onClick={() => inputRef.current?.click()} disabled={uploading} aria-label="Upload photo" style={{ width: 36, height: 36, borderRadius: 10, background: '#8b5cf6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                  <IcPlus size={18} color="#fff" />
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button onClick={() => setFilter('all')} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === 'all' ? '#8b5cf6' : 'rgba(255,255,255,0.06)', color: filter === 'all' ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === 'all' ? 700 : 400, cursor: 'pointer' }}>
            All
          </button>
          {projects.map(p => (
            <button key={p.id} onClick={() => setFilter(p.id)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === p.id ? '#8b5cf6' : 'rgba(255,255,255,0.06)', color: filter === p.id ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === p.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcCamera size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{photos.length === 0 ? 'No photos yet' : 'Nothing in this filter'}</p>
          {photos.length === 0 && (
            <button onClick={() => inputRef.current?.click()} disabled={uploading} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#8b5cf6', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Upload your first photo
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {filtered.map(p => {
            const tags = photoTags[p.id]
            const selectIndex = compareSelected.indexOf(p.id) // -1 if not selected
            const isSelected = selectIndex !== -1
            return (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#0c1a2e', outline: compareMode && isSelected ? `3px solid #8b5cf6` : 'none', outlineOffset: -3 }}>
                <button
                  onClick={() => compareMode ? toggleCompareSelection(p.id) : setActivePhoto(p)}
                  aria-label={compareMode ? (isSelected ? `Deselect ${p.name}` : `Select ${p.name} to compare`) : `Open photo ${p.name}`}
                  style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url!} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                </button>
                {compareMode && isSelected && (
                  <span style={{ position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: 12, background: '#8b5cf6', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {selectIndex + 1}
                  </span>
                )}
                {!compareMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); tagPhoto(p.id) }}
                    disabled={tags?.loading}
                    aria-label="Tag with AI"
                    style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 6, background: tags?.tags?.length ? 'rgba(139,92,246,0.85)' : 'rgba(0,0,0,0.55)', border: tags?.tags?.length ? 'none' : '0.5px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: tags?.loading ? 'wait' : 'pointer', padding: 0 }}
                  >
                    {tags?.loading ? (
                      <span style={{ fontFamily: SF, fontSize: 9, color: '#fff', fontWeight: 700 }}>…</span>
                    ) : (
                      <IcSpark size={12} color="#fff" />
                    )}
                  </button>
                )}
                {p.project && (
                  <span style={{ position: 'absolute', bottom: 4, left: 4, right: 4, fontFamily: SF, fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                    {p.project.name}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Compare results modal */}
      {compareResult && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,16,30,0.95)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <button onClick={() => setCompareResult(null)} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, background: 'rgba(0,0,0,0.5)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: SF, fontSize: 18, cursor: 'pointer', zIndex: 1 }}>×</button>
          <div style={{ padding: '20px 16px 16px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Photo comparison</div>
            <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', marginBottom: 14 }}>
              <span style={{ padding: '3px 8px', borderRadius: 99, background: compareResult.progress === 'progressed' ? 'rgba(16,185,129,0.2)' : compareResult.progress === 'reversed' ? 'rgba(239,68,68,0.2)' : compareResult.progress === 'stalled' ? 'rgba(245,158,11,0.2)' : 'rgba(82,116,154,0.2)', color: compareResult.progress === 'progressed' ? '#10b981' : compareResult.progress === 'reversed' ? '#ef4444' : compareResult.progress === 'stalled' ? '#f59e0b' : '#8ea8c5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 6 }}>{compareResult.progress}</span>
              {compareResult.summary}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[compareResult.earlier, compareResult.later].map((photo, idx) => (
                <div key={photo.id}>
                  <div style={{ aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#0c1a2e' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url || ''} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {idx === 0 ? 'Earlier' : 'Later'} · {new Date(photo.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>

            {compareResult.changes.length > 0 && (
              <div>
                <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>What changed</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {compareResult.changes.map((c, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'rgba(139,92,246,0.06)', borderRadius: 8, borderLeft: '2px solid #a78bfa' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#a78bfa', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontFamily: SF, fontSize: 12, color: '#eef3fa', lineHeight: 1.45 }}>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {compareResult.notes && (
              <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', fontStyle: 'italic', marginTop: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>Note: {compareResult.notes}</div>
            )}
          </div>
        </div>
      )}

      {/* Photo lightbox + tags */}
      {activePhoto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,16,30,0.95)', display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => setActivePhoto(null)} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, background: 'rgba(0,0,0,0.5)', border: '0.5px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: SF, fontSize: 18, cursor: 'pointer', zIndex: 1 }}>×</button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activePhoto.url!} alt={activePhoto.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
          </div>
          <div style={{ background: '#152641', padding: '16px 20px 24px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#eef3fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activePhoto.name}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {activePhoto.project?.name || 'No project'} · {new Date(activePhoto.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <button
                onClick={() => tagPhoto(activePhoto.id)}
                disabled={photoTags[activePhoto.id]?.loading}
                style={{ background: 'rgba(139,92,246,0.20)', color: '#a78bfa', border: '0.5px solid rgba(139,92,246,0.5)', borderRadius: 10, padding: '6px 12px', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: photoTags[activePhoto.id]?.loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <IcSpark size={12} color="#a78bfa" />
                {photoTags[activePhoto.id]?.loading ? 'Tagging…' : photoTags[activePhoto.id]?.tags?.length ? 'Re-tag' : 'Tag with AI'}
              </button>
            </div>
            {photoTags[activePhoto.id] && !photoTags[activePhoto.id].loading && (
              <div>
                {photoTags[activePhoto.id].error ? (
                  <div style={{ fontFamily: SF, fontSize: 12, color: '#ef4444' }}>{photoTags[activePhoto.id].error}</div>
                ) : photoTags[activePhoto.id].tags.length > 0 || photoTags[activePhoto.id].summary ? (
                  <>
                    <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginBottom: 6 }}>
                      <span style={{ color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{photoTags[activePhoto.id].category.replace('_', ' ')}</span>
                      {photoTags[activePhoto.id].summary && <> · {photoTags[activePhoto.id].summary}</>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {photoTags[activePhoto.id].tags.map(t => (
                        <span key={t} style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(139,92,246,0.13)', color: '#c4b5fd', fontFamily: SF, fontSize: 11, fontWeight: 600 }}>{t.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            )}
            <a href={activePhoto.url!} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontFamily: SF, fontSize: 11, color: '#52749a', textDecoration: 'underline' }}>Open original ↗</a>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}

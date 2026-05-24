'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcCamera, IcChevL, IcPlus } from '@/components/ui/Icons'

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
  const inputRef = useRef<HTMLInputElement>(null)

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
              {photos.length} total{filter !== 'all' ? ` · ${filtered.length} in filter` : ''}
            </p>
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading} aria-label="Upload photo" style={{ width: 36, height: 36, borderRadius: 10, background: '#8b5cf6', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            <IcPlus size={18} color="#fff" />
          </button>
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
          {filtered.map(p => (
            <a key={p.id} href={p.url || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#0c1a2e', textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url!} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
              {p.project && (
                <span style={{ position: 'absolute', bottom: 4, left: 4, right: 4, fontFamily: SF, fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.project.name}
                </span>
              )}
            </a>
          ))}
        </div>
      )}

      <TabBar />
    </div>
  )
}

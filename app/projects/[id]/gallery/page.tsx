'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcCamera, IcReceipt, IcDoc } from '@/components/ui/Icons'

interface Doc {
  id: string
  name: string
  type: string
  createdAt: string
  expiresAt: string | null
  url?: string | null
  size?: number | null
  mimeType?: string | null
}

const PAGE_SIZE = 36
const SF = 'var(--font-system)'

const TYPE_ICONS: Record<string, { Icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  photo: { Icon: IcCamera, color: '#2563eb' },
  receipt: { Icon: IcReceipt, color: '#10b981' },
  rams: { Icon: IcDoc, color: '#f59e0b' },
  report: { Icon: IcDoc, color: '#8b5cf6' },
  quote: { Icon: IcDoc, color: '#06b6d4' },
  permit: { Icon: IcDoc, color: '#ef4444' },
}

function isImage(doc: Doc) {
  if (!doc.url) return false
  if (doc.mimeType) return doc.mimeType.startsWith('image/')
  return doc.type === 'photo' || doc.type === 'receipt'
}

function formatBytes(value?: number | null) {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function downloadHref(url: string) {
  return url.startsWith('/api/uploads/') ? `${url}?download=1` : url
}

export default function ProjectGalleryPage() {
  const { id } = useParams<{ id: string }>()
  const [docs, setDocs] = useState<Doc[]>([])
  const [projectName, setProjectName] = useState('Project')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [active, setActive] = useState<Doc | null>(null)

  const loadInitial = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [docsRes, projectRes] = await Promise.all([
        fetch(`/api/documents?projectId=${encodeURIComponent(id)}&take=${PAGE_SIZE}&skip=0`),
        fetch(`/api/projects/${encodeURIComponent(id)}`),
      ])
      if (!docsRes.ok) throw new Error('Failed to load gallery')
      const data = await docsRes.json() as { documents?: Doc[]; total?: number; hasMore?: boolean }
      setDocs(data.documents || [])
      setTotal(data.total || 0)
      setHasMore(Boolean(data.hasMore))
      if (projectRes.ok) {
        const project = await projectRes.json() as { project?: { name?: string } }
        setProjectName(project.project?.name || 'Project')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadInitial() }, [loadInitial])

  const loadMore = useCallback(async () => {
    if (!id || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/documents?projectId=${encodeURIComponent(id)}&take=${PAGE_SIZE}&skip=${docs.length}`)
      if (!res.ok) throw new Error('Failed to load more')
      const data = await res.json() as { documents?: Doc[]; total?: number; hasMore?: boolean }
      setDocs(prev => [...prev, ...(data.documents || [])])
      setTotal(data.total ?? total)
      setHasMore(Boolean(data.hasMore))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }, [docs.length, hasMore, id, loadingMore, total])

  const types = useMemo(() => Array.from(new Set(docs.map(d => d.type))).sort(), [docs])
  const filtered = useMemo(
    () => docs.filter(d => filter === 'all' || d.type === filter),
    [docs, filter],
  )
  const photoCount = docs.filter(d => d.type === 'photo').length

  const openDoc = useCallback((doc: Doc) => {
    if (!doc.url) return
    if (isImage(doc)) setActive(doc)
    else window.open(doc.url, '_blank', 'noopener,noreferrer')
  }, [])

  return (
    <div className="module-page" style={{ background: 'var(--bg0)', minHeight: '100dvh', paddingBottom: 100 }}>
      <div className="module-header" data-kicker="Gallery command" style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href={`/projects/${id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="var(--t3)" />
          <span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>{projectName}</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: -0.4, fontFamily: SF }}>Gallery</h1>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2, fontFamily: SF }}>
              {total} document{total === 1 ? '' : 's'} · {photoCount}{hasMore ? '+' : ''} photo{photoCount === 1 ? '' : 's'} loaded
            </p>
          </div>
          <Link href={`/capture?type=photo&projectId=${encodeURIComponent(id)}`} style={{ padding: '8px 12px', borderRadius: 10, background: '#2563eb', color: '#fff', textDecoration: 'none', fontFamily: SF, fontSize: 12, fontWeight: 700 }}>
            Add photo
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginTop: 10 }}>
          {['all', ...types].map(t => (
            <button key={t} type="button" onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : 'var(--t3)', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: SF, fontSize: 14 }}>Loading gallery…</div>
        ) : error && docs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>
            <p>{error}</p>
            <button type="button" onClick={loadInitial} style={{ marginTop: 12, border: 'none', borderRadius: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.08)', color: 'var(--t1)', fontFamily: SF, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--t3)', fontFamily: SF }}>
            <IcCamera size={32} color="var(--t3)" />
            <p style={{ fontSize: 13, marginTop: 8 }}>No documents{filter !== 'all' ? ` of type "${filter}"` : ''} yet.</p>
            <Link href={`/capture?type=photo&projectId=${encodeURIComponent(id)}`} style={{ display: 'inline-block', marginTop: 16, padding: '10px 18px', borderRadius: 12, background: '#f59e0b', color: '#fff', textDecoration: 'none', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>Capture photo</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {filtered.map(d => {
              const meta = TYPE_ICONS[d.type] || { Icon: IcDoc, color: 'var(--t3)' }
              const Icon = meta.Icon
              const canOpen = Boolean(d.url)
              return (
                <article key={d.id} style={{ background: 'var(--surface-raised)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden', minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => openDoc(d)}
                    disabled={!canOpen}
                    aria-label={canOpen ? `Open ${d.name}` : `${d.name} has no file`}
                    style={{ width: '100%', height: 130, border: 'none', padding: 0, background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canOpen ? 'pointer' : 'default', overflow: 'hidden' }}
                  >
                    {isImage(d) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={d.url!} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <Icon size={42} color={meta.color} />
                    )}
                  </button>
                  <div style={{ padding: 10 }}>
                    <div title={d.name} style={{ fontFamily: SF, fontSize: 12, color: 'var(--t1)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t3)', marginTop: 3, minHeight: 15 }}>
                      <span style={{ textTransform: 'capitalize' }}>{d.type}</span>
                      {' · '}
                      {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {d.size ? ` · ${formatBytes(d.size)}` : ''}
                    </div>
                    {canOpen && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                        <button type="button" onClick={() => openDoc(d)} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '6px 8px', background: 'rgba(37,99,235,0.15)', color: '#60a5fa', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Open
                        </button>
                        <a href={downloadHref(d.url!)} download={d.name} onClick={e => e.stopPropagation()} style={{ flex: 1, borderRadius: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', fontFamily: SF, fontSize: 11, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                          Save
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {error && docs.length > 0 && (
          <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: SF, fontSize: 12 }}>
            {error}
          </div>
        )}
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 6px' }}>
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ minWidth: 150, border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 11, padding: '9px 14px', background: 'rgba(255,255,255,0.05)', color: 'var(--t1)', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: loadingMore ? 'wait' : 'pointer', opacity: loadingMore ? 0.65 : 1 }}
            >
              {loadingMore ? 'Loading…' : `Load more · ${docs.length}/${total}`}
            </button>
          </div>
        )}
      </div>

      {active?.url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.name}

          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(2,8,18,0.96)', display: 'flex', flexDirection: 'column' }}
        >
          <button type="button" onClick={() => setActive(null)} aria-label="Close preview" style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, width: 38, height: 38, borderRadius: 19, border: '0.5px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>×</button>
          <div role="presentation" onClick={e => e.stopPropagation()} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 16px 16px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.url} alt={active.name} decoding="async" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
          </div>
          <div role="presentation" onClick={e => e.stopPropagation()} style={{ padding: '14px 18px 24px', background: 'var(--surface-raised)', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.name}</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>
              <span style={{ textTransform: 'capitalize' }}>{active.type}</span>
              {' · '}
              {new Date(active.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {active.size ? ` · ${formatBytes(active.size)}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <a href={active.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background: 'rgba(37,99,235,0.16)', color: '#60a5fa', textDecoration: 'none', textAlign: 'center', fontFamily: SF, fontSize: 12, fontWeight: 700 }}>Open original</a>
              <a href={downloadHref(active.url)} download={active.name} style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.07)', color: 'var(--t1)', textDecoration: 'none', textAlign: 'center', fontFamily: SF, fontSize: 12, fontWeight: 700 }}>Download</a>
            </div>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}

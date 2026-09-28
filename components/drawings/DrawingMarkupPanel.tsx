'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IcCheck, IcTrash, IcX } from '@/components/ui/Icons'

export interface MarkupRevision {
  id: string
  revision: string
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
}

interface DrawingMarkup {
  id: string
  revisionId: string
  page: number
  kind: 'pin' | 'note' | 'box'
  x: number
  y: number
  width: number | null
  height: number | null
  text: string
  color: string
  status: 'open' | 'resolved'
  createdBy: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}
interface Props {
  drawingNumber: string
  drawingTitle: string
  revision: MarkupRevision
  onClose: () => void
  onChanged?: () => void
}

const SF = 'var(--font-system)'
const COLORS = ['#f59e0b', '#ef4444', '#2563eb', '#22c55e']
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  background: 'var(--bg3)',
  color: 'var(--t1)',
  padding: '10px 12px',
  fontFamily: SF,
  fontSize: 13,
  outline: 'none',
}

function fileKind(revision: MarkupRevision) {
  if (revision.mimeType?.startsWith('image/')) return 'image'
  if (revision.mimeType === 'application/pdf' || revision.fileName?.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'other'
}
export default function DrawingMarkupPanel({ drawingNumber, drawingTitle, revision, onClose, onChanged }: Props) {
  const [markups, setMarkups] = useState<DrawingMarkup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canAnnotate, setCanAnnotate] = useState(false)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [tool, setTool] = useState<'pin' | 'box'>('pin')
  const [color, setColor] = useState(COLORS[0])
  const [draft, setDraft] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const [draftText, setDraftText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const viewerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), status: statusFilter })
      const response = await fetch('/api/drawing-revisions/' + encodeURIComponent(revision.id) + '/markups?' + params)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to load markups')
      setMarkups(body.markups || [])
      setCanAnnotate(Boolean(body.permissions?.annotate))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load markups')
    } finally {
      setLoading(false)
    }
  }, [page, revision.id, statusFilter])

  useEffect(() => { load() }, [load])

  const selected = useMemo(
    () => markups.find(markup => markup.id === selectedId) || null,
    [markups, selectedId],
  )
  useEffect(() => { setEditText(selected?.text || '') }, [selected])

  const setDraftAt = (x: number, y: number) => {
    if (!canAnnotate || saving || !revision.fileUrl) return
    setDraft(tool === 'box'
      ? { x: Math.min(x, 0.82), y: Math.min(y, 0.88), width: 0.18, height: 0.12 }
      : { x, y })
    setDraftText('')
    setSelectedId(null)
  }

  const place = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!canAnnotate || saving || !revision.fileUrl) return
    if (event.detail === 0) {
      setDraftAt(0.5, 0.5)
      return
    }
    const rect = viewerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    setDraftAt(x, y)
  }
  const createMarkup = async () => {
    if (!draft || !draftText.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/drawing-revisions/' + encodeURIComponent(revision.id) + '/markups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          kind: tool,
          x: draft.x,
          y: draft.y,
          width: draft.width,
          height: draft.height,
          text: draftText.trim(),
          color,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to save markup')
      setDraft(null)
      setDraftText('')
      setSelectedId(body.id)
      onChanged?.()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save markup')
    } finally {
      setSaving(false)
    }
  }
  const updateMarkup = async (markup: DrawingMarkup, patch: Record<string, unknown>) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/drawing-markups/' + encodeURIComponent(markup.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to update markup')
      onChanged?.()
      await load()
      setSelectedId(body.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update markup')
    } finally {
      setSaving(false)
    }
  }

  const deleteMarkup = async (markup: DrawingMarkup) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/drawing-markups/' + encodeURIComponent(markup.id), { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Failed to delete markup')
      setSelectedId(null)
      onChanged?.()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete markup')
    } finally {
      setSaving(false)
    }
  }

  const kind = fileKind(revision)
  const fileUrl = revision.fileUrl || ''
  const pdfUrl = fileUrl + (fileUrl.includes('#') ? '&' : '#') + 'page=' + page + '&toolbar=0&navpanes=0'

  return (
    <div role="dialog" aria-modal="true" aria-label={'Markup revision ' + revision.revision} style={{ position: 'fixed', inset: 0, zIndex: 280, background: 'var(--bg0)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(6,16,30,0.97)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 700, color: 'var(--t3)' }}>{drawingNumber} · REV {revision.revision}</div>
          <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{drawingTitle}</div>
        </div>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SF, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>Original</a>
        <button type="button" onClick={onClose} aria-label="Close markup" style={{ border: 'none', background: 'transparent', padding: 5, cursor: 'pointer' }}><IcX size={20} color="var(--t2)" /></button>
      </header>
      <div style={{ padding: '8px 12px', display: 'flex', gap: 7, alignItems: 'center', overflowX: 'auto', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: SF, fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>
          Page
          <input type="number" min={1} max={9999} value={page} onChange={e => setPage(Math.max(1, Number.parseInt(e.target.value || '1', 10)))} style={{ ...inputStyle, width: 64, padding: '6px 8px' }} />
        </label>
        {canAnnotate && (['pin', 'box'] as const).map(value => (
          <button key={value} type="button" onClick={() => { setTool(value); setDraft(null) }} style={{ border: 'none', borderRadius: 8, padding: '7px 10px', background: tool === value ? '#2563eb' : 'rgba(255,255,255,0.06)', color: tool === value ? '#fff' : 'var(--t2)', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            {value === 'pin' ? 'Pin note' : 'Box note'}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {COLORS.map(value => (
            <button key={value} type="button" onClick={() => setColor(value)} aria-label={'Use ' + value} style={{ width: 25, height: 25, borderRadius: 13, border: color === value ? '2px solid #fff' : '2px solid transparent', background: value, cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexShrink: 0 }}>
          {(['open', 'resolved', 'all'] as const).map(value => (
            <button key={value} type="button" onClick={() => setStatusFilter(value)} style={{ border: 'none', borderRadius: 99, padding: '5px 9px', background: statusFilter === value ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', color: statusFilter === value ? '#f59e0b' : 'var(--t3)', fontFamily: SF, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{value}</button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <div role="alert" style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontFamily: SF, fontSize: 12 }}>{error}</div>}
        <div
          ref={viewerRef}
          style={{ position: 'relative', width: '100%', minHeight: 380, height: 'min(62dvh, 760px)', background: '#111827', borderRadius: 12, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.1)', cursor: canAnnotate ? 'crosshair' : 'default' }}
        >
          {!revision.fileUrl ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--t3)', fontFamily: SF, fontSize: 13 }}>This revision has no file.</div>
          ) : kind === 'image' ? (
            // Uploaded tenant files can be authenticated/signed URLs, so they must render directly.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={revision.fileName || 'Drawing revision'} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} />
          ) : kind === 'pdf' ? (
            <iframe title={'Drawing revision ' + revision.revision} src={pdfUrl} style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none', background: '#fff' }} />
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 30, textAlign: 'center', color: 'var(--t3)', fontFamily: SF, fontSize: 13 }}>
              Preview is unavailable for this file type. Open the original, then place notes using this normalized markup workspace.
            </div>
          )}

          <button
            type="button"
            data-testid="drawing-markup-surface"
            aria-label="Place annotation on drawing"
            onClick={place}
            disabled={!canAnnotate || saving || !revision.fileUrl}
            style={{ position: 'absolute', inset: 0, zIndex: 1, border: 'none', background: 'transparent', cursor: canAnnotate ? 'crosshair' : 'default', padding: 0 }}
          />

          {markups.map((markup, index) => (
            markup.kind === 'box' ? (
              <button key={markup.id} type="button" onClick={event => { event.stopPropagation(); setSelectedId(markup.id) }} title={markup.text} style={{ position: 'absolute', left: (markup.x * 100) + '%', top: (markup.y * 100) + '%', width: ((markup.width || 0.18) * 100) + '%', height: ((markup.height || 0.12) * 100) + '%', border: '2px solid ' + markup.color, background: markup.status === 'resolved' ? 'transparent' : markup.color + '22', opacity: markup.status === 'resolved' ? 0.45 : 1, borderRadius: 5, cursor: 'pointer', zIndex: 2 }} />
            ) : (
              <button key={markup.id} type="button" onClick={event => { event.stopPropagation(); setSelectedId(markup.id) }} title={markup.text} style={{ position: 'absolute', left: (markup.x * 100) + '%', top: (markup.y * 100) + '%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: 14, border: '2px solid rgba(255,255,255,0.9)', background: markup.color, color: '#fff', fontFamily: SF, fontWeight: 800, fontSize: 11, opacity: markup.status === 'resolved' ? 0.5 : 1, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.45)', zIndex: 2 }}>{index + 1}</button>
            )
          ))}

          {draft && (
            tool === 'box'
              ? <div style={{ pointerEvents: 'none', position: 'absolute', left: (draft.x * 100) + '%', top: (draft.y * 100) + '%', width: ((draft.width || 0.18) * 100) + '%', height: ((draft.height || 0.12) * 100) + '%', border: '2px dashed ' + color, background: color + '22', borderRadius: 5 }} />
              : <div style={{ pointerEvents: 'none', position: 'absolute', left: (draft.x * 100) + '%', top: (draft.y * 100) + '%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: 15, border: '2px dashed #fff', background: color }} />
          )}
        </div>
        {draft && (
          <div style={{ background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)', fontWeight: 700 }}>New {tool} annotation · page {page}</div>
            <textarea value={draftText} onChange={e => setDraftText(e.target.value)} rows={3} maxLength={1000} placeholder="Describe the issue, instruction, dimension, or coordination note…" style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 7 }}>
              <button type="button" onClick={() => { setDraft(null); setDraftText('') }} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={createMarkup} disabled={saving || !draftText.trim()} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '8px 10px', background: '#2563eb', color: '#fff', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: !draftText.trim() ? 0.5 : 1 }}>Save annotation</button>
            </div>
          </div>
        )}

        <section aria-label="Drawing annotations" style={{ background: 'var(--surface-raised)', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '9px 11px', display: 'flex', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>Annotations · page {page}</span>
            <span style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)' }}>{loading ? 'Loading…' : markups.length}</span>
          </div>
          {!loading && markups.length === 0 && (
            <div style={{ padding: 18, textAlign: 'center', fontFamily: SF, color: 'var(--t3)', fontSize: 12 }}>
              {canAnnotate ? 'Tap the drawing to add the first annotation.' : 'No annotations for this page.'}
            </div>
          )}
          {markups.map((markup, index) => (
            <button key={markup.id} type="button" onClick={() => setSelectedId(markup.id)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 11px', border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.04)', background: selectedId === markup.id ? 'rgba(37,99,235,0.09)' : 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ flexShrink: 0, marginTop: 1, width: 22, height: 22, borderRadius: markup.kind === 'box' ? 5 : 11, display: 'grid', placeItems: 'center', background: markup.color, color: '#fff', fontFamily: SF, fontSize: 9, fontWeight: 800 }}>{index + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: SF, fontSize: 12, color: 'var(--t1)', lineHeight: 1.35 }}>{markup.text}</span>
                <span style={{ display: 'block', fontFamily: SF, fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                  {markup.createdBy || 'User'} · {new Date(markup.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 99, background: markup.status === 'resolved' ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)', color: markup.status === 'resolved' ? '#22c55e' : '#f59e0b', fontFamily: SF, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>{markup.status}</span>
            </button>
          ))}
        </section>
        {selected && (
          <section style={{ background: 'var(--surface-raised)', borderRadius: 10, border: '0.5px solid rgba(37,99,235,0.28)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)', fontWeight: 800, textTransform: 'uppercase' }}>Selected annotation</div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Clear annotation selection" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}><IcX size={15} color="var(--t3)" /></button>
            </div>
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} maxLength={1000} disabled={!canAnnotate} style={{ ...inputStyle, resize: 'vertical', opacity: canAnnotate ? 1 : 0.7 }} />
            {selected.resolvedAt && (
              <div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t3)' }}>
                Resolved {new Date(selected.resolvedAt).toLocaleString('en-GB')} by {selected.resolvedBy || 'User'}
              </div>
            )}
            {canAnnotate && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 7 }}>
                <button type="button" onClick={() => updateMarkup(selected, { text: editText })} disabled={saving || !editText.trim() || editText.trim() === selected.text} style={{ border: 'none', borderRadius: 8, padding: '8px 9px', background: '#2563eb', color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: !editText.trim() || editText.trim() === selected.text ? 0.5 : 1 }}>Save note</button>
                <button type="button" onClick={() => updateMarkup(selected, { status: selected.status === 'resolved' ? 'open' : 'resolved' })} disabled={saving} style={{ border: 'none', borderRadius: 8, padding: '8px 9px', background: selected.status === 'resolved' ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.16)', color: selected.status === 'resolved' ? '#f59e0b' : '#22c55e', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <IcCheck size={12} color="currentColor" /> {selected.status === 'resolved' ? 'Reopen' : 'Resolve'}
                </button>
                <button type="button" onClick={() => deleteMarkup(selected)} disabled={saving} aria-label="Delete annotation" style={{ width: 38, border: 'none', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'grid', placeItems: 'center', cursor: saving ? 'wait' : 'pointer' }}>
                  <IcTrash size={14} color="#ef4444" />
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

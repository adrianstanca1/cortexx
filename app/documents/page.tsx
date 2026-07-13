'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import Button from '@/components/ui/Button'
import SegmentedControl from '@/components/ui/SegmentedControl'
import {
  IcChevL,
  IcDoc,
  IcPlus,
  IcTrash,
  IcUpload,
  IcHardhat,
  IcCheck,
  IcAlert,
  IcEdit,
} from '@/components/ui/Icons'

interface Doc {
  id: string
  name: string
  type: string
  expiresAt: string | null
  createdAt: string
  projectId: string | null
  project?: { id: string; name: string } | null
  url?: string | null
  size?: number | null
  mimeType?: string | null
  originalName?: string | null
  tags?: unknown[] | null
  version?: number | null
}

interface Project { id: string; name: string }

const EXPIRY_WARN_DAYS = 7

const DOC_TYPES = [
  { value: 'rams', label: 'RAMS' },
  { value: 'method_statement', label: 'Method statement' },
  { value: 'risk_assessment', label: 'Risk assessment' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'report', label: 'Report' },
  { value: 'permit', label: 'Permit' },
  { value: 'photo', label: 'Photo' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'quote', label: 'Quote' },
  { value: 'other', label: 'Other' },
]

const QUICK_TEMPLATES = [
  { type: 'rams', label: 'RAMS', icon: IcHardhat, color: '#22c55e' },
  { type: 'method_statement', label: 'Method statement', icon: IcDoc, color: '#2563eb' },
  { type: 'risk_assessment', label: 'Risk assessment', icon: IcAlert, color: '#ef4444' },
  { type: 'checklist', label: 'Checklist', icon: IcCheck, color: '#f59e0b' },
]

function formatBytes(n?: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(v => v.trim())
  }
  return []
}

const SF = 'var(--font-system)'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [projects, setProjects] = useState<Project[]>([])
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'upload' | 'blank'>('upload')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'rams',
    projectId: '',
    expiresAt: '',
    url: '',
    size: null as number | null,
    mimeType: '',
    originalName: '',
    tags: [] as string[],
    newVersion: false,
    version: 1,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const versionInputRef = useRef<HTMLInputElement>(null)
  const [tagInput, setTagInput] = useState('')

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, pRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/projects'),
      ])
      if (!dRes.ok) throw new Error('Failed to load documents')
      const dData = await dRes.json()
      setDocs(dData.documents || [])
      if (pRes.ok) {
        const pData = await pRes.json()
        setProjects((pData.projects || []).map((p: Project) => ({ id: p.id, name: p.name })))
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
      setShowModal(true)
    }
  }, [])

  const resetForm = () => {
    setForm({ name: '', type: 'rams', projectId: '', expiresAt: '', url: '', size: null, mimeType: '', originalName: '', tags: [], newVersion: false, version: 1 })
    setModalTab('upload')
    setEditingId(null)
    setTagInput('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (versionInputRef.current) versionInputRef.current.value = ''
  }

  const applyUploadResult = (data: { url?: string; size?: number; mimeType?: string; originalName?: string | null }, options?: { newVersion?: boolean }) => {
    setForm(p => ({
      ...p,
      name: p.name || data.originalName || '',
      url: data.url || '',
      size: data.size ?? null,
      mimeType: data.mimeType || '',
      originalName: data.originalName || p.originalName || p.name,
      newVersion: options?.newVersion ?? false,
    }))
  }

  const handleFileSelect = async (file: File, options?: { newVersion?: boolean }) => {
    setUploading(true)
    setUploadProgress(0)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      applyUploadResult({
        url: data.url,
        size: data.size,
        mimeType: data.mimeType,
        originalName: data.originalName || file.name,
      }, { newVersion: options?.newVersion })
      setToast({ msg: options?.newVersion ? 'New version uploaded' : 'File uploaded', type: 'success' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Upload failed', type: 'error' })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const openAdd = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (d: Doc) => {
    setEditingId(d.id)
    setForm({
      name: d.name,
      type: d.type,
      projectId: d.projectId || '',
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().split('T')[0] : '',
      url: d.url || '',
      size: d.size ?? null,
      mimeType: d.mimeType || '',
      originalName: d.originalName || d.name,
      tags: normalizeTags(d.tags),
      newVersion: false,
      version: d.version || 1,
    })
    setModalTab(d.url ? 'upload' : 'blank')
    setShowModal(true)
  }

  const addTag = (raw: string) => {
    const values = raw.split(/[,;]+/).map(v => v.trim()).filter(Boolean)
    if (values.length === 0) return
    setForm(p => ({ ...p, tags: Array.from(new Set([...p.tags, ...values])) }))
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))
  }

  const save = async () => {
    if (!form.name.trim()) return setToast({ msg: 'Document name is required', type: 'error' })
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        projectId: form.projectId || null,
        expiresAt: form.expiresAt || null,
        url: form.url || null,
        size: form.size,
        mimeType: form.mimeType || null,
        tags: form.tags,
        ...(editingId && form.newVersion ? { newVersion: true } : {}),
      }
      if (editingId) {
        const res = await fetch(`/api/documents/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed')
        const updated = await res.json()
        setDocs(prev => prev.map(d => d.id === editingId ? updated : d))
        setToast({ msg: 'Document updated' })
      } else {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed')
        const newDoc = await res.json()
        setDocs(prev => [newDoc, ...prev])
        setToast({ msg: 'Document added' })
      }
      setShowModal(false)
      resetForm()
    } catch {
      setToast({ msg: `Failed to ${editingId ? 'update' : 'add'} document`, type: 'error' })
    } finally {
      setSaving(false)
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
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setDocs(prev => prev.filter(d => d.id !== id))
      setToast({ msg: 'Document deleted' })
    } catch {
      setToast({ msg: 'Failed to delete', type: 'error' })
    }
  }

  const types = Array.from(new Set(docs.map(d => d.type)))
  const filtered = docs.filter(d => filter === 'all' || d.type === filter)
  const [now] = useState(() => Date.now())
  const expiringCount = docs.filter(d => d.expiresAt && new Date(d.expiresAt).getTime() < now + EXPIRY_WARN_DAYS * 86400000).length

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Back</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Documents</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{docs.length} total</span>
              {expiringCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                  {expiringCount} expiring
                </span>
              )}
            </p>
          </div>
          <button onClick={openAdd} aria-label="Add document" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {['all', ...types].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No documents</div>
          ) : (
            filtered.map(d => {
              const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : null
              const expiring = exp !== null && exp < now + EXPIRY_WARN_DAYS * 86400000
              const expired = exp !== null && exp < now
              const isImage = d.mimeType?.startsWith('image/')
              const isPdf = d.mimeType === 'application/pdf'
              const tags = normalizeTags(d.tags)
              return (
                <div key={d.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {isImage && d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                      <img src={d.url} alt="" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                    </a>
                  ) : (
                    <IcDoc size={20} color={expired ? '#ef4444' : expiring ? '#f59e0b' : isPdf ? '#ef4444' : '#52749a'} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{d.name}</a>
                    ) : (
                      <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    )}
                    <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                      <span style={{ textTransform: 'capitalize' }}>{d.type}</span>
                      {d.project && <> · <Link href={`/projects/${d.project.id}`} style={{ color: '#8ea8c5', textDecoration: 'none' }}>{d.project.name}</Link></>}
                      {d.size && <span> · {formatBytes(d.size)}</span>}
                      {typeof d.version === 'number' && d.version > 1 && <span> · v{d.version}</span>}
                      {d.expiresAt && <span style={{ color: expired ? '#ef4444' : expiring ? '#f59e0b' : '#52749a' }}>
                        {' '}· {expired ? 'Expired' : 'Expires'} {new Date(d.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>}
                    </div>
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {tags.map(tag => (
                          <span key={tag} style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', color: '#8ea8c5', fontFamily: SF, fontSize: 10, fontWeight: 600 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isPdf && d.url && (
                    <button
                      onClick={() => setPreviewUrl(d.url!)}
                      aria-label="Preview PDF"
                      style={{ background: 'rgba(245,158,11,0.12)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#f59e0b', fontFamily: SF, fontSize: 11, fontWeight: 700 }}
                    >
                      Preview
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(d)}
                    aria-label="Edit document"
                    style={{ background: 'transparent', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <IcEdit size={14} color="#8ea8c5" />
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    aria-label={confirmDelete === d.id ? 'Confirm delete' : 'Delete document'}
                    style={{ background: confirmDelete === d.id ? 'rgba(239,68,68,0.2)' : 'none', border: 'none', borderRadius: 4, padding: confirmDelete === d.id ? '4px 8px' : 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <IcTrash size={13} color="#ef4444" />
                    {confirmDelete === d.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: SF }}>Sure?</span>}
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      <TabBar />

      <Modal
        open={showModal}
        title={editingId ? 'Edit document' : 'Add document'}
        onClose={() => { setShowModal(false); resetForm() }}
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18 }}>
            <div>{uploading && <span style={{ fontFamily: SF, fontSize: 12, color: '#f59e0b' }}>Uploading…</span>}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="ghost" onClick={() => { setShowModal(false); resetForm() }} disabled={saving || uploading}>Cancel</Button>
              <Button variant="primary" loading={saving} onClick={save} disabled={uploading}>{editingId ? 'Save changes' : 'Add document'}</Button>
            </div>
          </div>
        }
      >
        <SegmentedControl
          value={modalTab}
          onChange={v => setModalTab(v as 'upload' | 'blank')}
          options={[
            { value: 'upload', label: 'Upload file' },
            { value: 'blank', label: 'Blank entry' },
          ]}
          size="sm"
          ariaLabel="Document creation mode"
        />

        {modalTab === 'upload' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '18px 16px',
                borderRadius: 12,
                border: '1.5px dashed rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.03)',
                color: '#c1d2e8',
                fontFamily: SF,
                fontSize: 14,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <IcUpload size={24} color="#f59e0b" />
              <span>{uploading ? 'Uploading…' : 'Click to upload PDF, photo or receipt'}</span>
              <span style={{ fontSize: 12, color: '#52749a' }}>Max 25 MB · PDF, JPG, PNG, HEIC</span>
            </button>

            {form.url && (
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '0.5px solid rgba(16,185,129,0.3)' }}>
                <div style={{ fontFamily: SF, fontSize: 13, color: '#10b981' }}>
                  Uploaded: {form.originalName || form.name} ({formatBytes(form.size)})
                  {editingId && <> · v{form.version}{form.newVersion && <span style={{ color: '#f59e0b', marginLeft: 6 }}>(will become v{form.version + 1})</span>}</>}
                </div>
                {editingId && (
                  <>
                    <input
                      ref={versionInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleFileSelect(f, { newVersion: true })
                      }}
                    />
                    <button
                      onClick={() => versionInputRef.current?.click()}
                      disabled={uploading}
                      style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}
                    >
                      Upload new version
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <FormField
          id="doc-name"
          label="Document name"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Block A RAMS"
        />

        <FormField
          id="doc-type"
          as="select"
          label="Type"
          value={form.type}
          onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
          options={DOC_TYPES}
        />

        <FormField
          id="doc-project"
          as="select"
          label="Project"
          value={form.projectId}
          onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))}
          options={[{ value: '', label: 'No project' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
        />

        <FormField
          id="doc-expires"
          type="date"
          label="Expires (optional)"
          value={form.expiresAt}
          onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="doc-tags" style={{ fontFamily: SF, fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg3)' }}>
            {form.tags.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontFamily: SF, fontSize: 12, fontWeight: 600 }}>
                {tag}
                <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} style={{ background: 'none', border: 'none', padding: 0, color: '#f59e0b', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            ))}
            <input
              id="doc-tags"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag(tagInput)
                }
                if (e.key === 'Backspace' && tagInput === '' && form.tags.length > 0) {
                  setForm(p => ({ ...p, tags: p.tags.slice(0, -1) }))
                }
              }}
              onBlur={() => addTag(tagInput)}
              placeholder={form.tags.length === 0 ? 'Add tags, press Enter' : ''}
              style={{ flex: 1, minWidth: 80, background: 'transparent', border: 'none', color: 'var(--t1)', fontFamily: SF, fontSize: 14, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Quick start templates</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {QUICK_TEMPLATES.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.type}
                onClick={() => setForm(p => ({ ...p, type: t.type, name: p.name || `${t.label} - ${new Date().toLocaleDateString('en-GB')}` }))}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#c1d2e8',
                  fontFamily: SF,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon size={14} color={t.color} /> {t.label}
              </button>
            )
          })}
        </div>
      </Modal>

      <Modal
        open={!!previewUrl}
        title="PDF preview"
        onClose={() => setPreviewUrl(null)}
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="ghost" onClick={() => setPreviewUrl(null)}>Close</Button>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <Button variant="primary">Open in new tab</Button>
              </a>
            )}
          </div>
        }
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            title="PDF preview"
            style={{ width: '100%', height: 520, border: 'none', borderRadius: 12, background: '#fff' }}
          />
        )}
      </Modal>
    </div>
  )
}

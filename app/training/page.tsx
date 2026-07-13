'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import SegmentedControl from '@/components/ui/SegmentedControl'
import CertificationDialog from '@/components/training/CertificationDialog'
import { IcHardhat, IcChevL, IcPlus, IcTrash, IcEdit } from '@/components/ui/Icons'
import type { Certification, TrainingCourse } from '@/lib/types'

interface Member { id: string; name: string; role: string }
interface Counts { valid: number; expiring: number; expired: number; total: number }

const SF = 'var(--font-system)'
type StatusBucket = NonNullable<Certification['statusBucket']>
const STATUS_COLOR: Record<StatusBucket, string> = {
  valid: '#10b981',
  expiring: '#f59e0b',
  expired: '#ef4444',
  no_expiry: '#52749a',
}
const STATUS_LABEL: Record<StatusBucket, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
  no_expiry: 'No expiry',
}
const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'qualification', label: 'Qualifications' },
  { value: 'training', label: 'Training' },
  { value: 'course', label: 'Courses' },
  { value: 'licence', label: 'Licences' },
  { value: 'safety', label: 'Safety' },
]

export default function TrainingPage() {
  const [certs, setCerts] = useState<Certification[]>([])
  const [counts, setCounts] = useState<Counts>({ valid: 0, expiring: 0, expired: 0, total: 0 })
  const [team, setTeam] = useState<Member[]>([])
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | Certification['statusBucket']>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Certification | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/training').then(r => { if (!r.ok) throw new Error('Failed to load certifications'); return r.json() }),
      fetch('/api/team').then(r => r.ok ? r.json() : null),
      fetch('/api/training/courses').then(r => r.ok ? r.json() : null),
    ])
      .then(([trainingData, teamData, courseData]) => {
        setCerts(trainingData.certifications || [])
        setCounts(trainingData.counts || { valid: 0, expiring: 0, expired: 0, total: 0 })
        const ts: Member[] = (teamData?.team || []).map((m: Member) => ({ id: m.id, name: m.name, role: m.role }))
        setTeam(ts)
        setCourses(courseData?.courses || [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (data: Partial<Certification>) => {
    const url = data.id ? `/api/training/${data.id}` : '/api/training'
    const res = await fetch(url, {
      method: data.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Save failed')
    }
    setDialogOpen(false)
    setEditing(null)
    load()
    setToast({ msg: data.id ? 'Certification updated' : 'Certification added' })
  }

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(curr => curr === id ? null : curr), 3000)
      return
    }
    try {
      await deleteDirect(id)
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Delete failed', type: 'error' })
    }
  }

  const deleteDirect = async (id: string) => {
    setConfirmDelete(null)
    const res = await fetch(`/api/training/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || 'Delete failed')
    }
    load()
  }

  const filtered = certs.filter(c => {
    const statusOk = statusFilter === 'all' || c.statusBucket === statusFilter
    const categoryOk = categoryFilter === 'all' || c.category === categoryFilter
    return statusOk && categoryOk
  })

  const openCreate = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (c: Certification) => { setEditing(c); setDialogOpen(true) }

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Training & CSCS</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {counts.total} certifications · {counts.expired} expired
              {counts.expiring > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· {counts.expiring} expiring soon</span>}
            </p>
          </div>
          <button onClick={openCreate} aria-label="Add certification" style={{ width: 36, height: 36, borderRadius: 10, background: '#f59e0b', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IcPlus size={18} color="#fff" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {(['valid', 'expiring', 'expired'] as const).map(b => (
            <button key={b} onClick={() => setStatusFilter(statusFilter === b ? 'all' : b)} style={{ background: statusFilter === b ? `${STATUS_COLOR[b]}28` : 'rgba(255,255,255,0.04)', border: `0.5px solid ${statusFilter === b ? STATUS_COLOR[b] : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: STATUS_COLOR[b] }}>{counts[b]}</div>
              <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#52749a', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{STATUS_LABEL[b]}</div>
            </button>
          ))}
        </div>

        <SegmentedControl
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={CATEGORIES}
          size="sm"
          ariaLabel="Filter by category"
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcHardhat size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{certs.length === 0 ? 'No certifications recorded yet' : 'Nothing in this filter'}</p>
          {certs.length === 0 && (
            <button onClick={openCreate} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#f59e0b', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Add first certification
            </button>
          )}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{c.holderName}</div>
                  <span style={{ padding: '2px 7px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', color: '#8ea8c5', fontFamily: SF, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{c.category}</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
                  {c.type}{c.number ? ` · #${c.number}` : ''}
                  {c.course && <span style={{ color: '#52749a' }}> · {c.course.name}</span>}
                  {c.expiryDate && <span style={{ color: '#52749a' }}> · expires {new Date(c.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </div>
              </div>
              <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 99, background: `${STATUS_COLOR[c.statusBucket || 'no_expiry']}22`, color: STATUS_COLOR[c.statusBucket || 'no_expiry'], fontFamily: SF, fontSize: 10, fontWeight: 700, border: `1px solid ${STATUS_COLOR[c.statusBucket || 'no_expiry']}55`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {STATUS_LABEL[c.statusBucket || 'no_expiry']}
              </span>
              <button onClick={() => openEdit(c)} aria-label="Edit" style={{ flexShrink: 0, background: 'none', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer' }}>
                <IcEdit size={14} color="#8ea8c5" />
              </button>
              <button onClick={() => remove(c.id)} aria-label={confirmDelete === c.id ? 'Confirm delete' : 'Delete'} style={{ flexShrink: 0, background: confirmDelete === c.id ? 'rgba(239,68,68,0.2)' : 'none', border: 'none', borderRadius: 4, padding: confirmDelete === c.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={13} color="#ef4444" />
                {confirmDelete === c.id && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: SF }}>Sure?</span>}
              </button>
            </div>
          ))}
        </div>
      )}

      <TabBar />

      <CertificationDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={save}
        onDelete={editing ? async () => { await deleteDirect(editing.id); setDialogOpen(false); setEditing(null) } : undefined}
        initial={editing}
        team={team}
        courses={courses}
      />
    </div>
  )
}

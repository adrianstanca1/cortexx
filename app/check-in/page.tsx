'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcPin, IcChevL, IcCheck, IcX, IcTrash } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

interface Member { id: string; name: string; role: string; avatarColor: string }
interface Project { id: string; name: string; address: string }
interface CheckIn {
  id: string
  memberId: string
  projectId: string
  checkedInAt: string
  checkedOutAt: string | null
  latitudeIn: number | null
  longitudeIn: number | null
  latitudeOut: number | null
  longitudeOut: number | null
  notes: string | null
  member?: Member
  project?: Project
}

const SF = 'var(--font-system)'

function durationHrs(from: string, to: string | null) {
  const end = to ? new Date(to) : new Date()
  const ms = end.getTime() - new Date(from).getTime()
  return ms / 3_600_000
}

export default function CheckInPage() {
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [activeCount, setActiveCount] = useState(0)
  const [team, setTeam] = useState<Member[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | 'active'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [showIn, setShowIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({ memberId: '', projectId: '', notes: '' })
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'got' | 'denied'>('idle')
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null)

  useModalEffects(showIn, () => setShowIn(false))

  const load = useCallback(() => {
    fetch('/api/checkins')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setCheckins(d.checkins || []); setActiveCount(d.activeCount || 0); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
    fetch('/api/team').then(r => r.ok ? r.json() : null).then(d => {
      setTeam((d?.team || []).map((m: Member) => ({ id: m.id, name: m.name, role: m.role, avatarColor: m.avatarColor })))
      setForm(prev => prev.memberId ? prev : { ...prev, memberId: d?.team?.[0]?.id || '' })
    }).catch(() => {})
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string; address: string }) => ({ id: p.id, name: p.name, address: p.address }))
      setProjects(ps)
      setForm(prev => prev.projectId ? prev : { ...prev, projectId: ps[0]?.id || '' })
    }).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const requestGeo = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeoStatus('denied'); return }
    setGeoStatus('asking')
    navigator.geolocation.getCurrentPosition(
      pos => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoStatus('got') },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])
  useEffect(() => { if (showIn) requestGeo() }, [showIn, requestGeo])

  const checkIn = async () => {
    if (!form.memberId || !form.projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: form.memberId,
          projectId: form.projectId,
          notes: form.notes.trim() || null,
          latitude: geo?.lat ?? null,
          longitude: geo?.lng ?? null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Failed')
      setShowIn(false)
      setForm(prev => ({ ...prev, notes: '' }))
      setGeo(null); setGeoStatus('idle')
      load()
      setToast({ msg: 'Checked in' })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const checkOut = async (ci: CheckIn) => {
    try {
      const lat: number | null = await new Promise(r => {
        if (!('geolocation' in navigator)) return r(null)
        navigator.geolocation.getCurrentPosition(p => r(p.coords.latitude), () => r(null), { timeout: 6_000 })
      })
      const lng: number | null = lat !== null ? await new Promise(r => {
        navigator.geolocation.getCurrentPosition(p => r(p.coords.longitude), () => r(null), { timeout: 6_000 })
      }) : null
      const res = await fetch(`/api/checkins/${ci.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      })
      if (!res.ok) throw new Error('Failed')
      load()
      setToast({ msg: 'Checked out' })
    } catch {
      setToast({ msg: 'Check-out failed', type: 'error' })
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
      const res = await fetch(`/api/checkins/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      load()
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' })
    }
  }

  const filtered = filter === 'active' ? checkins.filter(c => !c.checkedOutAt) : checkins

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Check in / out</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
              {activeCount} active now · {checkins.length} total today
            </p>
          </div>
          <button onClick={() => setShowIn(true)} disabled={team.length === 0 || projects.length === 0} aria-label="Check in" style={{ padding: '8px 14px', borderRadius: 10, background: team.length && projects.length ? '#10b981' : 'rgba(16,185,129,0.3)', border: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, cursor: team.length && projects.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IcCheck size={14} color="#fff" /> Check in
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active'] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#10b981' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: SF, fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All check-ins' : `Active (${activeCount})`}
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
          <IcPin size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>{checkins.length === 0 ? 'No check-ins yet' : 'Nothing in this filter'}</p>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(ci => {
            const active = !ci.checkedOutAt
            const hrs = durationHrs(ci.checkedInAt, ci.checkedOutAt)
            return (
              <div key={ci.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: `0.5px solid ${active ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: (ci.member?.avatarColor || '#2563eb') + '22', color: ci.member?.avatarColor || '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>
                  {ci.member?.name.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{ci.member?.name || 'Unknown'}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>
                    {ci.project?.name || 'Unknown project'}
                  </div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2 }}>
                    {new Date(ci.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {ci.checkedOutAt ? ` → ${new Date(ci.checkedOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ' · still on site'}
                    {hrs > 0 && ` · ${hrs.toFixed(1)}h`}
                  </div>
                </div>
                {active ? (
                  <button onClick={() => checkOut(ci)} style={{ background: 'rgba(245,158,11,0.18)', border: '0.5px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 8, padding: '6px 12px', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Check out
                  </button>
                ) : (
                  <span style={{ fontFamily: SF, fontSize: 10, color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Done</span>
                )}
                <button onClick={() => remove(ci.id)} aria-label={confirmDelete === ci.id ? 'Confirm delete' : 'Delete'} style={{ background: confirmDelete === ci.id ? 'rgba(239,68,68,0.18)' : 'transparent', border: 'none', borderRadius: 4, padding: confirmDelete === ci.id ? '3px 7px' : 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IcTrash size={11} color="#ef4444" />
                  {confirmDelete === ci.id && <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Sure?</span>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <TabBar />

      {showIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowIn(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#152641', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: SF }}>Check in</h2>
              <button onClick={() => setShowIn(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><IcX size={20} color="#52749a" /></button>
            </div>

            <div>
              <label style={labelStyle}>Member</label>
              <select value={form.memberId} onChange={e => setForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {team.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Site</label>
              <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: 10, background: geoStatus === 'got' ? 'rgba(16,185,129,0.1)' : geoStatus === 'denied' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${geoStatus === 'got' ? 'rgba(16,185,129,0.35)' : geoStatus === 'denied' ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.1)'}`, fontFamily: SF, fontSize: 12, color: geoStatus === 'got' ? '#10b981' : geoStatus === 'denied' ? '#ef4444' : '#8ea8c5' }}>
              {geoStatus === 'asking' && '📍 Getting GPS location…'}
              {geoStatus === 'got' && geo && `📍 ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`}
              {geoStatus === 'denied' && '⚠️ GPS unavailable — check-in will proceed without location'}
              {geoStatus === 'idle' && '📍 Tap below to capture GPS'}
            </div>

            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional — induction confirmed, weather, etc.)" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: SF }} />

            <button onClick={checkIn} disabled={saving || !form.memberId || !form.projectId} style={{ padding: '14px 0', borderRadius: 14, background: '#10b981', border: 'none', color: '#fff', fontFamily: SF, fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.memberId || !form.projectId ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'Checking in…' : <><IcCheck size={16} color="#fff" /> Check in now</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#eef3fa', fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

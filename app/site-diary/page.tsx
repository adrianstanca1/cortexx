'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcDoc, IcChevL, IcChevR, IcCamera, IcAlert, IcCheck, IcClock, IcTeam, IcSend } from '@/components/ui/Icons'

interface Project { id: string; name: string }
interface TeamMember { id: string; name: string; role: string }
interface TimeEntry { id: string; memberId: string; hours: number; member?: TeamMember; project?: Project | null }
interface Activity { id: string; actorName: string; action: string; iconType: string; detail: string | null; createdAt: string }
interface Snag { id: string; title: string; status: string; priority: string; createdAt: string; closedAt: string | null }
interface PhotoDoc { id: string; name: string; url: string | null; createdAt: string }
interface OtherDoc { id: string; name: string; type: string; url: string | null; createdAt: string }
interface Summary {
  hoursTotal: number; peopleOnSite: number; snagsRaised: number; snagsClosed: number;
  photosTaken: number; documentsFiled: number; activityEvents: number;
}
interface DiaryData {
  project: Project & { address: string; postcode: string; onSiteCount: number }
  date: string
  summary: Summary
  timeEntries: TimeEntry[]
  activities: Activity[]
  snagsRaised: Snag[]
  snagsClosed: Snag[]
  photos: PhotoDoc[]
  documents: OtherDoc[]
}

const SF = 'var(--font-system)'

export default function SiteDiaryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<DiaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/projects').then(r => r.ok ? r.json() : null).then(d => {
      const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
      setProjects(ps)
      setProjectId(prev => prev || (ps[0]?.id || ''))
      if (!ps.length) setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [])

  const load = useCallback(() => {
    if (!projectId) return
    setLoading(true)
    fetch(`/api/site-diary?projectId=${projectId}&date=${date}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load diary'); return r.json() })
      .then(d => { setData(d); setError(null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [projectId, date])
  useEffect(() => { load() }, [load])

  const shiftDay = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }
  const jumpToToday = () => setDate(new Date().toISOString().slice(0, 10))
  const isToday = date === new Date().toISOString().slice(0, 10)
  const niceDate = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const shareReport = () => {
    if (!data) return
    const sum = data.summary
    const text = [
      `Site Diary — ${data.project.name}`,
      `${niceDate}`,
      ``,
      `${sum.hoursTotal.toFixed(1)} hours · ${sum.peopleOnSite} people on site`,
      `${sum.snagsRaised} snag${sum.snagsRaised === 1 ? '' : 's'} raised · ${sum.snagsClosed} closed`,
      `${sum.photosTaken} photos · ${sum.documentsFiled} documents filed`,
      ``,
      data.activities.length ? `Activity log:` : `No activity logged.`,
      ...data.activities.map(a => `  • ${a.actorName} ${a.action}`),
    ].join('\n')
    const subject = `Site Diary — ${data.project.name} — ${niceDate}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_self')
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Site diary</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{niceDate}</p>
          </div>
          {data && (
            <button onClick={shareReport} aria-label="Share report" style={{ width: 36, height: 36, borderRadius: 10, background: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IcSend size={16} color="#fff" />
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
            {projects.length === 0 && <option value="">— No projects —</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => shiftDay(-1)} aria-label="Previous day" style={navBtn}><IcChevL size={16} color="#8ea8c5" /></button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark', flex: 1, textAlign: 'center' }} />
            <button onClick={() => shiftDay(1)} aria-label="Next day" style={navBtn}><IcChevR size={16} color="#8ea8c5" /></button>
            {!isToday && (
              <button onClick={jumpToToday} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '0.5px solid rgba(16,185,129,0.35)', color: '#10b981', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Today</button>
            )}
          </div>
        </div>
      </div>

      {!projectId && projects.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcDoc size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>Create a project first to start logging site diaries.</p>
          <Link href="/projects" style={{ display: 'inline-block', marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#10b981', textDecoration: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>Go to projects</Link>
        </div>
      ) : loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : data ? (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Kpi icon={<IcClock size={14} color="#10b981" />} label="Hours" value={data.summary.hoursTotal.toFixed(1)} color="#10b981" />
            <Kpi icon={<IcTeam size={14} color="#3b82f6" />} label="On site" value={String(data.summary.peopleOnSite)} color="#3b82f6" />
            <Kpi icon={<IcAlert size={14} color="#ef4444" />} label="Snags raised" value={String(data.summary.snagsRaised)} color="#ef4444" />
            <Kpi icon={<IcCheck size={14} color="#10b981" />} label="Snags closed" value={String(data.summary.snagsClosed)} color="#10b981" />
            <Kpi icon={<IcCamera size={14} color="#8b5cf6" />} label="Photos" value={String(data.summary.photosTaken)} color="#8b5cf6" />
            <Kpi icon={<IcDoc size={14} color="#06b6d4" />} label="Docs filed" value={String(data.summary.documentsFiled)} color="#06b6d4" />
          </div>

          {data.timeEntries.length > 0 && (
            <Section title="Hours on site">
              {data.timeEntries.map(e => (
                <Row key={e.id} left={<><IcClock size={13} color="#10b981" /><span style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa', fontWeight: 600 }}>{e.member?.name || 'Unknown'}</span></>} right={<span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#10b981', fontWeight: 700 }}>{e.hours}h</span>} sub={e.member?.role} />
              ))}
            </Section>
          )}

          {(data.snagsRaised.length > 0 || data.snagsClosed.length > 0) && (
            <Section title="Snags">
              {data.snagsRaised.map(s => (
                <Row key={`r-${s.id}`} left={<><IcAlert size={13} color="#ef4444" /><span style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{s.title}</span></>} right={<span style={{ fontFamily: SF, fontSize: 10, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Raised</span>} sub={`${s.priority} priority`} />
              ))}
              {data.snagsClosed.map(s => (
                <Row key={`c-${s.id}`} left={<><IcCheck size={13} color="#10b981" /><span style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', textDecoration: 'line-through' }}>{s.title}</span></>} right={<span style={{ fontFamily: SF, fontSize: 10, color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Closed</span>} />
              ))}
            </Section>
          )}

          {data.photos.length > 0 && (
            <Section title={`Photos · ${data.photos.length}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 6 }}>
                {data.photos.map(p => (
                  <a key={p.id} href={p.url || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', borderRadius: 6, overflow: 'hidden', background: '#0c1a2e' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url!} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {data.activities.length > 0 && (
            <Section title="Activity">
              {data.activities.map(a => (
                <Row key={a.id} left={<><span style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{a.actorName}</span><span style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5', marginLeft: 4 }}>{a.action}</span></>} right={<span style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{new Date(a.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>} sub={a.detail || undefined} />
              ))}
            </Section>
          )}

          {(data.summary.hoursTotal === 0 && data.summary.peopleOnSite === 0 && data.summary.snagsRaised === 0 && data.summary.snagsClosed === 0 && data.summary.photosTaken === 0 && data.summary.activityEvents === 0) && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
              <IcDoc size={32} color="#52749a" />
              <p style={{ marginTop: 12, fontSize: 14 }}>Nothing logged on this day yet.</p>
              <p style={{ marginTop: 6, fontSize: 12 }}>Hours appear once team members are clocked in. Photos / snags / docs flow in from /capture, /photos, /snags.</p>
            </div>
          )}
        </div>
      ) : null}

      <TabBar />
    </div>
  )
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 8px', fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

function Row({ left, right, sub }: { left: React.ReactNode; right?: React.ReactNode; sub?: string }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>{left}</div>
        {right}
      </div>
      {sub && <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 4, marginLeft: 19 }}>{sub}</div>}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2f4e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#eef3fa', fontFamily: SF, fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

'use client'

import { useState, useEffect } from 'react'
import { IcLayers, IcAlert, IcCamera, IcCheck } from '@/components/ui/Icons'

interface Project {
  id: string
  name: string
  address: string
  postcode: string
  status: string
  progress: number
  clientName: string
  budget: number
  spent: number
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}
interface Stats { openSnags: number; photoCount: number }
interface PhotoDoc { id: string; name: string; url: string | null; createdAt: string }
interface ActivityItem { id: string; action: string; createdAt: string; iconType: string }
interface Data { project: Project; stats: Stats; photos: PhotoDoc[]; activity: ActivityItem[] }

const SF = 'var(--font-system)'

export default function ClientViewToken({ params }: { params: { token: string } }) {
  const { token } = params
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch(`/api/client-view/${token}`)
      .then(async r => {
        if (r.status === 404) throw new Error('not_found')
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((d: Data) => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [token])

  const niceDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const progressColor = (p: number) => p >= 90 ? '#22c55e' : p >= 50 ? '#3b82f6' : p > 0 ? '#f59e0b' : '#52749a'
  const budgetSpentPct = (budget: number, spent: number) => budget > 0 ? Math.round((spent / budget) * 100) : 0

  if (loading) {
    return <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
  }
  if (error === 'not_found' || !data) {
    return (
      <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', fontFamily: SF }}>
        <IcLayers size={48} color="#52749a" />
        <h1 style={{ fontSize: 24, color: '#eef3fa', marginTop: 16, fontWeight: 700, letterSpacing: -0.3 }}>Link not active</h1>
        <p style={{ color: '#8ea8c5', marginTop: 8, maxWidth: 360, lineHeight: 1.5 }}>
          This client-view link is invalid or has been revoked. Ask the project manager for a fresh link.
        </p>
      </div>
    )
  }

  const { project, stats, photos, activity } = data
  const spentPct = budgetSpentPct(project.budget, project.spent)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', color: '#eef3fa', fontFamily: SF }}>
      <div style={{ background: 'linear-gradient(180deg, #0c1a2e 0%, #06101e 100%)', padding: '32px 20px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ fontFamily: SF, fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Cortexx · client view</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#eef3fa', letterSpacing: -0.6, lineHeight: 1.15 }}>{project.name}</h1>
          {project.clientName && <div style={{ fontSize: 14, color: '#8ea8c5', marginTop: 6 }}>For: {project.clientName}</div>}
          <div style={{ fontSize: 13, color: '#52749a', marginTop: 4 }}>
            {project.address}{project.postcode ? `, ${project.postcode}` : ''}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: SF, fontSize: 10, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Progress</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: progressColor(project.progress), fontWeight: 700 }}>{project.progress}%</div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${project.progress}%`, height: '100%', background: progressColor(project.progress), transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Kpi label="Status" value={project.status.replace(/_/g, ' ')} color={project.status === 'complete' ? '#22c55e' : project.status === 'snagging' ? '#f59e0b' : '#3b82f6'} />
          <Kpi label="Open snags" value={String(stats.openSnags)} color={stats.openSnags > 0 ? '#f59e0b' : '#22c55e'} />
          <Kpi label="Photos" value={String(stats.photoCount)} color="#8b5cf6" />
        </div>

        {project.budget > 0 && (
          <Section title="Budget">
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: SF, fontSize: 13, color: '#8ea8c5' }}>£{project.spent.toLocaleString('en-GB', { maximumFractionDigits: 0 })} of £{project.budget.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: spentPct > 100 ? '#ef4444' : spentPct > 90 ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>{spentPct}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, spentPct)}%`, height: '100%', background: spentPct > 100 ? '#ef4444' : spentPct > 90 ? '#f59e0b' : '#22c55e' }} />
              </div>
            </div>
          </Section>
        )}

        {(project.startDate || project.endDate) && (
          <Section title="Programme">
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: SF, fontSize: 13, color: '#c1d2e8' }}>
              {project.startDate && <div><span style={{ color: '#52749a' }}>Start:</span> {niceDate(project.startDate)}</div>}
              {project.endDate && <div><span style={{ color: '#52749a' }}>Target completion:</span> {niceDate(project.endDate)}</div>}
            </div>
          </Section>
        )}

        {photos.length > 0 && (
          <Section title={`Recent photos · ${photos.length}`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 8 }}>
              {photos.map(p => (
                <a key={p.id} href={p.url || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', borderRadius: 6, overflow: 'hidden', background: '#0c1a2e' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url!} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                </a>
              ))}
            </div>
          </Section>
        )}

        {activity.length > 0 && (
          <Section title="Recent updates">
            {activity.map(a => (
              <div key={a.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', display: 'flex', gap: 8, alignItems: 'center' }}>
                {a.iconType === 'camera' ? <IcCamera size={14} color="#8b5cf6" />
                  : a.iconType === 'doc' ? <IcAlert size={14} color="#06b6d4" />
                  : <IcCheck size={14} color="#22c55e" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{a.action}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 1 }}>{niceDate(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </Section>
        )}

        <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '0.5px dashed rgba(255,255,255,0.07)', textAlign: 'center', fontFamily: SF, fontSize: 11, color: '#52749a', lineHeight: 1.5 }}>
          This is a private link from your project team. Don&apos;t share publicly.<br />
          Updated {new Date(project.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 10, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, color, fontWeight: 700, textTransform: 'capitalize' }}>{value}</div>
      <div style={{ fontFamily: SF, fontSize: 9, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

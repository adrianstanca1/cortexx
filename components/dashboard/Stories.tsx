'use client'

import { useRouter } from 'next/navigation'
import Avatar from '../ui/Avatar'
import { IcCamera, IcSpark, IcCheck } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface StoriesProps {
  accent?: string
  data?: DashboardData | null
}

const statusColors: Record<string, string> = {
  active: '#f59e0b', snagging: '#10b981', quoting: '#06b6d4', complete: '#52749a'
}

export default function Stories({ accent = '#8b5cf6', data }: StoriesProps) {
  const router = useRouter()
  const projects = data?.projects || []
  const activities = data?.activities || []
  const featured = projects[0]
  const activeCount = projects.filter(p => p.status === 'active').length

  return (
    <div style={{ padding: '0 0 100px' }}>
      <div style={{ padding: '20px 20px 12px' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)' }}>Sites</h2>
        <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>Swipe through · {activeCount} active</p>
      </div>

      {/* Story strip */}
      <div style={{ padding: '4px 20px 16px', display: 'flex', gap: 14, overflowX: 'auto' }}>
        {projects.map((project, i) => {
          const c = statusColors[project.status] || '#52749a'
          const hasProgress = project.progress > 0
          return (
            <div key={project.id} onClick={() => router.push(`/projects/${project.id}`)} style={{ flexShrink: 0, textAlign: 'center', width: 64, cursor: 'pointer' }}>
              <div style={{ width: 60, height: 60, borderRadius: 30, padding: 2.5, boxSizing: 'border-box', background: hasProgress ? `conic-gradient(from 0deg, ${c}, ${accent}, ${c})` : 'rgba(255,255,255,0.07)' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `linear-gradient(135deg, ${c}, ${c}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-system)', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {project.name[0]}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#eef3fa', fontWeight: 500, marginTop: 5 }}>{project.name.split(' ')[0]}</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#52749a' }}>{project.progress}%</div>
            </div>
          )
        })}
        <div style={{ flexShrink: 0, textAlign: 'center', width: 64, cursor: 'pointer' }} onClick={() => router.push('/projects')}>
          <div style={{ width: 60, height: 60, borderRadius: 30, padding: 2.5, boxSizing: 'border-box', background: 'transparent', border: '1.5px dashed #52749a' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-system)', fontSize: 24, fontWeight: 700, color: '#52749a' }}>+</div>
          </div>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', fontWeight: 500, marginTop: 5 }}>All</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#52749a' }}>{projects.length}</div>
        </div>
      </div>

      {/* Featured site card */}
      {featured && (
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ background: `linear-gradient(160deg, ${accent}28, #152641 60%)`, borderRadius: 18, padding: 16, border: `0.5px solid ${accent}44`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, background: accent, color: '#fff', padding: '2px 7px', borderRadius: 5 }}>FEATURED</span>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 20, fontWeight: 700, color: '#eef3fa', marginTop: 8, letterSpacing: -0.4 }}>{featured.name}</div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>{featured.clientName} · {featured.postcode}</div>
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 28, fontWeight: 700, color: accent, letterSpacing: -1 }}>{featured.progress}<span style={{ fontSize: 16, color: '#8ea8c5' }}>%</span></div>
            </div>
            {/* Progress phases — derived from project.progress */}
            {(() => {
              const p = featured.progress
              // Each phase = 20% of progress
              const phases = [0, 20, 40, 60, 80].map((threshold, i) => {
                if (p >= threshold + 20) return 1       // fully done
                if (p > threshold) return (p - threshold) / 20  // partial
                return 0                                // not started
              })
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginTop: 14 }}>
                    {phases.map((ph, i) => (
                      <div key={i} style={{ height: 4, borderRadius: 2, background: ph === 0 ? 'rgba(255,255,255,0.07)' : '#10b981', opacity: ph > 0 && ph < 1 ? 0.5 : 1 }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'ui-monospace, monospace', fontSize: 9, color: '#52749a', marginTop: 6 }}>
                    {['Strip', '1st fix', 'Plaster', '2nd fix', 'Snag'].map(s => <span key={s}>{s}</span>)}
                  </div>
                </>
              )
            })()}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#8ea8c5' }}>{featured.onSiteCount} on site now</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => router.push(`/projects/${featured.id}`)} style={{ background: '#fff', color: '#06101e', border: 'none', borderRadius: 10, padding: '7px 14px', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Open</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ fontFamily: 'var(--font-system)', fontSize: 11, fontWeight: 700, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.6 }}>Activity feed</p>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activities.map((a) => {
          const color = a.actorType === 'ai' ? '#8b5cf6' : a.actorType === 'system' ? '#52749a' : '#2563eb'
          const relTime = (() => {
            const mins = Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60000)
            if (mins < 60) return `${mins} min`
            const hrs = Math.round(mins / 60)
            return `${hrs} hr`
          })()
          return (
            <div key={a.id} style={{ background: '#152641', borderRadius: 12, padding: '10px 12px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={a.actorName} color={color} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa', lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 600 }}>{a.actorName}</span> <span style={{ color: '#8ea8c5' }}>{a.action}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#52749a', marginTop: 1 }}>
                  {a.project?.name || ''}{a.project && a.detail ? ' · ' : ''}{a.detail || ''} · {relTime} ago
                </div>
              </div>
              <div style={{ color, opacity: 0.7 }}>
                {a.iconType === 'camera' && <IcCamera size={14} color={color} />}
                {a.iconType === 'spark' && <IcSpark size={14} color={color} />}
                {a.iconType === 'check' && <IcCheck size={14} color={color} />}
              </div>
            </div>
          )
        })}
        {activities.length === 0 && (
          <p style={{ fontSize: 13, color: '#52749a', fontFamily: 'var(--font-system)', textAlign: 'center', padding: '20px 0' }}>No recent activity</p>
        )}
      </div>
    </div>
  )
}

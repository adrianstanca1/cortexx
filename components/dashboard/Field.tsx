'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IcCamera, IcReceipt, IcMic, IcAlert, IcCheck, IcPin, IcChevDown } from '../ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
import type { DashboardData, Task } from '@/lib/types'

interface FieldProps {
  accent?: string
  data?: DashboardData | null
}

/**
 * Variant 6 — Field worker: big targets, glove-friendly.
 * Matches project/lib/dashboards.jsx DashV6_Field.
 */
export default function Field({ accent = '#f59e0b', data }: FieldProps) {
  const router = useRouter()
  const { connected } = useRealtimeActivity(data?.activities || [])
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null)

  const activeProject = data?.projects?.find(p => p.status === 'active') || data?.projects?.[0]
  const rawTasks = data?.tasks?.filter(t => t.projectId === activeProject?.id).slice(0, 4) || []
  const projectTasks = localTasks ?? rawTasks
  const openCount = projectTasks.filter(t => t.status !== 'done').length
  const onSite = (activeProject?.onSiteCount ?? 0) > 0 || activeProject?.status === 'active'

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    setLocalTasks(cur => (cur ?? rawTasks).map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      setLocalTasks(null)
    }
  }

  const SF = 'var(--font-system)'

  return (
    <div style={{ padding: '8px 0 100px' }}>
      {/* Site selector — SITE label small, project name big with chevron */}
      {activeProject && (
        <div style={{ padding: '8px 20px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={() => router.push('/projects')} style={{ cursor: 'pointer' }}>
            <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', fontWeight: 600, letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 6 }}>
              SITE
              <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 6px #10b98166' : 'none', transition: 'all 0.3s' }} />
            </div>
            <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {activeProject.name}
              <IcChevDown size={18} color="#eef3fa" />
            </div>
          </div>
          {onSite && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(16,185,129,0.13)', color: '#10b981',
              padding: '6px 10px', borderRadius: 14,
              fontFamily: SF, fontSize: 12, fontWeight: 700,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              ON SITE
            </div>
          )}
        </div>
      )}

      {/* Big primary action — glove-friendly Capture CTA */}
      <div style={{ padding: '0 16px 12px' }}>
        <Link href="/capture" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%', background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
            border: 'none', borderRadius: 18, padding: '20px 18px',
            color: '#0a1830', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: `0 10px 24px ${accent}66`,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(0,0,0,0.18)', color: '#0a1830',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <IcCamera size={28} color="#0a1830" />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Capture progress</div>
              <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, opacity: 0.7, marginTop: 2 }}>Photo + voice note</div>
            </div>
          </button>
        </Link>
      </div>

      {/* 2x2 chunky tiles */}
      <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { l: 'Check in', s: 'GPS log hours', c: '#10b981', I: IcPin, href: '/capture?type=checkin' },
          { l: 'Receipt', s: 'Scan + assign', c: '#8b5cf6', I: IcReceipt, href: '/capture?type=receipt' },
          { l: 'Voice RFI', s: 'Speak it', c: '#06b6d4', I: IcMic, href: '/capture?type=voice' },
          { l: 'Incident', s: 'Report now', c: '#ef4444', I: IcAlert, href: '/capture?type=incident' },
        ].map(x => (
          <button
            key={x.l}
            onClick={() => router.push(x.href)}
            style={{
              background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 16,
              padding: '16px 14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
              minHeight: 88,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: `${x.c}22`, color: x.c,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <x.I size={22} color={x.c} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: '#eef3fa' }}>{x.l}</div>
              <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 1 }}>{x.s}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Today's jobs — chunky list */}
      <div style={{ padding: '4px 20px 8px' }}>
        <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: '#8ea8c5', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Today&rsquo;s jobs · {openCount} left
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {projectTasks.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 13 }}>All clear on this site</div>
        )}
        {projectTasks.map(task => {
          const done = task.status === 'done'
          const inProgress = task.status === 'in_progress'
          const detail = inProgress
            ? (task.assignee?.name ? `${task.assignee.name} · in progress` : 'in progress')
            : done ? 'Done' : task.dueTime ? `Due ${task.dueTime}` : task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Today'
          const c = done ? '#52749a' : inProgress ? accent : '#eef3fa'
          return (
            <div
              key={task.id}
              onClick={() => toggleTask(task)}
              style={{
                background: '#152641', borderRadius: 12, padding: '14px 16px',
                border: '0.5px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 7,
                background: done ? '#10b981' : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${done ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {done && <IcCheck size={14} color="#fff" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: c, textDecoration: done ? 'line-through' : 'none' }}>
                  {task.title}
                </div>
                <div style={{ fontFamily: SF, fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>{detail}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

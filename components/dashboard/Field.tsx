'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IcCamera, IcReceipt, IcMic, IcAlert, IcHardhat, IcCheck, IcPin } from '../ui/Icons'
import Link from 'next/link'
import type { DashboardData, Task } from '@/lib/types'

interface FieldProps {
  accent?: string
  data?: DashboardData | null
}

export default function Field({ accent = '#f59e0b', data }: FieldProps) {
  const router = useRouter()
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null)

  const activeProject = data?.projects?.find(p => p.status === 'active') || data?.projects?.[0]
  const rawTasks = data?.tasks?.filter(t => t.projectId === activeProject?.id).slice(0, 4) || []
  const projectTasks = localTasks ?? rawTasks

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    setLocalTasks(cur => (cur ?? rawTasks).map((t: Task) => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch { /* revert on failure */
      setLocalTasks(null)
    }
  }

  return (
    <div style={{ padding: '16px 20px 100px' }}>
      {/* Site selector */}
      {activeProject && (
        <div onClick={() => router.push(`/projects/${activeProject.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 16, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IcPin size={16} color={accent} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{activeProject.name}</p>
              <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'var(--font-system)' }}>{activeProject.address || activeProject.postcode}</p>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: 99, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)' }}>
            {activeProject.status === 'active' ? 'On Site' : activeProject.status}
          </span>
        </div>
      )}

      {/* Big capture CTA */}
      <Link href="/capture" style={{ textDecoration: 'none' }}>
        <div style={{ borderRadius: 20, background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, padding: '22px 20px', textAlign: 'center', marginBottom: 14, boxShadow: `0 8px 24px ${accent}44` }}>
          <IcCamera size={28} color="#fff" />
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 8, fontFamily: 'var(--font-system)', letterSpacing: '-0.01em' }}>Capture Progress</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: 'var(--font-system)' }}>Photo · video · note</p>
        </div>
      </Link>

      {/* 2×2 action tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Check In', sub: 'Log your arrival', Icon: IcHardhat, color: '#2563eb', href: '/capture?type=checkin' },
          { label: 'Receipt', sub: 'Snap & upload', Icon: IcReceipt, color: '#10b981', href: '/capture?type=receipt' },
          { label: 'Voice RFI', sub: 'Record a request', Icon: IcMic, color: '#8b5cf6', href: '/capture?type=voice' },
          { label: 'Incident', sub: 'Report issue', Icon: IcAlert, color: '#ef4444', href: '/capture?type=incident' },
        ].map((tile) => (
          <button key={tile.label} onClick={() => router.push(tile.href)} style={{ padding: '16px 14px', borderRadius: 16, background: `${tile.color}11`, border: `1px solid ${tile.color}33`, textAlign: 'left', cursor: 'pointer' }}>
            <tile.Icon size={22} color={tile.color} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#eef3fa', marginTop: 8, fontFamily: 'var(--font-system)' }}>{tile.label}</p>
            <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>{tile.sub}</p>
          </button>
        ))}
      </div>

      {/* Today's jobs checklist */}
      {projectTasks.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 10 }}>
            Open tasks · {activeProject?.name}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projectTasks.map((task) => {
              const done = task.status === 'done'
              return (
                <div key={task.id} onClick={() => toggleTask(task)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: done ? '#10b981' : 'rgba(255,255,255,0.08)', border: `1.5px solid ${done ? '#10b981' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {done && <IcCheck size={13} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 13, color: done ? '#52749a' : '#eef3fa', textDecoration: done ? 'line-through' : 'none', fontFamily: 'var(--font-system)', flex: 1 }}>
                    {task.title}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

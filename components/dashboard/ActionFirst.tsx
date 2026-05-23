'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IcWeather, IcCheck, IcPin, IcWrench, IcTruck, IcHardhat, IcClock, IcArrowRight } from '../ui/Icons'
import type { DashboardData } from '@/lib/types'

interface ActionFirstProps {
  accent?: string
  data?: DashboardData | null
}

const iconForCategory = (cat: string | null) => {
  if (!cat) return 'wrench'
  if (cat.includes('deliver') || cat.includes('material')) return 'truck'
  if (cat.includes('inspect') || cat.includes('site')) return 'pin'
  if (cat.includes('brief') || cat.includes('team') || cat.includes('meeting')) return 'hardhat'
  return 'wrench'
}

export default function ActionFirst({ accent = '#f59e0b', data }: ActionFirstProps) {
  const router = useRouter()
  const today = new Date()
  const dayName = today.toLocaleDateString('en-GB', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  const todayStr = today.toISOString().split('T')[0]

  const tasks = data?.tasks || []
  const nextTask = tasks[0] || null
  const todayTasks = tasks.slice(0, 4)
  const tasksDue = tasks.filter(t => t.dueDate?.startsWith(todayStr)).length
  const onSiteTotal = data?.projects?.reduce((s, p) => s + (p.onSiteCount || 0), 0) ?? 0
  const owed = data?.stats?.owed ?? 0
  const owedLabel = owed >= 1000 ? `£${Math.round(owed / 1000)}k` : owed > 0 ? `£${owed}` : '£0'

  const [checkingIn, setCheckingIn] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleCheckIn = async () => {
    if (!nextTask?.projectId || checkingIn) return
    setCheckingIn(true)
    try {
      // Bump the project's on-site count
      await fetch(`/api/projects/${nextTask.projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onSiteCount: ((data?.projects?.find(p => p.id === nextTask.projectId)?.onSiteCount) || 0) + 1 }),
      })
      // Log activity
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: nextTask.projectId,
          action: 'checked in on site',
          iconType: 'pin',
          actorType: 'human',
          detail: 'GPS logged',
        }),
      })
      setToast(`Checked in to ${nextTask.project?.name || 'site'}`)
      setTimeout(() => setToast(null), 2500)
    } catch {
      setToast('Check-in failed')
      setTimeout(() => setToast(null), 2500)
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, color: '#52749a', fontFamily: 'var(--font-system)' }}>
              {dayName}, {dateStr}
            </p>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginTop: 2 }}>
              Good morning
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <IcWeather size={16} color="#60a5fa" />
            <span style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)' }}>
              {data?.projects?.[0]?.postcode?.split(' ')[0] || (data?.projects?.length ? 'On site' : 'No sites')}
            </span>
          </div>
        </div>
      </div>

      {/* Hero card */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ borderRadius: 20, background: `linear-gradient(135deg, #1a2f4e 0%, #152641 50%, rgba(37,99,235,0.15) 100%)`, border: `1px solid ${accent}33`, padding: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: `${accent}22`, filter: 'blur(30px)' }} />
          {nextTask ? (
            <>
              <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-system)' }}>
                Next up · {nextTask.priority} priority
              </span>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#eef3fa', marginTop: 8, letterSpacing: '-0.02em', fontFamily: 'var(--font-system)' }}>
                {nextTask.title}
              </h3>
              <p style={{ fontSize: 13, color: '#8ea8c5', marginTop: 4, fontFamily: 'var(--font-system)' }}>
                {nextTask.project?.name || 'Unassigned'}{nextTask.assignee ? ` · ${nextTask.assignee.name}` : ''}
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn || !nextTask?.projectId}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: accent, border: 'none', fontSize: 14, fontWeight: 600, color: '#fff', cursor: checkingIn ? 'wait' : 'pointer', fontFamily: 'var(--font-system)', boxShadow: `0 4px 12px ${accent}55`, opacity: checkingIn ? 0.7 : 1 }}
                >
                  {checkingIn ? 'Checking in…' : 'Check In'}
                </button>
                <button
                  onClick={() => nextTask.projectId && router.push(`/projects/${nextTask.projectId}`)}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 14, fontWeight: 600, color: '#8ea8c5', cursor: 'pointer', fontFamily: 'var(--font-system)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <IcPin size={14} color="#8ea8c5" /> View
                </button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-system)' }}>All clear</span>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#eef3fa', marginTop: 8, letterSpacing: '-0.02em', fontFamily: 'var(--font-system)' }}>No urgent tasks today</h3>
              <p style={{ fontSize: 13, color: '#8ea8c5', marginTop: 4, fontFamily: 'var(--font-system)' }}>All sites running smoothly</p>
            </>
          )}
        </div>
      </div>

      {/* Then today */}
      {todayTasks.length > 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#52749a', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-system)', marginBottom: 12 }}>
            Open tasks
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {todayTasks.map((task, i) => {
              const iconName = iconForCategory(task.category)
              const color = task.priority === 'critical' ? '#ef4444' : task.priority === 'high' ? '#f59e0b' : '#2563eb'
              return (
                <div key={task.id} onClick={() => task.projectId && router.push(`/projects/${task.projectId}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: task.projectId ? 'pointer' : 'default' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#52749a', width: 40, fontFamily: 'var(--font-system)' }}>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {iconName === 'pin' && <IcPin size={15} color={color} />}
                    {iconName === 'wrench' && <IcWrench size={15} color={color} />}
                    {iconName === 'truck' && <IcTruck size={15} color={color} />}
                    {iconName === 'hardhat' && <IcHardhat size={15} color={color} />}
                  </div>
                  <span style={{ fontSize: 13, color: '#eef3fa', flex: 1, fontFamily: 'var(--font-system)' }}>{task.title}</span>
                  <IcArrowRight size={14} color="#52749a" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick stats row */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Tasks open', value: String(tasks.length), color: '#ef4444' },
            { label: 'On site now', value: String(onSiteTotal), color: '#10b981' },
            { label: '£ owed', value: owedLabel, color: accent },
          ].map((stat) => (
            <div key={stat.label} style={{ flex: 1, padding: '12px 10px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, letterSpacing: '-0.02em', fontFamily: 'var(--font-system)' }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', left: 12, right: 12, bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))', zIndex: 130,
          background: 'rgba(16,185,129,0.95)', color: '#fff', padding: '12px 16px', borderRadius: 12,
          fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}
    </div>
  )
}

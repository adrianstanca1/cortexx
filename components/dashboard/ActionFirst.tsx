'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IcWeather, IcCheck, IcPin, IcWrench, IcTruck, IcHardhat, IcClock, IcArrowRight } from '../ui/Icons'
import { useRealtimeActivity } from '@/lib/useRealtimeActivity'
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
  const { connected } = useRealtimeActivity(data?.activities || [])
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', marginTop: 2 }}>
                Good morning
              </h2>
              <span title={connected ? 'Live updates connected' : 'Reconnecting…'} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#52749a', boxShadow: connected ? '0 0 8px #10b98166' : 'none', transition: 'all 0.3s' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(255,255,255,0.07)', borderRadius: 12 }}>
            <IcWeather size={16} color="#60a5fa" />
            <span style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)' }}>
              {data?.projects?.[0]?.postcode?.split(' ')[0] || (data?.projects?.length ? 'On site' : 'No sites')}
            </span>
          </div>
        </div>
      </div>

      {/* Hero card — vibrant accent→purple gradient per design */}
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{
          background: nextTask
            ? `linear-gradient(135deg, ${accent}, ${accent}aa 60%, #8b5cf6aa)`
            : `linear-gradient(135deg, #10b981, #10b981aa 60%, #06b6d4aa)`,
          borderRadius: 20,
          padding: 18,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 12px 32px ${accent}44`,
        }}>
          {/* Decorative blurred circle */}
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'relative' }}>
            {nextTask ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff', boxShadow: '0 0 8px #fff' }} />
                  <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    NEXT UP · {nextTask.priority} priority
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginBottom: 4 }}>
                  {nextTask.title}
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  {nextTask.project?.name || 'Unassigned'}{nextTask.assignee ? ` · ${nextTask.assignee.name}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn || !nextTask?.projectId}
                    style={{
                      flex: 1, background: '#fff', color: accent,
                      border: 'none', borderRadius: 11, padding: '11px 12px',
                      fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700,
                      cursor: checkingIn ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: checkingIn ? 0.7 : 1,
                    }}
                  >
                    <IcPin size={15} color={accent} /> {checkingIn ? 'Checking in…' : 'Check in'}
                  </button>
                  <button
                    onClick={() => nextTask.projectId && router.push(`/projects/${nextTask.projectId}`)}
                    style={{
                      background: 'rgba(255,255,255,0.18)', color: '#fff',
                      border: '0.5px solid rgba(255,255,255,0.35)', borderRadius: 11,
                      padding: '11px 14px',
                      fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff', boxShadow: '0 0 8px #fff' }} />
                  <span style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    ALL CLEAR
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginBottom: 4 }}>
                  No urgent tasks today
                </div>
                <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  All sites running smoothly
                </div>
              </>
            )}
          </div>
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

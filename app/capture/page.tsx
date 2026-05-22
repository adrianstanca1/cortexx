'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IcCamera, IcMic, IcReceipt, IcAlert, IcCheck, IcX, IcPin } from '@/components/ui/Icons'
import type { Project } from '@/lib/types'

const actions = [
  { id: 'photo', label: 'Progress Photo', sub: 'Capture site progress', Icon: IcCamera, color: '#2563eb' },
  { id: 'voice', label: 'Voice RFI', sub: 'Record a request or query', Icon: IcMic, color: '#8b5cf6' },
  { id: 'receipt', label: 'Receipt', sub: 'Snap and upload an expense', Icon: IcReceipt, color: '#10b981' },
  { id: 'incident', label: 'Incident', sub: 'Report a site incident', Icon: IcAlert, color: '#ef4444' },
]

const actionLabels: Record<string, string> = {
  photo: 'uploaded a progress photo',
  voice: 'recorded a Voice RFI',
  receipt: 'logged a receipt',
  incident: 'reported an incident',
  checkin: 'checked in to site',
}

const actionIcons: Record<string, string> = {
  photo: 'camera', voice: 'mic', receipt: 'receipt', incident: 'alert', checkin: 'check',
}

function CaptureContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselect = searchParams.get('type')

  const [selected, setSelected] = useState<string | null>(preselect)
  const [done, setDone] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [showProjectPicker, setShowProjectPicker] = useState(false)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => {
        const ps: Project[] = d.projects || d
        setProjects(ps)
        const active = ps.find(p => p.status === 'active') || ps[0] || null
        setActiveProject(active)
      })
      .catch(() => {})
  }, [])

  // Auto-trigger if type pre-selected
  useEffect(() => {
    if (preselect && preselect !== 'checkin' && !done) {
      handleAction(preselect)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect])

  const handleAction = async (id: string) => {
    setSelected(id)
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject?.id || null,
          actorName: 'You',
          actorType: 'human',
          action: actionLabels[id] || id,
          detail: activeProject?.name || null,
          iconType: actionIcons[id] || 'check',
        }),
      })
    } catch { /* non-critical */ }
    setTimeout(() => {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1200)
    }, 600)
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)', letterSpacing: '-0.02em' }}>Capture</h1>
          <button onClick={() => setShowProjectPicker(!showProjectPicker)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <IcPin size={11} color="#52749a" />
            <span style={{ fontSize: 12, color: activeProject ? '#8ea8c5' : '#52749a', fontFamily: 'var(--font-system)' }}>
              {activeProject?.name || 'Select project'}
            </span>
          </button>
        </div>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IcX size={18} color="#8ea8c5" />
        </button>
      </div>

      {/* Project picker dropdown */}
      {showProjectPicker && projects.length > 0 && (
        <div style={{ margin: '8px 20px 0', background: '#152641', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {projects.map(p => (
            <button key={p.id} onClick={() => { setActiveProject(p); setShowProjectPicker(false) }} style={{ width: '100%', padding: '12px 16px', background: p.id === activeProject?.id ? 'rgba(245,158,11,0.1)' : 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#eef3fa' }}>{p.name}</span>
              {p.id === activeProject?.id && <IcCheck size={14} color="#f59e0b" />}
            </button>
          ))}
        </div>
      )}

      {/* Action grid */}
      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {done ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcCheck size={32} color="#10b981" />
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>Captured!</p>
            <p style={{ fontSize: 13, color: '#52749a', fontFamily: 'var(--font-system)' }}>Logged to {activeProject?.name || 'project'}…</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 4 }}>What are you capturing?</p>
            {actions.map(action => (
              <button key={action.id} onClick={() => handleAction(action.id)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 18px', borderRadius: 18, background: selected === action.id ? `${action.color}22` : 'rgba(255,255,255,0.04)', border: `1.5px solid ${selected === action.id ? action.color : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', transform: selected === action.id ? 'scale(0.98)' : 'scale(1)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${action.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <action.Icon size={24} color={action.color} />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)', letterSpacing: '-0.01em' }}>{action.label}</p>
                  <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginTop: 2 }}>{action.sub}</p>
                </div>
                {selected === action.id && (
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${action.color}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
                  </div>
                )}
              </button>
            ))}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

            <button onClick={() => handleAction('checkin')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 0', borderRadius: 16, background: 'linear-gradient(135deg, #f59e0b, #f59e0bcc)', border: 'none', cursor: 'pointer', width: '100%', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-system)' }}>
                Check In to {activeProject?.name || 'Site'}
              </span>
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense fallback={<div style={{ background: '#06101e', minHeight: '100dvh' }} />}>
      <CaptureContent />
    </Suspense>
  )
}

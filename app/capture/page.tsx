'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IcCamera, IcMic, IcReceipt, IcAlert, IcCheck, IcX, IcPin } from '@/components/ui/Icons'
import type { Project } from '@/lib/types'

const actions = [
  { id: 'photo', label: 'Progress Photo', sub: 'Capture site progress', Icon: IcCamera, color: '#2563eb' },
  { id: 'voice', label: 'Voice RFI', sub: 'Log a request as a high-priority task', Icon: IcMic, color: '#8b5cf6' },
  { id: 'receipt', label: 'Receipt', sub: 'Snap and upload an expense', Icon: IcReceipt, color: '#10b981' },
  { id: 'incident', label: 'Incident', sub: 'Report a site incident', Icon: IcAlert, color: '#ef4444' },
]

function CaptureContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselect = searchParams.get('type')

  const [selected, setSelected] = useState<string | null>(preselect)
  const [done, setDone] = useState(false)
  const [doneMsg, setDoneMsg] = useState('Captured!')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [recentSelect, setRecentSelect] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileTypeRef = useRef<'photo' | 'receipt' | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

  const logActivity = useCallback(async (action: string, iconType: string, detail?: string | null) => {
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject?.id || null, action, iconType, detail: detail ?? null }),
      })
    } catch { /* non-critical */ }
  }, [activeProject])

  const finishWith = useCallback((msg: string) => {
    setDoneMsg(msg)
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }, [router])

  const failWith = useCallback((err: string) => {
    setErrorMsg(err)
    setSelected(null)
    setTimeout(() => setErrorMsg(null), 3000)
  }, [])

  const uploadFile = useCallback(async (file: File | Blob, filename: string) => {
    const fd = new FormData()
    fd.append('file', file, filename)
    const res = await fetch('/api/uploads', { method: 'POST', body: fd })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || 'Upload failed')
    }
    return res.json() as Promise<{ url: string; name: string; size: number; mimeType: string }>
  }, [])

  const onFileSelected = useCallback(async (file: File) => {
    const type = fileTypeRef.current
    if (!type || !file) return
    try {
      const uploaded = await uploadFile(file, file.name)
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          type,
          projectId: activeProject?.id || null,
          url: uploaded.url,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error || 'Save failed')
      await logActivity(
        type === 'photo' ? 'uploaded a progress photo' : 'logged a receipt',
        type === 'photo' ? 'camera' : 'receipt',
      )
      finishWith(type === 'photo' ? 'Photo logged' : 'Receipt logged')
    } catch (e) {
      failWith(e instanceof Error ? e.message : 'Failed')
    }
  }, [activeProject, logActivity, finishWith, failWith, uploadFile])

  const finishVoiceRfi = useCallback(async (audioUrl: string | null) => {
    const title = `RFI: ${activeProject?.name || 'site'}`
    const description = audioUrl
      ? `Voice RFI raised from capture page.\nAudio: ${audioUrl}\n(Transcription pending.)`
      : 'Voice RFI raised from capture page (audio capture unavailable on this device).'
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        priority: 'high',
        projectId: activeProject?.id || null,
      }),
    })
    if (!res.ok) throw new Error('Failed to create RFI task')
    await logActivity('raised a Voice RFI', 'mic', audioUrl ? 'audio attached' : null)
    finishWith('RFI task created')
  }, [activeProject, logActivity, finishWith])

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const startVoiceRfi = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      // No mic API — fall back to creating the RFI task with no audio
      try { await finishVoiceRfi(null) } catch (e) { failWith(e instanceof Error ? e.message : 'Failed') }
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      audioChunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' })
        try {
          let audioUrl: string | null = null
          if (blob.size > 0) {
            const uploaded = await uploadFile(blob, `voice-${Date.now()}.webm`)
            audioUrl = uploaded.url
            if (activeProject?.id) {
              await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: `Voice RFI ${new Date().toLocaleString('en-GB')}`,
                  type: 'audio',
                  projectId: activeProject.id,
                  url: uploaded.url,
                  size: uploaded.size,
                  mimeType: uploaded.mimeType,
                }),
              }).catch(() => {})
            }
          }
          await finishVoiceRfi(audioUrl)
        } catch (e) {
          failWith(e instanceof Error ? e.message : 'Failed')
        }
      }
      mediaRecorderRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      // Permission denied / no device — degrade to task-only RFI
      try { await finishVoiceRfi(null) } catch (e) { failWith(e instanceof Error ? e.message : 'Failed') }
    }
  }, [activeProject, finishVoiceRfi, failWith, uploadFile])

  const handleAction = useCallback(async (id: string) => {
    setSelected(id)
    setErrorMsg(null)
    try {
      if (id === 'photo' || id === 'receipt') {
        // Open file picker — uses device camera on mobile
        fileTypeRef.current = id
        fileInputRef.current?.click()
        return // wait for onChange
      }
      if (id === 'voice') {
        // If already recording, stop and let the recorder onstop handler finish the flow.
        if (recording) {
          stopRecording()
          return
        }
        await startVoiceRfi()
        return
      }
      if (id === 'incident') {
        const title = `Incident: ${activeProject?.name || 'site'}`
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: 'Site incident — investigate and document',
            priority: 'critical',
            projectId: activeProject?.id || null,
          }),
        })
        if (!res.ok) throw new Error('Failed to log incident')
        await logActivity('reported an incident', 'alert')
        finishWith('Incident logged')
        return
      }
      if (id === 'checkin') {
        if (activeProject) {
          // Bump onSiteCount and log activity
          await fetch(`/api/projects/${activeProject.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ onSiteCount: (activeProject.onSiteCount || 0) + 1 }),
          }).catch(() => {})
        }
        await logActivity('checked in on site', 'pin', 'GPS logged')
        finishWith('Checked in')
        return
      }
      // fallback
      await logActivity(id, 'check')
      finishWith('Logged')
    } catch (e) {
      failWith(e instanceof Error ? e.message : 'Failed')
    }
  }, [activeProject, logActivity, finishWith, failWith, recording, startVoiceRfi, stopRecording])

  // Auto-trigger if type pre-selected
  useEffect(() => {
    if (preselect && !done && projects.length > 0) {
      handleAction(preselect)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect, projects.length])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Hidden file input — drives photo + receipt actions */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFileSelected(f)
          e.target.value = ''
        }}
      />

      {/* Header */}
      <div style={{ padding: '16px 20px 16px 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)', letterSpacing: '-0.02em' }}>Capture</h1>
          <button onClick={() => setShowProjectPicker(!showProjectPicker)} aria-label="Change project" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <IcPin size={11} color="#52749a" />
            <span style={{ fontSize: 12, color: activeProject ? '#8ea8c5' : '#52749a', fontFamily: 'var(--font-system)' }}>
              {activeProject?.name || 'Select project'}
            </span>
          </button>
        </div>
        <button onClick={() => router.back()} aria-label="Close capture" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IcX size={18} color="#8ea8c5" />
        </button>
      </div>

      {/* Project picker dropdown */}
      {showProjectPicker && projects.length > 0 && (
        <div style={{ margin: '8px 20px 0', background: '#152641', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setActiveProject(p)
                setRecentSelect(p.id)
                setTimeout(() => { setShowProjectPicker(false); setRecentSelect(null) }, 200)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: recentSelect === p.id
                  ? 'rgba(245,158,11,0.25)'
                  : p.id === activeProject?.id ? 'rgba(245,158,11,0.1)' : 'none',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
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
            <p style={{ fontSize: 18, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)' }}>{doneMsg}</p>
            <p style={{ fontSize: 13, color: '#52749a', fontFamily: 'var(--font-system)' }}>Logged to {activeProject?.name || 'project'}…</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginBottom: 4 }}>What are you capturing?</p>
            {errorMsg && (
              <div role="alert" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-system)', fontSize: 13 }}>
                {errorMsg}
              </div>
            )}
            {actions.map(action => {
              const isVoiceRecording = action.id === 'voice' && recording
              const isSelected = selected === action.id
              // While recording voice, keep the button tappable so the user can stop.
              const disabled = isSelected && !isVoiceRecording
              const sub = isVoiceRecording ? 'Recording… tap to stop' : action.sub
              return (
                <button key={action.id} onClick={() => handleAction(action.id)} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 18px', borderRadius: 18, background: isSelected ? `${action.color}22` : 'rgba(255,255,255,0.04)', border: `1.5px solid ${isSelected ? action.color : 'rgba(255,255,255,0.08)'}`, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', transform: isSelected ? 'scale(0.98)' : 'scale(1)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: `${action.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <action.Icon size={24} color={action.color} />
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#eef3fa', fontFamily: 'var(--font-system)', letterSpacing: '-0.01em' }}>{action.label}</p>
                    <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', marginTop: 2 }}>{sub}</p>
                  </div>
                  {isVoiceRecording ? (
                    <div style={{ marginLeft: 'auto', width: 14, height: 14, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }} />
                  ) : isSelected ? (
                    <div style={{ marginLeft: 'auto' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${action.color}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
                    </div>
                  ) : null}
                </button>
              )
            })}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

            <button onClick={() => handleAction('checkin')} disabled={!activeProject || selected === 'checkin'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 0', borderRadius: 16, background: 'linear-gradient(135deg, #f59e0b, #f59e0bcc)', border: 'none', cursor: activeProject ? 'pointer' : 'not-allowed', width: '100%', boxShadow: '0 4px 16px rgba(245,158,11,0.3)', opacity: activeProject ? 1 : 0.5 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-system)' }}>
                Check In to {activeProject?.name || 'Site'}
              </span>
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
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

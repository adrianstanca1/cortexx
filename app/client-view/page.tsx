'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcLayers, IcChevL } from '@/components/ui/Icons'

interface Project {
  id: string
  name: string
  address: string
  clientToken: string | null
  clientViewEnabled: boolean
}

const SF = 'var(--font-system)'

export default function ClientViewPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/projects?status=active')
      if (!res.ok) throw new Error('Failed to load projects')
      const data = await res.json()
      // Project list API doesn't include clientToken — fetch each in parallel.
      const list = (data.projects || []) as Array<{ id: string; name: string; address: string }>
      const enriched = await Promise.all(
        list.map(async p => {
          try {
            const r = await fetch(`/api/projects/${p.id}/client-link`)
            if (!r.ok) return { id: p.id, name: p.name, address: p.address, clientToken: null, clientViewEnabled: false }
            const link = await r.json()
            return {
              id: p.id,
              name: p.name,
              address: p.address,
              clientToken: link.clientToken || null,
              clientViewEnabled: !!link.clientViewEnabled,
            }
          } catch {
            return { id: p.id, name: p.name, address: p.address, clientToken: null, clientViewEnabled: false }
          }
        })
      )
      setProjects(enriched)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'enable' | 'rotate' | 'disable') => {
    setBusy(id)
    try {
      const res = await fetch(`/api/projects/${id}/client-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      setToast({ msg: action === 'disable' ? 'Portal disabled' : action === 'rotate' ? 'Link rotated' : 'Portal enabled', type: 'success' })
      load()
    } catch {
      setToast({ msg: 'Action failed', type: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast({ msg: 'Link copied', type: 'success' })
    } catch {
      setToast({ msg: 'Copy failed', type: 'error' })
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IcLayers size={20} color="#10b981" /> Client view
        </h1>
        <p style={{ fontSize: 11, color: '#52749a', marginTop: 2, fontFamily: SF }}>
          Per-project read-only portal you can share with clients — no sign-in required.
        </p>
      </div>

      {loading && <div style={{ padding: 24, color: '#8ea8c5', fontFamily: SF, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ padding: 24, color: '#fca5a5', fontFamily: SF, fontSize: 13 }}>{error}</div>}
      {!loading && projects.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>No active projects. Create one first.</div>
      )}

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projects.map(p => {
          const url = p.clientToken ? `${origin}/client/${p.clientToken}` : null
          const live = p.clientViewEnabled && !!p.clientToken
          return (
            <div key={p.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, color: '#eef3fa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</div>
                </div>
                <span style={{ background: live ? 'rgba(16,185,129,0.2)' : 'rgba(82,116,154,0.2)', color: live ? '#10b981' : '#52749a', padding: '3px 8px', borderRadius: 6, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                  {live ? 'Live' : 'Off'}
                </span>
              </div>

              {url && live && (
                <div style={{ background: '#0a1426', borderRadius: 8, padding: '8px 10px', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#8ea8c5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                  {url}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!live && (
                  <button onClick={() => act(p.id, 'enable')} disabled={busy === p.id} style={btn('#10b981')}>
                    {busy === p.id ? '…' : 'Enable'}
                  </button>
                )}
                {live && (
                  <>
                    <a href={url!} target="_blank" rel="noopener noreferrer" style={{ ...btn('#06b6d4'), textDecoration: 'none' }}>Preview ↗</a>
                    <button onClick={() => copy(url!)} style={btn('#1a2f4e', '#c1d2e8')}>Copy link</button>
                    <button onClick={() => act(p.id, 'rotate')} disabled={busy === p.id} style={btn('#1a2f4e', '#c1d2e8')}>Rotate</button>
                    <button onClick={() => act(p.id, 'disable')} disabled={busy === p.id} style={btn('#1a2f4e', '#fca5a5')}>Disable</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <TabBar />
    </div>
  )
}

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return {
    background: bg,
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '6px 12px',
    color,
    fontFamily: SF,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  }
}

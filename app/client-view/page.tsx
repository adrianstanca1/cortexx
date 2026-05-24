'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcLayers, IcChevL, IcCheck, IcTrash, IcSend } from '@/components/ui/Icons'

interface Project {
  id: string
  name: string
  clientName: string
  status: string
  progress: number
  shareToken: string | null
}

const SF = 'var(--font-system)'

export default function ClientViewPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin) }, [])

  const load = useCallback(() => {
    fetch('/api/projects')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => {
        const ps: Project[] = (d?.projects || []).map((p: { id: string; name: string; clientName: string; status: string; progress: number; shareToken: string | null }) => ({
          id: p.id, name: p.name, clientName: p.clientName, status: p.status, progress: p.progress, shareToken: p.shareToken,
        }))
        setProjects(ps)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const createOrRotate = async (p: Project) => {
    setWorking(p.id)
    try {
      const res = await fetch(`/api/projects/${p.id}/share-token`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setProjects(prev => prev.map(x => x.id === p.id ? { ...x, shareToken: updated.shareToken } : x))
      setToast({ msg: p.shareToken ? 'Link rotated' : 'Link created' })
    } catch {
      setToast({ msg: 'Action failed', type: 'error' })
    } finally { setWorking(null) }
  }

  const revoke = async (p: Project) => {
    if (confirmRevoke !== p.id) {
      setConfirmRevoke(p.id)
      setTimeout(() => setConfirmRevoke(curr => curr === p.id ? null : curr), 3000)
      return
    }
    setConfirmRevoke(null)
    setWorking(p.id)
    try {
      const res = await fetch(`/api/projects/${p.id}/share-token`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setProjects(prev => prev.map(x => x.id === p.id ? { ...x, shareToken: null } : x))
      setToast({ msg: 'Link revoked' })
    } catch {
      setToast({ msg: 'Revoke failed', type: 'error' })
    } finally { setWorking(null) }
  }

  const copy = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setToast({ msg: 'Link copied' })
    } catch {
      setToast({ msg: 'Copy failed — long-press the link to copy', type: 'error' })
    }
  }

  const share = (url: string, projectName: string) => {
    const subject = `Project update — ${projectName}`
    const body = `Hi,\n\nYou can view live progress on ${projectName} here:\n\n${url}\n\nThis link is private — please don't share it publicly.\n\nKind regards,\nCortexx`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self')
  }

  const withToken = projects.filter(p => p.shareToken)
  const withoutToken = projects.filter(p => !p.shareToken)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Client view</h1>
        <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>
          Public read-only project link · {withToken.length} active link{withToken.length === 1 ? '' : 's'}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : projects.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
          <IcLayers size={32} color="#52749a" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No projects yet</p>
          <Link href="/projects" style={{ display: 'inline-block', marginTop: 16, padding: '10px 22px', borderRadius: 10, background: '#10b981', textDecoration: 'none', color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>Create one</Link>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {withToken.length > 0 && (
            <div>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingLeft: 4 }}>Active links</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {withToken.map(p => {
                  const url = `${origin}/client/${p.shareToken}`
                  return (
                    <div key={p.id} style={{ background: '#152641', borderRadius: 12, padding: '14px', border: '0.5px solid rgba(16,185,129,0.35)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{p.name}</div>
                        {p.clientName && <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>{p.clientName}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2f4e', padding: '8px 10px', borderRadius: 8 }}>
                        <span style={{ flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => copy(url, p.id)} style={btnStyle('#06b6d4')}>Copy link</button>
                        <Link href={url} target="_blank" style={{ ...btnStyle('#52749a'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>Preview</Link>
                        <button onClick={() => share(url, p.name)} style={{ ...btnStyle('#8b5cf6'), display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IcSend size={11} color="#a78bfa" /> Email
                        </button>
                        <button onClick={() => createOrRotate(p)} disabled={working === p.id} style={btnStyle('#f59e0b')}>{working === p.id ? '…' : 'Rotate'}</button>
                        <button onClick={() => revoke(p)} disabled={working === p.id} style={{ ...btnStyle('#ef4444'), marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <IcTrash size={11} color="#ef4444" />
                          {confirmRevoke === p.id ? 'Sure?' : 'Revoke'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {withoutToken.length > 0 && (
            <div>
              <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingLeft: 4 }}>Not shared yet</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {withoutToken.map(p => (
                  <div key={p.id} style={{ background: '#152641', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa' }}>{p.name}</div>
                      {p.clientName && <div style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5', marginTop: 1 }}>{p.clientName}</div>}
                    </div>
                    <button onClick={() => createOrRotate(p)} disabled={working === p.id} style={{ background: '#10b981', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IcCheck size={12} color="#fff" /> {working === p.id ? '…' : 'Create link'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <TabBar />
    </div>
  )
}

const btnStyle = (color: string): React.CSSProperties => ({
  background: `${color}22`, border: `0.5px solid ${color}55`, color, borderRadius: 8, padding: '5px 10px', fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer',
})

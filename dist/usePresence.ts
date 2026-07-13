'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface Identity {
  id: string
  name: string
  avatar?: string | null
  color: string
}

interface Peer {
  identity: Identity
  screen: string
  focus: string | null
  at: number
}

interface PresenceFrame {
  type: 'hello' | 'beat' | 'leave'
  id: string
  identity: Identity
  screen: string
  focus: string | null
  at: number
}

interface PresenceTransport {
  send: (frame: PresenceFrame) => void
  /** Register a frame handler. Optionally return a cleanup function. */
  onFrame?: (cb: (frame: PresenceFrame) => void) => (() => void) | void
}

interface PresenceState {
  me: Identity
  peers: Peer[]
  here: Peer[]
  count: number
}

const CHANNEL = 'cortexx-presence-v1'
const HEARTBEAT_MS = 3000
const STALE_MS = 9000
const SWEEP_MS = 2000

const COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ef4444', '#ec4899', '#14b8a6',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return h
}

function peerId(): string {
  if (typeof sessionStorage === 'undefined') return `p_${Math.random().toString(36).slice(2, 10)}`
  const k = 'cortexx_peer_id'
  let v = sessionStorage.getItem(k)
  if (!v) {
    v = `p_${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(k, v)
  }
  return v
}

function myIdentity(): Identity {
  let name = 'You'
  let avatar: string | null | undefined = null
  try {
    const sess = JSON.parse(localStorage.getItem('cortexx_session') || 'null')
    if (sess?.email) name = sess.email.split('@')[0]
    if (sess?.name) name = sess.name
  } catch { /* ignore */ }
  const id = peerId()
  return { id, name, avatar, color: COLORS[Math.abs(hash(id)) % COLORS.length] }
}

function frame(type: PresenceFrame['type'], me: Identity, screen: string, focus: string | null): PresenceFrame {
  return { type, id: me.id, identity: me, screen, focus, at: Date.now() }
}

/**
 * Track real-time presence for a screen + optional focus target.
 *
 * Same-origin tabs discover each other over BroadcastChannel. Cross-device
 * presence can be added by passing an SSE/WebSocket transport that implements
 * `{ send(frame), onFrame(cb) }`.
 *
 * Example:
 *   const { peers, here, count } = usePresence('activity')
 */
export function usePresence(screen?: string, focus?: string | null, transport?: PresenceTransport): PresenceState {
  const meRef = useRef(myIdentity())
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const screenRef = useRef(screen)
  const focusRef = useRef(focus)

  useEffect(() => {
    screenRef.current = screen
    focusRef.current = focus
  }, [screen, focus])

  const send = useCallback((type: PresenceFrame['type']) => {
    const f = frame(type, meRef.current, screenRef.current ?? 'unknown', focusRef.current ?? null)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(CHANNEL)
        bc.postMessage(f)
        bc.close()
      }
    } catch { /* ignore */ }
    try {
      transport?.send(f)
    } catch { /* ignore */ }
  }, [transport])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(CHANNEL)
    } catch {
      return
    }

    const ingest = (f: PresenceFrame) => {
      if (!f?.id || f.id === meRef.current.id) return
      if (f.type === 'leave') {
        setPeers(prev => {
          if (!prev[f.id]) return prev
          const next = { ...prev }
          delete next[f.id]
          return next
        })
        return
      }
      let wasNew = false
      setPeers(prev => {
        const existing = prev[f.id]
        if (!existing) wasNew = true
        const next = { ...prev }
        next[f.id] = {
          identity: f.identity || existing?.identity || { id: f.id, name: 'Someone', color: '#888' },
          screen: f.screen,
          focus: f.focus,
          at: f.at || Date.now(),
        }
        return next
      })
      // Greet new peers so they learn about us promptly.
      if (wasNew) send('hello')
    }

    const listener = (e: MessageEvent<PresenceFrame>) => {
      if (e.data?.id) ingest(e.data)
    }
    bc.addEventListener('message', listener)

    const hb = setInterval(() => send('beat'), HEARTBEAT_MS)
    const sweep = setInterval(() => {
      const now = Date.now()
      setPeers(prev => {
        let changed = false
        const next = { ...prev }
        for (const id in next) {
          if (now - next[id].at > STALE_MS) {
            delete next[id]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, SWEEP_MS)

    send('hello')

    const onBeforeUnload = () => send('leave')
    const onVisibility = () => {
      // Announce back/away changes as a normal heartbeat.
      send('beat')
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)

    // Optional cross-device relay.
    const offTransport = transport?.onFrame ? transport.onFrame(ingest) : undefined

    return () => {
      clearInterval(hb)
      clearInterval(sweep)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
      send('leave')
      if (typeof offTransport === 'function') offTransport()
      bc.removeEventListener('message', listener)
      bc.close()
    }
  }, [send, transport])

  const allPeers = Object.values(peers).sort((a, b) => b.at - a.at)
  const here = allPeers.filter(p => {
    if (screen && p.screen !== screen) return false
    if (focus !== undefined && focus !== null && String(p.focus) !== String(focus)) return false
    return true
  })

  return { me: meRef.current, peers: allPeers, here, count: allPeers.length }
}

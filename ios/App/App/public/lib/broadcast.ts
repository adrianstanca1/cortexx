'use client'

/**
 * Cross-tab sync via the BroadcastChannel API.
 *
 * The SSE stream already keeps tabs in sync via the server, but there's a
 * 100-300ms round-trip. For UI affordances (e.g. another tab logs out, or
 * just-created data) it's nicer to also broadcast locally so siblings can
 * update instantly without waiting for the server hop.
 *
 * Channel: `cortexx-v1` (bump the version if message shapes change in a
 * breaking way — old tabs will silently ignore unknown types).
 *
 * Server-driven freshness still flows through `/api/events/stream`. This
 * is purely an *additional* signal for same-origin same-browser tabs.
 */

const CHANNEL_NAME = 'cortexx-v1'

export type BroadcastMessage =
  | { type: 'data:invalidate'; scope: 'all' | 'tasks' | 'invoices' | 'projects' | 'team' | 'activity' }
  | { type: 'auth:signout' }

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

/**
 * Broadcast a message to other tabs of the same origin. No-op on Safari
 * private mode / older browsers — fail silently rather than throw.
 */
export function broadcast(msg: BroadcastMessage): void {
  try {
    getChannel()?.postMessage(msg)
  } catch {
    // BroadcastChannel can throw if the channel is closed (page unloading)
    // or in environments where it isn't available. Either way, callers
    // should never have to wrap this in a try/catch.
  }
}

/**
 * Subscribe to broadcasts. Returns an unsubscribe function — call it from
 * the cleanup phase of useEffect.
 */
export function subscribe(handler: (msg: BroadcastMessage) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}

  const listener = (e: MessageEvent<BroadcastMessage>) => {
    if (e.data && typeof e.data.type === 'string') handler(e.data)
  }
  ch.addEventListener('message', listener)
  return () => {
    try { ch.removeEventListener('message', listener) } catch { /* channel may be closed */ }
  }
}

/**
 * Shortcut: broadcast that some data scope changed in this tab so siblings
 * can refetch. Optimistic-update-friendly — call after the API write
 * succeeds, not before.
 */
export function broadcastInvalidate(scope: Exclude<BroadcastMessage, { type: 'auth:signout' }>['scope']): void {
  broadcast({ type: 'data:invalidate', scope })
}

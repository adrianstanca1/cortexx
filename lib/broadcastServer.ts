/**
 * Server-safe BroadcastChannel wrapper for emitting cross-tab messages.
 *
 * Next.js client components use lib/broadcast.ts; this file mirrors the same
 * channel/name/message shape so the server can push local updates to sibling
 * tabs without a round-trip. It no-ops gracefully when BroadcastChannel is
 * unavailable (older Node versions, edge runtimes).
 */

import type { BroadcastMessage } from './broadcast.types'
import type { Activity } from './types'

const CHANNEL_NAME = 'cortexx-v1'

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

export function broadcastServer(msg: BroadcastMessage): void {
  try {
    getChannel()?.postMessage(msg)
  } catch {
    // Fail silently: BroadcastChannel may be unavailable or closed.
  }
}

export function broadcastNewActivity(activity: Activity): void {
  broadcastServer({ type: 'activity:new', activity })
}

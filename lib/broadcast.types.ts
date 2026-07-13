import type { Activity } from './types'

/**
 * Shared message shape for cross-tab BroadcastChannel sync.
 * Kept in a type-only file so both client and server can import it without
 * dragging in the 'use client' runtime module.
 */
export type BroadcastMessage =
  | { type: 'data:invalidate'; scope: 'all' | 'tasks' | 'invoices' | 'projects' | 'team' | 'activity' }
  | { type: 'auth:signout' }
  | { type: 'activity:new'; activity: Activity }

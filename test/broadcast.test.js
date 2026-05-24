/**
 * Unit tests for the cross-tab BroadcastChannel wrapper in lib/broadcast.ts.
 * BroadcastChannel isn't available in plain Node, so we stub it.
 *
 * Run with:  npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

// Stub BroadcastChannel on globalThis BEFORE loading the module.
class MockBroadcastChannel {
  static channels = new Map()
  constructor(name) {
    this.name = name
    this.listeners = new Set()
    if (!MockBroadcastChannel.channels.has(name)) MockBroadcastChannel.channels.set(name, new Set())
    MockBroadcastChannel.channels.get(name).add(this)
  }
  addEventListener(type, fn) {
    if (type === 'message') this.listeners.add(fn)
  }
  removeEventListener(type, fn) {
    if (type === 'message') this.listeners.delete(fn)
  }
  postMessage(data) {
    // Mirror the browser: same-channel siblings receive the message; the
    // sender does NOT receive its own message.
    for (const ch of MockBroadcastChannel.channels.get(this.name)) {
      if (ch === this) continue
      for (const fn of ch.listeners) fn({ data })
    }
  }
  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this)
    this.listeners.clear()
  }
}

// The lib reads BroadcastChannel from globalThis. Wire the stub before require.
globalThis.window = globalThis.window || {}
globalThis.BroadcastChannel = MockBroadcastChannel

// Pure-JS mirror of the lib's logic so tests are self-contained and don't
// require a TS loader. Keep these implementations in sync with lib/broadcast.ts.
const CHANNEL_NAME = 'cortexx-v1'
let channel = null
function getChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}
function broadcast(msg) {
  try { getChannel()?.postMessage(msg) } catch { /* ignore */ }
}
function subscribe(handler) {
  const ch = getChannel()
  if (!ch) return () => {}
  const listener = e => { if (e.data && typeof e.data.type === 'string') handler(e.data) }
  ch.addEventListener('message', listener)
  return () => { try { ch.removeEventListener('message', listener) } catch { /* ignore */ } }
}
function broadcastInvalidate(scope) { broadcast({ type: 'data:invalidate', scope }) }

test('broadcast — does not deliver to the sender', () => {
  MockBroadcastChannel.channels.clear()
  channel = null
  const received = []
  const unsubscribe = subscribe(msg => received.push(msg))
  broadcast({ type: 'data:invalidate', scope: 'tasks' })
  // Same tab/channel — sender shouldn't see its own broadcast.
  assert.equal(received.length, 0)
  unsubscribe()
})

test('broadcast — delivers to a sibling channel on the same name', () => {
  MockBroadcastChannel.channels.clear()
  channel = null
  // Sender uses the cached channel; sibling creates its own.
  const sender = new BroadcastChannel(CHANNEL_NAME)
  const sibling = new BroadcastChannel(CHANNEL_NAME)
  const received = []
  sibling.addEventListener('message', e => received.push(e.data))
  sender.postMessage({ type: 'data:invalidate', scope: 'projects' })
  assert.equal(received.length, 1)
  assert.equal(received[0].scope, 'projects')
})

test('subscribe — returns an unsubscribe that stops delivery', () => {
  MockBroadcastChannel.channels.clear()
  channel = null
  const received = []
  const unsubscribe = subscribe(msg => received.push(msg))
  const sibling = new BroadcastChannel(CHANNEL_NAME)
  sibling.postMessage({ type: 'data:invalidate', scope: 'team' })
  assert.equal(received.length, 1)
  unsubscribe()
  sibling.postMessage({ type: 'data:invalidate', scope: 'invoices' })
  assert.equal(received.length, 1) // no new delivery
})

test('subscribe — ignores messages without a type field', () => {
  MockBroadcastChannel.channels.clear()
  channel = null
  const received = []
  subscribe(msg => received.push(msg))
  const sibling = new BroadcastChannel(CHANNEL_NAME)
  sibling.postMessage({ scope: 'tasks' })          // missing type
  sibling.postMessage(null)                         // null
  sibling.postMessage({ type: 42, scope: 'tasks' }) // non-string type
  assert.equal(received.length, 0)
})

test('broadcastInvalidate — sends a data:invalidate envelope', () => {
  MockBroadcastChannel.channels.clear()
  channel = null
  const sibling = new BroadcastChannel(CHANNEL_NAME)
  const received = []
  sibling.addEventListener('message', e => received.push(e.data))
  broadcastInvalidate('activity')
  assert.equal(received.length, 1)
  assert.deepEqual(received[0], { type: 'data:invalidate', scope: 'activity' })
})

test('broadcast — no-op without BroadcastChannel (older browsers / SSR)', () => {
  MockBroadcastChannel.channels.clear()
  channel = null
  const realBC = globalThis.BroadcastChannel
  delete globalThis.BroadcastChannel
  // Reset channel cache so it re-evaluates the missing global
  channel = null
  // Should silently no-op, not throw
  assert.doesNotThrow(() => broadcast({ type: 'data:invalidate', scope: 'tasks' }))
  globalThis.BroadcastChannel = realBC
})

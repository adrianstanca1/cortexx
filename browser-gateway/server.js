import crypto from 'node:crypto'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import puppeteer from 'puppeteer-core'
import { assertPublicUrl, createEgressProxy } from './network-policy.js'

const PORT = Number(process.env.PORT || 3002)
const INTERNAL_TOKEN = process.env.BROWSER_GATEWAY_INTERNAL_TOKEN
const CHROMIUM = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
const MAX_SESSIONS = Math.max(1, Number(process.env.MAX_BROWSER_SESSIONS || 4))
const IDLE_MS = Math.max(60_000, Number(process.env.BROWSER_SESSION_IDLE_MS || 15 * 60_000))

if (!INTERNAL_TOKEN || INTERNAL_TOKEN.length < 32) {
  console.error('FATAL: BROWSER_GATEWAY_INTERNAL_TOKEN must be set to at least 32 characters')
  process.exit(1)
}

const app = express()
const sessions = new Map()
const pendingSessions = new Map()

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '256kb' }))
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }))

const egressProxy = createEgressProxy()
await new Promise((resolve, reject) => {
  egressProxy.once('error', reject)
  egressProxy.listen(0, '127.0.0.1', resolve)
})
const egressAddress = egressProxy.address()
if (!egressAddress || typeof egressAddress === 'string') throw new Error('Failed to start browser egress proxy')
const egressProxyUrl = `http://127.0.0.1:${egressAddress.port}`

function safeEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''))
  const b = Buffer.from(String(expected || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function requireInternal(req, res, next) {
  if (!safeEqual(req.get('x-cortexx-gateway-token'), INTERNAL_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const actorId = String(req.get('x-cortexx-actor-id') || '')
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(actorId)) {
    return res.status(400).json({ error: 'Invalid actor' })
  }
  req.actorId = actorId
  next()
}

function validSessionId(value) {
  return /^[A-Za-z0-9_-]{8,160}$/.test(String(value || ''))
}

async function installRequestPolicy(page) {
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = request.url()
    if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
      void request.continue()
      return
    }
    void assertPublicUrl(url)
      .then(() => request.continue())
      .catch(() => request.abort('blockedbyclient'))
  })
}

async function createSession(id, owner) {
  const current = sessions.get(id)
  if (current) {
    if (current.owner !== owner) throw new Error('Session unavailable')
    current.lastUsed = Date.now()
    return current
  }

  const pending = pendingSessions.get(id)
  if (pending) {
    if (pending.owner !== owner) throw new Error('Session unavailable')
    return pending.promise
  }

  if (sessions.size + pendingSessions.size >= MAX_SESSIONS) throw new Error('Browser session limit reached')

  const promise = (async () => {
    let browser
    try {
      browser = await puppeteer.launch({
        executablePath: CHROMIUM,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          `--proxy-server=${egressProxyUrl}`,
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        ],
      })
      const page = await browser.newPage()
      await page.setUserAgent('Cortexx Browser Gateway/1.0')
      await installRequestPolicy(page)
      const session = { id, owner, browser, page, createdAt: Date.now(), lastUsed: Date.now() }
      sessions.set(id, session)
      return session
    } catch (error) {
      await browser?.close().catch(() => {})
      throw error
    } finally {
      pendingSessions.delete(id)
    }
  })()

  pendingSessions.set(id, { owner, promise })
  return promise
}

function ownedSession(id, owner) {
  const session = sessions.get(id)
  if (!session || session.owner !== owner) return null
  session.lastUsed = Date.now()
  return session
}

async function closeSession(session) {
  sessions.delete(session.id)
  await session.browser.close().catch(() => {})
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeSessions: sessions.size, pendingSessions: pendingSessions.size })
})

app.use('/v1', requireInternal)

app.get('/v1/sessions', (req, res) => {
  const owned = [...sessions.values()]
    .filter(session => session.owner === req.actorId)
    .map(session => ({
      id: session.id,
      createdAt: new Date(session.createdAt).toISOString(),
      lastUsedAt: new Date(session.lastUsed).toISOString(),
    }))
  res.json({ sessions: owned })
})

app.post('/v1/sessions', async (req, res) => {
  const id = String(req.body?.id || '')
  if (!validSessionId(id)) return res.status(400).json({ error: 'Invalid session id' })
  try {
    const session = await createSession(id, req.actorId)
    res.status(201).json({ id: session.id, status: 'ready' })
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : 'Session start failed' })
  }
})

app.delete('/v1/sessions/:id', async (req, res) => {
  const session = ownedSession(req.params.id, req.actorId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  await closeSession(session)
  res.json({ stopped: true })
})

app.post('/v1/sessions/:id/actions', async (req, res) => {
  const session = ownedSession(req.params.id, req.actorId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const action = String(req.body?.action || '')
  const allowed = new Set(['navigate', 'click', 'input', 'screenshot', 'evaluate', 'reload'])
  if (!allowed.has(action)) return res.status(400).json({ error: 'Unsupported action' })

  try {
    const page = session.page
    let result = null
    if (action === 'navigate') {
      const url = await assertPublicUrl(req.body?.url)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      result = { url: page.url(), title: await page.title() }
    } else if (action === 'click') {
      const selector = String(req.body?.selector || '')
      if (!selector || selector.length > 500) throw new Error('Invalid selector')
      await page.click(selector)
      result = { url: page.url() }
    } else if (action === 'input') {
      const selector = String(req.body?.selector || '')
      const text = String(req.body?.text ?? '')
      if (!selector || selector.length > 500 || text.length > 10_000) throw new Error('Invalid input')
      await page.type(selector, text)
      result = { ok: true }
    } else if (action === 'screenshot') {
      const buffer = await page.screenshot({ type: 'png', fullPage: Boolean(req.body?.fullPage) })
      result = { mimeType: 'image/png', base64: Buffer.from(buffer).toString('base64') }
    } else if (action === 'evaluate') {
      const code = String(req.body?.code || '')
      if (!code || code.length > 20_000) throw new Error('Invalid evaluation')
      result = { value: await page.evaluate(source => (0, eval)(source), code) }
    } else if (action === 'reload') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
      result = { url: page.url(), title: await page.title() }
    }
    res.json({ action, result })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Browser action failed' })
  }
})

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS
  for (const session of sessions.values()) {
    if (session.lastUsed < cutoff) void closeSession(session)
  }
}, 60_000).unref()

async function shutdown() {
  await Promise.all([...sessions.values()].map(closeSession))
  await new Promise(resolve => egressProxy.close(resolve))
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cortexx browser gateway listening on :${PORT}`)
})

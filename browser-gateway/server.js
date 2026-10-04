import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import Redis from 'ioredis'
import puppeteer from 'puppeteer-core'

const PORT = Number(process.env.PORT || 3002)
const INTERNAL_TOKEN = process.env.BROWSER_GATEWAY_INTERNAL_TOKEN
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379'
const CHROMIUM = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
const MAX_SESSIONS = Math.max(1, Number(process.env.MAX_BROWSER_SESSIONS || 4))
const IDLE_MS = Math.max(60_000, Number(process.env.BROWSER_SESSION_IDLE_MS || 15 * 60_000))
const EXTRA_PRIVATE_HOSTS = new Set(
  String(process.env.BROWSER_GATEWAY_ALLOWED_PRIVATE_HOSTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
)

if (!INTERNAL_TOKEN || INTERNAL_TOKEN.length < 32) {
  console.error('FATAL: BROWSER_GATEWAY_INTERNAL_TOKEN must be set to at least 32 characters')
  process.exit(1)
}

const app = express()
const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
})
const sessions = new Map()

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '256kb' }))
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }))

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

function isPrivateIp(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true
  const parts = h.split('.')
  if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part))) return false
  const octets = parts.map(Number)
  if (octets.some(n => n < 0 || n > 255)) return false
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

function isPrivateName(host) {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (EXTRA_PRIVATE_HOSTS.has(h)) return false
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    ['app', 'db', 'redis', 'ollama', 'browser-gateway'].includes(h) ||
    isPrivateIp(h)
  )
}

async function assertPublicUrl(raw) {
  let target
  try {
    target = new URL(String(raw || ''))
  } catch {
    throw new Error('Invalid URL')
  }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only http(s) navigation is allowed')
  if (isPrivateName(target.hostname)) throw new Error('Private-network navigation is blocked')
  const addresses = await dns.lookup(target.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
    throw new Error('Private-network navigation is blocked')
  }
  return target.toString()
}

async function createSession(id, owner) {
  if (sessions.size >= MAX_SESSIONS) throw new Error('Browser session limit reached')
  if (sessions.has(id)) {
    const current = sessions.get(id)
    if (current.owner !== owner) throw new Error('Session unavailable')
    current.lastUsed = Date.now()
    return current
  }
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setUserAgent('Cortexx Browser Gateway/1.0')
  const session = { id, owner, browser, page, createdAt: Date.now(), lastUsed: Date.now() }
  sessions.set(id, session)
  return session
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

app.get('/health', async (_req, res) => {
  let redisOk = false
  try {
    if (redis.status === 'wait') await redis.connect()
    redisOk = (await redis.ping()) === 'PONG'
  } catch {
    redisOk = false
  }
  res.status(redisOk ? 200 : 503).json({
    status: redisOk ? 'ok' : 'degraded',
    redis: redisOk,
    activeSessions: sessions.size,
  })
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
  await redis.quit().catch(() => {})
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cortexx browser gateway listening on :${PORT}`)
})

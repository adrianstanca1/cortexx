import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const PLATFORM_ROLES = new Set(['super_admin', 'platform_admin'])
const SESSION_ID = /^[A-Za-z0-9_-]{8,160}$/
const ACTIONS = new Set(['navigate', 'click', 'input', 'screenshot', 'evaluate', 'reload'])

async function platformActor() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const user = session.user as { id?: string; role?: string }
  if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ROLES.has(user.role || '')) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 })
  return { session, userId: user.id }
}

function gatewayConfig() {
  const url = (process.env.BROWSER_GATEWAY_URL || 'http://browser-gateway:3002').replace(/\/$/, '')
  const token = process.env.BROWSER_GATEWAY_INTERNAL_TOKEN || ''
  if (token.length < 32) throw new Error('Browser gateway is not configured')
  return { url, token }
}

async function gatewayFetch(actorId: string, path: string, init?: RequestInit) {
  const { url, token } = gatewayConfig()
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-cortexx-gateway-token': token,
      'x-cortexx-actor-id': actorId,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(35_000),
  })
}

async function relay(response: Response) {
  const text = await response.text()
  let data: unknown = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { error: 'Invalid gateway response' } }
  return NextResponse.json(data, { status: response.status })
}

export async function GET() {
  const actor = await platformActor()
  if (actor instanceof NextResponse) return actor
  try {
    return relay(await gatewayFetch(actor.userId, '/v1/sessions'))
  } catch (error) {
    reportError(error, { context: 'platform.browser.get' })
    return NextResponse.json({ error: 'Browser gateway unavailable' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const actor = await platformActor()
  if (actor instanceof NextResponse) return actor

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const operation = String(body.operation || '')
  try {
    if (operation === 'start') {
      const id = `${actor.userId.replace(/[^A-Za-z0-9_-]/g, '_')}_${randomUUID().replaceAll('-', '')}`
      const response = await gatewayFetch(actor.userId, '/v1/sessions', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      if (response.ok) auditLog({
        userId: actor.userId,
        action: 'platform.browser.start',
        resourceType: 'BrowserSession',
        resourceId: id,
        metadata: {},
        ...requestMeta(req),
      })
      return relay(response)
    }

    const sessionId = String(body.sessionId || '')
    if (!SESSION_ID.test(sessionId)) return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })

    if (operation === 'stop') {
      const response = await gatewayFetch(actor.userId, `/v1/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
      if (response.ok) auditLog({
        userId: actor.userId,
        action: 'platform.browser.stop',
        resourceType: 'BrowserSession',
        resourceId: sessionId,
        metadata: {},
        ...requestMeta(req),
      })
      return relay(response)
    }

    if (operation === 'action') {
      const action = String(body.action || '')
      if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
      const payload = {
        action,
        ...(action === 'navigate' ? { url: body.url } : {}),
        ...(action === 'click' ? { selector: body.selector } : {}),
        ...(action === 'input' ? { selector: body.selector, text: body.text } : {}),
        ...(action === 'evaluate' ? { code: body.code } : {}),
        ...(action === 'screenshot' ? { fullPage: Boolean(body.fullPage) } : {}),
      }
      const response = await gatewayFetch(actor.userId, `/v1/sessions/${encodeURIComponent(sessionId)}/actions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (response.ok) auditLog({
        userId: actor.userId,
        action: 'platform.browser.action',
        resourceType: 'BrowserSession',
        resourceId: sessionId,
        metadata: { action },
        ...requestMeta(req),
      })
      return relay(response)
    }

    return NextResponse.json({ error: 'operation must be start, action or stop' }, { status: 400 })
  } catch (error) {
    reportError(error, { context: 'platform.browser.post', operation })
    return NextResponse.json({ error: 'Browser gateway unavailable' }, { status: 503 })
  }
}

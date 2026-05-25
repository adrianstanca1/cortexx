import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth, type SessionOrgMembership } from '@/lib/auth'
import { setOrgContext } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Global cap on concurrent SSE clients. Each client polls every 5s, so 100
// clients = 1200 queries/min on top of regular API traffic.
const MAX_CONCURRENT = 100
let active = 0

const ACTIVE_ORG_COOKIE = 'cortexx_active_org'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (active >= MAX_CONCURRENT) {
    return new Response('Too many concurrent streams; try again shortly', { status: 503 })
  }
  active++

  // Thread the active org into the AsyncLocalStorage so the Activity
  // poll below auto-scopes to the user's workspace.
  const orgs = ((session.user as { organizations?: SessionOrgMembership[] }).organizations) || []
  if (orgs.length > 0) {
    const userId = (session.user as { id?: string }).id || null
    let activeOrg = orgs[0]
    try {
      const store = await cookies()
      const cookieValue = store.get(ACTIVE_ORG_COOKIE)?.value
      if (cookieValue) {
        const match = orgs.find(o => o.id === cookieValue)
        if (match) activeOrg = match
      }
    } catch { /* fine — Next still calling this server-side without a request store */ }
    setOrgContext({ organizationId: activeOrg.id, userId, role: activeOrg.role })
  }

  const encoder = new TextEncoder()
  let cursor = new Date()
  let intervalId: ReturnType<typeof setInterval> | null = null
  let keepAliveId: ReturnType<typeof setInterval> | null = null
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    active = Math.max(0, active - 1)
    if (intervalId) clearInterval(intervalId)
    if (keepAliveId) clearInterval(keepAliveId)
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          cleanup()
          try { controller.close() } catch {}
        }
      }

      send('ready', { cursor: cursor.toISOString() })

      const poll = async () => {
        if (closed) return
        try {
          const newActivities = await prisma.activity.findMany({
            where: { createdAt: { gt: cursor } },
            include: { project: true },
            orderBy: { createdAt: 'asc' },
            take: 50,
          })
          if (newActivities.length > 0) {
            cursor = newActivities[newActivities.length - 1].createdAt
            send('activity', newActivities)
          }
        } catch (e) {
          send('error', { message: e instanceof Error ? e.message : 'poll failed' })
        }
      }

      intervalId = setInterval(poll, 5000)
      keepAliveId = setInterval(() => {
        if (closed) return
        try { controller.enqueue(encoder.encode(': keep-alive\n\n')) } catch { cleanup() }
      }, 25000)

      req.signal.addEventListener('abort', () => {
        cleanup()
        try { controller.close() } catch {}
      })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

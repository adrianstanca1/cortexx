import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Global cap on concurrent SSE clients. Each client polls every 5s, so 100
// clients = 1200 queries/min on top of regular API traffic.
const MAX_CONCURRENT = 100
let active = 0

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (active >= MAX_CONCURRENT) {
    return new Response('Too many concurrent streams; try again shortly', { status: 503 })
  }
  active++

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

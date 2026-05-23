import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  let cursor = new Date()
  let intervalId: ReturnType<typeof setInterval> | null = null
  let keepAliveId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // controller closed
        }
      }

      send('ready', { cursor: cursor.toISOString() })

      const poll = async () => {
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
      // Keep-alive ping every 25s (most proxies disconnect after 30s idle)
      keepAliveId = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keep-alive\n\n')) } catch {}
      }, 25000)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        if (intervalId) clearInterval(intervalId)
        if (keepAliveId) clearInterval(keepAliveId)
        try { controller.close() } catch {}
      })
    },
    cancel() {
      if (intervalId) clearInterval(intervalId)
      if (keepAliveId) clearInterval(keepAliveId)
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

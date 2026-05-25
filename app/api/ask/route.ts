import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { rateLimit } from '@/lib/rateLimit'
import {
  chat,
  buildSystemPrompt,
  isLlmUnavailable,
  isLlmEmpty,
  LLM_CONFIG,
  type ChatMessage,
} from '@/lib/llm'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LEN = 4000
const MAX_HISTORY_LEN = 4000 // per history entry — matches the live message cap
const MAX_HISTORY = 20
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({
    model: LLM_CONFIG.model,
    baseUrl: LLM_CONFIG.baseUrl,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  const userId = (auth.user as { id?: string } | undefined)?.id || auth.user?.email || 'anon'
  const rl = await rateLimit(`ask:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`, code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  try {
    const body = await req.json()
    if (typeof body?.message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    const message = body.message.trim()
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LEN} chars)` }, { status: 400 })
    }

    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history
          .filter((m: unknown): m is ChatMessage => {
            if (!m || typeof m !== 'object') return false
            const r = (m as { role?: unknown }).role
            const c = (m as { content?: unknown }).content
            return (r === 'user' || r === 'assistant') && typeof c === 'string' && c.trim().length > 0
          })
          .map((m: ChatMessage): ChatMessage => ({
            role: m.role,
            content: m.content.length > MAX_HISTORY_LEN ? m.content.slice(0, MAX_HISTORY_LEN) : m.content,
          }))
          .slice(-MAX_HISTORY)
      : []

    // Pull lightweight workspace context — tolerant of any failures, but
    // log so a real DB outage doesn't silently degrade every answer to "0".
    const [activeProjects, openSnags, pendingTS, recentActivity, projectNames] = await Promise.all([
      prisma.project.count({ where: { status: 'active', archivedAt: null } }).catch(err => {
        console.error('[ask] project.count failed:', err)
        return 0
      }),
      prisma.snag.count({ where: { status: { not: 'closed' } } }).catch(err => {
        console.error('[ask] snag.count failed:', err)
        return 0
      }),
      prisma.timeEntry.count({ where: { approved: false } }).catch(err => {
        console.error('[ask] timeEntry.count failed:', err)
        return 0
      }),
      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { actorName: true, action: true },
      }).then(rows => rows.map(r => `${r.actorName} ${r.action}`)).catch(err => {
        console.error('[ask] activity.findMany failed:', err)
        return [] as string[]
      }),
      prisma.project.findMany({
        where: { status: 'active', archivedAt: null },
        select: { name: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }).then(rows => rows.map(r => r.name)).catch(err => {
        console.error('[ask] project.findMany failed:', err)
        return [] as string[]
      }),
    ])

    const systemPrompt = buildSystemPrompt({
      activeProjectCount: activeProjects,
      openSnagCount: openSnags,
      pendingTimesheetCount: pendingTS,
      recentActivity,
      projectNames,
    })

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ]

    const response = await chat(messages)
    return NextResponse.json({
      content: response.content,
      model: response.model,
      tokens: response.evalCount,
      durationMs: response.totalDurationMs,
    })
  } catch (error) {
    if (isLlmUnavailable(error)) {
      return NextResponse.json({ error: error.message, code: 'LLM_UNAVAILABLE' }, { status: 503 })
    }
    if (isLlmEmpty(error)) {
      return NextResponse.json({ error: error.message, code: 'LLM_EMPTY' }, { status: 502 })
    }
    console.error('[ask] unexpected error:', error)
    return NextResponse.json({ error: 'Failed to process your message' }, { status: 500 })
  }
}

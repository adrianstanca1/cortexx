import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { chat, buildSystemPrompt, LlmUnavailableError, LLM_CONFIG, type ChatMessage } from '@/lib/llm'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LEN = 4000
const MAX_HISTORY = 20

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
  try {
    const body = await req.json()
    const message = String(body.message || '').trim()
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
          .slice(-MAX_HISTORY)
      : []

    // Pull lightweight workspace context — tolerant of any failures
    const [activeProjects, openSnags, pendingTS, recentActivity, projectNames] = await Promise.all([
      prisma.project.count({ where: { status: 'active', archivedAt: null } }).catch(() => 0),
      prisma.snag.count({ where: { status: { not: 'closed' } } }).catch(() => 0),
      prisma.timeEntry.count({ where: { approved: false } }).catch(() => 0),
      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { actorName: true, action: true },
      }).then(rows => rows.map(r => `${r.actorName} ${r.action}`)).catch(() => [] as string[]),
      prisma.project.findMany({
        where: { status: 'active', archivedAt: null },
        select: { name: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }).then(rows => rows.map(r => r.name)).catch(() => [] as string[]),
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
    if (error instanceof LlmUnavailableError) {
      return NextResponse.json({ error: error.message, code: 'LLM_UNAVAILABLE' }, { status: 503 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to process your message' }, { status: 500 })
  }
}

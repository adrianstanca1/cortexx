import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { rateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { loadProjectKnowledge, buildKnowledgePrompt, citedKnowledgeSources } from '@/lib/project-knowledge'
import {
  chat,
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
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.orgId) return NextResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })
  return NextResponse.json({
    model: LLM_CONFIG.model,
    baseUrl: LLM_CONFIG.baseUrl,
    orgId: auth.orgId,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.orgId) return NextResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })
  const __limited = await enforceRateLimit(req, 'write', auth.userId)
  if (__limited) return __limited

  const userId = auth.userId
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

    const history: ChatMessage[] = body.contextOrgId === auth.orgId && Array.isArray(body.history)
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

    const knowledge = await loadProjectKnowledge(auth)
    const systemPrompt = buildKnowledgePrompt(knowledge)

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ]

    const response = await chat(messages)
    const citations = citedKnowledgeSources(response.content, knowledge.sources)

    await prisma.aiHistory.create({
      data: {
        organizationId: auth.orgId,
        userId: auth.userId,
        userMsg: message,
        aiReply: response.content,
      },
    }).catch(err => {
      console.error('[ask] aiHistory.create failed:', err)
    })

    auditLog({ organizationId: auth.orgId, userId: auth.userId, action: 'ai.answer', resourceType: 'ProjectKnowledge', resourceId: auth.orgId, metadata: { model: response.model, sources: citations.map(source => ({ id: source.id, href: source.href })), observedAt: knowledge.observedAt, mode: 'read_only' }, ...requestMeta(req) })

    return NextResponse.json({
      content: response.content,
      model: response.model,
      tokens: response.evalCount,
      durationMs: response.totalDurationMs,
      citations,
      contextOrgId: auth.orgId,
      evidenceObservedAt: knowledge.observedAt,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'KnowledgeAccessError') {
      return NextResponse.json({ error: error.message, code: 'KNOWLEDGE_FORBIDDEN' }, { status: 403 })
    }
    if (error instanceof Error && error.name === 'KnowledgeUnavailableError') {
      return NextResponse.json({ error: error.message, code: 'KNOWLEDGE_UNAVAILABLE' }, { status: 503 })
    }
    if (error instanceof Error && error.name === 'KnowledgeCitationError') {
      return NextResponse.json({ error: error.message, code: 'LLM_INVALID_CITATIONS' }, { status: 502 })
    }
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

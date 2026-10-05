import { NextRequest, NextResponse } from 'next/server'

import { requireOrg } from '@/lib/requireAuth'
import { enforceRateLimit, rateLimit } from '@/lib/rateLimit'
import { BUNDLES, BUNDLE_SLUGS } from '@/lib/bundles'
import { chat, isLlmUnavailable, isLlmEmpty, sanitizePromptValue } from '@/lib/llm'
import { canManage } from '@/lib/rbac'
import { auditLog, requestMeta } from '@/lib/audit'
import { loadProjectKnowledge, buildKnowledgePrompt, citedKnowledgeSources } from '@/lib/project-knowledge'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LEN = 4000
const MAX_HISTORY_LEN = 4000
const MAX_HISTORY = 20
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

function extractSlug(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split('/')
  return parts[parts.length - 2] || null
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.orgId) return NextResponse.json({ error: 'No organization', code: 'NO_ORG' }, { status: 403 })
  const __limited = await enforceRateLimit(req, 'write', auth.userId)
  if (__limited) return __limited

  const slug = extractSlug(req)
  if (!slug || !BUNDLE_SLUGS.includes(slug)) {
    return NextResponse.json({ error: 'Unknown bundle' }, { status: 400 })
  }
  const bundle = BUNDLES.find(b => b.slug === slug)!
  if (slug === 'commercial' && !canManage(auth.role || '')) {
    return NextResponse.json({ error: 'Financial admin permission required' }, { status: 403 })
  }

  const userId = auth.userId
  const rl = await rateLimit(`bundle:${slug}:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`, code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
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

    const history = body.contextOrgId === auth.orgId && Array.isArray(body.history)
      ? body.history
          .filter((m: unknown) => {
            if (!m || typeof m !== 'object') return false
            const r = (m as { role?: unknown }).role
            const c = (m as { content?: unknown }).content
            return (r === 'user' || r === 'assistant') && typeof c === 'string' && c.trim().length > 0
          })
          .map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content.length > MAX_HISTORY_LEN ? m.content.slice(0, MAX_HISTORY_LEN) : m.content,
          }))
          .slice(-MAX_HISTORY)
      : []

    const knowledge = await loadProjectKnowledge(auth, true)
    const basePrompt = buildKnowledgePrompt(knowledge)

    const bundleContext = [
      '',
      `You are currently serving the **${bundle.title}**.`,
      bundle.subtitle,
      '',
      'Useful pages in this bundle:',
      ...bundle.pages.map(p => `- ${p.label}: ${p.href}`),
      '',
      'Bundle-specific instructions:',
      bundle.prompt,
    ].join('\n')

    const messages = [
      { role: 'system', content: `${basePrompt}\n${bundleContext}` },
      ...history,
      { role: 'user', content: sanitizePromptValue(message, 4000) },
    ]

    const response = await chat(messages)
    const citations = citedKnowledgeSources(response.content, knowledge.sources)
    auditLog({ organizationId: auth.orgId, userId: auth.userId, action: 'ai.answer', resourceType: 'ProjectKnowledge', resourceId: auth.orgId, metadata: { bundle: bundle.slug, model: response.model, sources: citations.map(source => ({ id: source.id, href: source.href })), observedAt: knowledge.observedAt, mode: 'read_only' }, ...requestMeta(req) })
    return NextResponse.json({
      content: response.content,
      model: response.model,
      tokens: response.evalCount,
      durationMs: response.totalDurationMs,
      bundle: bundle.slug,
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
    if (isLlmUnavailable(error)) return NextResponse.json({ error: error.message, code: 'LLM_UNAVAILABLE' }, { status: 503 })
    if (isLlmEmpty(error)) return NextResponse.json({ error: error.message, code: 'LLM_EMPTY' }, { status: 502 })
    console.error(`[bundles/${slug}/ask] error:`, error)
    return NextResponse.json({ error: 'Failed to process your message' }, { status: 500 })
  }
}

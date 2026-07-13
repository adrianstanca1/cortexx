import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit, rateLimit } from '@/lib/rateLimit'
import { BUNDLES, BUNDLE_SLUGS } from '@/lib/bundles'
import { chat, buildSystemPrompt, sanitizePromptValue } from '@/lib/llm'

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
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  const slug = extractSlug(req)
  if (!slug || !BUNDLE_SLUGS.includes(slug)) {
    return NextResponse.json({ error: 'Unknown bundle' }, { status: 400 })
  }
  const bundle = BUNDLES.find(b => b.slug === slug)!

  const userId = (auth.user as { id?: string } | undefined)?.id || auth.user?.email || 'anon'
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

    const history = Array.isArray(body.history)
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

    // Pull lightweight workspace context relevant to every bundle.
    const [activeProjects, openSnags, pendingTS, openRfis, openRisks, failedInspections, overdueInvoices] = await Promise.all([
      prisma.project.count({ where: { status: 'active', archivedAt: null } }).catch(() => 0),
      prisma.snag.count({ where: { status: { not: 'closed' } } }).catch(() => 0),
      prisma.timeEntry.count({ where: { approved: false } }).catch(() => 0),
      prisma.rfi.count({ where: { status: 'open' } }).catch(() => 0),
      prisma.risk.count({ where: { status: 'open' } }).catch(() => 0),
      prisma.inspection.count({ where: { status: 'failed' } }).catch(() => 0),
      prisma.invoice.count({ where: { status: 'overdue' } }).catch(() => 0),
    ])

    const projectNames = await prisma.project.findMany({
      where: { status: 'active', archivedAt: null },
      select: { name: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }).then(rows => rows.map(r => r.name)).catch(() => [])

    const basePrompt = buildSystemPrompt({
      activeProjectCount: activeProjects,
      openSnagCount: openSnags,
      pendingTimesheetCount: pendingTS,
      recentActivity: [],
      projectNames,
    })

    const bundleContext = [
      '',
      `You are currently serving the **${bundle.title}**.`,
      bundle.subtitle,
      '',
      'Relevant live workspace summary:',
      `- Active projects: ${activeProjects}`,
      `- Open snags: ${openSnags}`,
      `- Pending timesheets: ${pendingTS}`,
      `- Open RFIs: ${openRfis}`,
      `- Open risks: ${openRisks}`,
      `- Failed inspections: ${failedInspections}`,
      `- Overdue invoices: ${overdueInvoices}`,
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
    return NextResponse.json({
      content: response.content,
      model: response.model,
      tokens: response.evalCount,
      durationMs: response.totalDurationMs,
      bundle: bundle.slug,
    })
  } catch (error) {
    console.error(`[bundles/${slug}/ask] error:`, error)
    return NextResponse.json({ error: 'Failed to process your message' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { chat, isLlmUnavailable, isLlmEmpty, LLM_CONFIG } from '@/lib/llm'

export const dynamic = 'force-dynamic'

const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'moondream'
const ANALYSIS_TIMEOUT_MS = 120_000

// Categories sized to match the construction-phase vocabulary in the rest
// of the app (no new vocabulary the user has to learn).
const CATEGORIES = [
  'foundation', 'groundwork', 'steel', 'concrete', 'brickwork', 'roofing',
  'electrical', 'plumbing', 'plastering', 'flooring', 'joinery', 'tiling',
  'painting', 'glazing', 'landscaping', 'snagging', 'safety', 'progress',
  'site_setup', 'other',
] as const
type Category = typeof CATEGORIES[number]

interface TagResult {
  tags: string[]
  category: Category
  summary: string
}

// Rate limit — vision inference is expensive. Same cap as snag analyze.
const rateLimits = new Map<string, number[]>()
function checkRateLimit(userKey: string, max = 3, windowMs = 60_000): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const arr = (rateLimits.get(userKey) || []).filter(t => now - t < windowMs)
  if (arr.length >= max) {
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) }
  }
  arr.push(now)
  rateLimits.set(userKey, arr)
  return { ok: true }
}

function parseTagResponse(raw: string): TagResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Model did not return a JSON object')
  }
  const obj = parsed as Record<string, unknown>
  const rawTags = Array.isArray(obj.tags) ? obj.tags : []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const t of rawTags) {
    if (typeof t !== 'string') continue
    const trimmed = t.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40)
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    tags.push(trimmed)
    if (tags.length >= 8) break
  }
  let category: Category = 'other'
  if (typeof obj.category === 'string') {
    const c = obj.category.trim().toLowerCase() as Category
    if ((CATEGORIES as readonly string[]).includes(c)) category = c
  }
  const summary = typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 280) : 'No summary provided.'
  return { tags, category, summary }
}

export async function POST(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const userId = (auth.user as { id?: string } | undefined)?.id || 'anon'
  const rl = checkRateLimit(userId)
  if (!rl.ok) {
    return new NextResponse(JSON.stringify({ error: `Too many tag requests. Try again in ${rl.retryAfter}s.` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    })
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!doc.url || !doc.mimeType?.startsWith('image/')) {
    return NextResponse.json({ error: 'Document is not an image.', code: 'NOT_IMAGE' }, { status: 400 })
  }
  if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(doc.url)) {
    return NextResponse.json({ error: 'Invalid document URL', code: 'INVALID_URL' }, { status: 400 })
  }

  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  const filename = doc.url.replace(/^\/api\/uploads\//, '')
  const photoPath = join(uploadDir, filename)
  if (!existsSync(photoPath)) {
    return NextResponse.json({ error: 'Image file not found on server', code: 'FILE_MISSING' }, { status: 404 })
  }

  let imageBase64: string
  try {
    const bytes = await readFile(photoPath)
    if (bytes.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large for tagging (max 8 MB)', code: 'IMAGE_TOO_LARGE' }, { status: 413 })
    }
    imageBase64 = bytes.toString('base64')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to read image', code: 'READ_FAILED' }, { status: 500 })
  }

  const system = [
    'You are a UK construction site-photo classifier.',
    'Identify what construction work or stage the photo depicts. Be specific and grounded — only describe what you can clearly see.',
    'Output STRICT JSON only with this shape:',
    `{ "tags": string[] (1-8 short lowercase tokens, e.g. "rebar", "concrete_pour", "scaffold"), "category": one of ${CATEGORIES.map(c => `"${c}"`).join('/')}, "summary": string (max 280 chars) }`,
    'Tags should be short tradespeak nouns or noun-phrases — what a foreman would write on the back of a photo.',
    'Pick the most-specific category that fits. Use "progress" for general work-in-progress shots, "snagging" for defect/punch-list photos, "other" only if nothing else fits.',
    'Do not invent details that aren\'t in the photo.',
  ].join('\n')

  const userPrompt = [
    `Filename: "${doc.name}"`,
    doc.project?.name ? `Project: "${doc.project.name}"` : '',
    'Classify the attached photo and return JSON.',
  ].filter(Boolean).join('\n')

  try {
    const res = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt, images: [imageBase64] },
      ],
      { json: true, model: VISION_MODEL, timeoutMs: ANALYSIS_TIMEOUT_MS }
    )
    const tagged = parseTagResponse(res.content)

    prisma.activity.create({
      data: {
        projectId: doc.projectId,
        actorName: actorName(auth),
        actorType: 'ai',
        action: `tagged photo: ${doc.name}`,
        detail: `${tagged.category} · ${tagged.tags.slice(0, 3).join(', ')}`,
        iconType: 'spark',
      },
    }).catch(() => {})

    return NextResponse.json({
      ...tagged,
      model: res.model,
      latencyMs: res.totalDurationMs,
    })
  } catch (err) {
    if (isLlmUnavailable(err)) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Vision model unavailable', code: 'VISION_UNAVAILABLE', config: { model: VISION_MODEL, baseUrl: LLM_CONFIG.baseUrl } },
        { status: 503 }
      )
    }
    if (isLlmEmpty(err)) {
      return NextResponse.json({ error: 'Vision model returned an empty response.', code: 'VISION_EMPTY' }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to tag photo', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }
}

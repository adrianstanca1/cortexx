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
const COMPARE_TIMEOUT_MS = 180_000 // two-image inference is slower than one
const MAX_BYTES = 8 * 1024 * 1024

const PROGRESS_VALUES = ['progressed', 'reversed', 'stalled', 'unrelated'] as const
type Progress = typeof PROGRESS_VALUES[number]

interface CompareResult {
  summary: string
  changes: string[]
  progress: Progress
  notes?: string
}

const rateLimits = new Map<string, number[]>()
function checkRateLimit(userKey: string, max = 2, windowMs = 60_000): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const arr = (rateLimits.get(userKey) || []).filter(t => now - t < windowMs)
  if (arr.length >= max) {
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) }
  }
  arr.push(now)
  rateLimits.set(userKey, arr)
  return { ok: true }
}

function parseCompareResponse(raw: string): CompareResult {
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
  const summary = typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 400) : 'No summary provided.'
  const rawChanges = Array.isArray(obj.changes) ? obj.changes : []
  const changes: string[] = []
  for (const c of rawChanges) {
    if (typeof c !== 'string') continue
    const trimmed = c.trim().slice(0, 280)
    if (!trimmed) continue
    changes.push(trimmed)
    if (changes.length >= 10) break
  }
  let progress: Progress = 'unrelated'
  if (typeof obj.progress === 'string') {
    const p = obj.progress.trim().toLowerCase() as Progress
    if ((PROGRESS_VALUES as readonly string[]).includes(p)) progress = p
  }
  const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 280) : undefined
  return { summary, changes, progress, notes }
}

async function loadImageBase64(doc: { url: string | null; mimeType: string | null }): Promise<string | { error: string; code: string; status: number }> {
  if (!doc.url || !doc.mimeType?.startsWith('image/')) {
    return { error: 'Document is not an image.', code: 'NOT_IMAGE', status: 400 }
  }
  if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(doc.url)) {
    return { error: 'Invalid document URL', code: 'INVALID_URL', status: 400 }
  }
  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  const filename = doc.url.replace(/^\/api\/uploads\//, '')
  const path = join(uploadDir, filename)
  if (!existsSync(path)) {
    return { error: 'Image file not found on server', code: 'FILE_MISSING', status: 404 }
  }
  const bytes = await readFile(path)
  if (bytes.length > MAX_BYTES) {
    return { error: `Image too large for comparison (max ${MAX_BYTES / 1024 / 1024} MB)`, code: 'IMAGE_TOO_LARGE', status: 413 }
  }
  return bytes.toString('base64')
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  const userId = (auth.user as { id?: string } | undefined)?.id || 'anon'
  const rl = checkRateLimit(userId)
  if (!rl.ok) {
    return new NextResponse(JSON.stringify({ error: `Too many comparisons. Try again in ${rl.retryAfter}s.` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    })
  }

  let body: { aId?: unknown; bId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const aId = String(body.aId || '').trim()
  const bId = String(body.bId || '').trim()
  if (!aId || !bId) return NextResponse.json({ error: 'aId and bId are required' }, { status: 400 })
  if (aId === bId) return NextResponse.json({ error: 'aId and bId must be different photos' }, { status: 400 })

  const [docA, docB] = await Promise.all([
    prisma.document.findUnique({ where: { id: aId }, include: { project: { select: { name: true } } } }),
    prisma.document.findUnique({ where: { id: bId }, include: { project: { select: { name: true } } } }),
  ])
  if (!docA || !docB) return NextResponse.json({ error: 'One or both photos not found' }, { status: 404 })

  // Order photos by createdAt so prompt language is consistent (older → newer).
  const earlier = new Date(docA.createdAt) <= new Date(docB.createdAt) ? docA : docB
  const later = earlier === docA ? docB : docA

  const earlierImg = await loadImageBase64(earlier)
  if (typeof earlierImg !== 'string') return NextResponse.json({ error: earlierImg.error, code: earlierImg.code }, { status: earlierImg.status })
  const laterImg = await loadImageBase64(later)
  if (typeof laterImg !== 'string') return NextResponse.json({ error: laterImg.error, code: laterImg.code }, { status: laterImg.status })

  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const earlierLabel = `Photo 1 (earlier — ${fmtDate(earlier.createdAt)}${earlier.project?.name ? `, ${earlier.project.name}` : ''})`
  const laterLabel = `Photo 2 (later — ${fmtDate(later.createdAt)}${later.project?.name ? `, ${later.project.name}` : ''})`

  const system = [
    'You are a UK construction project supervisor comparing two site photos taken at different times.',
    'The first image is the EARLIER photo. The second image is the LATER photo.',
    'Describe what construction work has progressed, reversed, or stayed the same between them. Be grounded — only mention what you can clearly see.',
    'Output STRICT JSON only with this shape:',
    `{ "summary": string (max 400 chars), "changes": string[] (1-10 short observations, each max 280 chars), "progress": one of ${PROGRESS_VALUES.map(p => `"${p}"`).join('/')}, "notes"?: string }`,
    'Progress values:',
    '  - progressed — work has clearly moved forward between the photos',
    '  - reversed   — visible regression (e.g. damage, removal, undoing)',
    '  - stalled    — same work visible, no meaningful change',
    '  - unrelated  — the photos appear to be of different scenes',
    'If the photos look like different sites entirely, set progress="unrelated" and explain in notes.',
  ].join('\n')

  const userPrompt = [
    earlierLabel,
    laterLabel,
    'Compare the two photos and return JSON per the schema.',
  ].join('\n')

  try {
    const res = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt, images: [earlierImg, laterImg] },
      ],
      { json: true, model: VISION_MODEL, timeoutMs: COMPARE_TIMEOUT_MS }
    )
    const result = parseCompareResponse(res.content)

    prisma.activity.create({
      data: {
        projectId: earlier.projectId || later.projectId,
        actorName: actorName(auth),
        actorType: 'ai',
        action: `compared photos: ${earlier.name} ↔ ${later.name}`,
        detail: `${result.progress} · ${result.changes.length} change${result.changes.length === 1 ? '' : 's'}`,
        iconType: 'spark',
      },
    }).catch(() => {})

    return NextResponse.json({
      ...result,
      earlier: { id: earlier.id, name: earlier.name, url: earlier.url, createdAt: earlier.createdAt },
      later:   { id: later.id,   name: later.name,   url: later.url,   createdAt: later.createdAt },
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
      { error: err instanceof Error ? err.message : 'Failed to compare photos', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }
}

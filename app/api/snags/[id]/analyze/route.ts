import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { chat, isLlmUnavailable, isLlmEmpty, LLM_CONFIG } from '@/lib/llm'

export const dynamic = 'force-dynamic'

// Default vision model. Override with OLLAMA_VISION_MODEL env. moondream is
// small (~1.8 GB) and fast on CPU; llava:7b is heavier but more accurate.
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'moondream'
const ANALYSIS_TIMEOUT_MS = 120_000 // vision inference is slow on CPU

const SEVERITIES = ['cosmetic', 'minor', 'major', 'safety'] as const
type Severity = typeof SEVERITIES[number]

interface Defect {
  description: string
  severity: Severity
  location?: string
}

interface AnalysisResult {
  defects: Defect[]
  summary: string
  notes?: string
}

// In-process rate limit — vision inference is expensive. 3 per user per
// minute is generous for manual triage workflow.
const rateLimits = new Map<string, number[]>()
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(userKey: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  const arr = (rateLimits.get(userKey) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (arr.length >= RATE_LIMIT_MAX) {
    const oldest = arr[0]
    return { ok: false, retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000) }
  }
  arr.push(now)
  rateLimits.set(userKey, arr)
  return { ok: true }
}

function parseVisionResponse(raw: string): AnalysisResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Strip markdown fences if the model wrapped them.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    parsed = JSON.parse(cleaned)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Model did not return a JSON object')
  }
  const obj = parsed as Record<string, unknown>
  const rawDefects = Array.isArray(obj.defects) ? obj.defects : []
  const defects: Defect[] = []
  for (const d of rawDefects) {
    if (!d || typeof d !== 'object') continue
    const r = d as Record<string, unknown>
    const description = typeof r.description === 'string' ? r.description.trim().slice(0, 280) : ''
    if (!description) continue
    let severity: Severity = 'minor'
    if (typeof r.severity === 'string') {
      const s = r.severity.trim().toLowerCase() as Severity
      if ((SEVERITIES as readonly string[]).includes(s)) severity = s
    }
    const location = typeof r.location === 'string' ? r.location.trim().slice(0, 120) : undefined
    defects.push(location ? { description, severity, location } : { description, severity })
    if (defects.length >= 12) break
  }
  const summary = typeof obj.summary === 'string' ? obj.summary.trim().slice(0, 400) : 'No summary provided.'
  const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 280) : undefined
  return { defects, summary, notes }
}

export async function POST(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const userId = (auth.user as { id?: string } | undefined)?.id || 'anon'
  const rl = checkRateLimit(userId)
  if (!rl.ok) {
    return new NextResponse(JSON.stringify({ error: `Too many analyses. Try again in ${rl.retryAfter}s.` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    })
  }

  const snag = await prisma.snag.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } } },
  })
  if (!snag) return NextResponse.json({ error: 'Snag not found' }, { status: 404 })
  if (!snag.photoUrl) {
    return NextResponse.json({ error: 'This snag has no photo to analyse.', code: 'NO_PHOTO' }, { status: 400 })
  }

  // Only accept same-origin /api/uploads URLs — prevents SSRF.
  if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(snag.photoUrl)) {
    return NextResponse.json({ error: 'Invalid photo URL', code: 'INVALID_PHOTO' }, { status: 400 })
  }

  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  const filename = snag.photoUrl.replace(/^\/api\/uploads\//, '')
  const photoPath = join(uploadDir, filename)
  if (!existsSync(photoPath)) {
    return NextResponse.json({ error: 'Photo file not found on server', code: 'PHOTO_MISSING' }, { status: 404 })
  }

  let imageBase64: string
  try {
    const bytes = await readFile(photoPath)
    if (bytes.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo too large for analysis (max 8 MB)', code: 'PHOTO_TOO_LARGE' }, { status: 413 })
    }
    imageBase64 = bytes.toString('base64')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to read photo', code: 'PHOTO_READ_FAILED' }, { status: 500 })
  }

  const system = [
    'You are a UK construction defects inspector reviewing a site photo.',
    'Identify visible defects, snags, or quality issues. Be specific and grounded — only describe what you can clearly see.',
    'Output STRICT JSON only with this shape:',
    '{ "defects": [{ "description": string (max 280 chars), "severity": one of "cosmetic"|"minor"|"major"|"safety", "location"?: string (e.g. "top-left corner", "skirting", "ceiling") }], "summary": string (max 400 chars), "notes"?: string }',
    'Severity rubric:',
    '  - cosmetic  — appearance only (paint marks, light scuffs)',
    '  - minor     — fixable in <1h (small gaps, missing trim)',
    '  - major     — needs trade revisit (poor finish, structural cosmetic, alignment)',
    '  - safety    — anyone could be hurt (loose materials, electrical exposure, fall risk)',
    'If no defects are visible, return an empty defects array and a one-sentence summary describing the scene. Do not speculate.',
    'Max 12 defects.',
  ].join('\n')

  const userPrompt = [
    `Snag title: "${snag.title}"`,
    snag.description ? `Reporter said: "${snag.description}"` : '',
    snag.location ? `Location on site: "${snag.location}"` : '',
    'Analyse the attached photo against the rubric above and return JSON.',
  ].filter(Boolean).join('\n')

  try {
    const res = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt, images: [imageBase64] },
      ],
      { json: true, model: VISION_MODEL, timeoutMs: ANALYSIS_TIMEOUT_MS }
    )
    const analysis = parseVisionResponse(res.content)

    // Log a brief activity event so the analysis is auditable.
    prisma.activity.create({
      data: {
        projectId: snag.projectId,
        actorName: actorName(auth),
        actorType: 'ai',
        action: `analysed snag photo: ${snag.title}`,
        detail: `${analysis.defects.length} defect${analysis.defects.length === 1 ? '' : 's'} flagged`,
        iconType: 'spark',
      },
    }).catch(() => {})

    return NextResponse.json({
      ...analysis,
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
      return NextResponse.json({ error: 'Vision model returned an empty response. Try again.', code: 'VISION_EMPTY' }, { status: 502 })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyse photo', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }
}

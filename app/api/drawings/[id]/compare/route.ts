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
const COMPARE_TIMEOUT_MS = 180_000
const MAX_BYTES = 8 * 1024 * 1024

// Vision models can only read raster formats. PDFs and DWGs aren't readable
// directly. Surface a clear 400 rather than a confusing model failure.
const READABLE_MIME = /^image\/(png|jpe?g|webp|gif)$/i

const SEVERITIES = ['minor', 'moderate', 'major'] as const
type Severity = typeof SEVERITIES[number]

interface RevChange {
  description: string
  severity: Severity
  affects?: 'structural' | 'mep' | 'finishes' | 'layout' | 'annotation' | 'other'
}

interface RevCompareResult {
  summary: string
  changes: RevChange[]
  designIntent: 'preserved' | 'modified' | 'unclear'
  reviewRecommended: boolean
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

function parseCompareResponse(raw: string): RevCompareResult {
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
  const changes: RevChange[] = []
  const ALLOWED_AFFECTS = ['structural', 'mep', 'finishes', 'layout', 'annotation', 'other'] as const
  for (const c of rawChanges) {
    if (!c || typeof c !== 'object') continue
    const r = c as Record<string, unknown>
    const description = typeof r.description === 'string' ? r.description.trim().slice(0, 280) : ''
    if (!description) continue
    let severity: Severity = 'moderate'
    if (typeof r.severity === 'string') {
      const s = r.severity.trim().toLowerCase() as Severity
      if ((SEVERITIES as readonly string[]).includes(s)) severity = s
    }
    let affects: RevChange['affects']
    if (typeof r.affects === 'string') {
      const a = r.affects.trim().toLowerCase() as NonNullable<RevChange['affects']>
      if ((ALLOWED_AFFECTS as readonly string[]).includes(a)) affects = a
    }
    changes.push(affects ? { description, severity, affects } : { description, severity })
    if (changes.length >= 12) break
  }
  let designIntent: RevCompareResult['designIntent'] = 'unclear'
  if (typeof obj.designIntent === 'string') {
    const d = obj.designIntent.trim().toLowerCase()
    if (d === 'preserved' || d === 'modified') designIntent = d
  }
  const reviewRecommended = typeof obj.reviewRecommended === 'boolean'
    ? obj.reviewRecommended
    : changes.some(c => c.severity === 'major') || designIntent === 'modified'
  const notes = typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 280) : undefined
  return { summary, changes, designIntent, reviewRecommended, notes }
}

async function loadRevImage(rev: { fileUrl: string | null; mimeType: string | null }): Promise<string | { error: string; code: string; status: number }> {
  if (!rev.fileUrl) return { error: 'Revision has no file attached.', code: 'NO_FILE', status: 400 }
  if (!rev.mimeType || !READABLE_MIME.test(rev.mimeType)) {
    return { error: `Vision compare requires a raster image (png/jpg/webp/gif). This revision is ${rev.mimeType || 'unknown type'} — export the sheet to PNG or JPG and re-upload to use this feature.`, code: 'UNREADABLE_FORMAT', status: 400 }
  }
  if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(rev.fileUrl)) {
    return { error: 'Invalid revision URL', code: 'INVALID_URL', status: 400 }
  }
  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  const filename = rev.fileUrl.replace(/^\/api\/uploads\//, '')
  const path = join(uploadDir, filename)
  if (!existsSync(path)) return { error: 'Revision file not found on server', code: 'FILE_MISSING', status: 404 }
  const bytes = await readFile(path)
  if (bytes.length > MAX_BYTES) {
    return { error: `Revision file too large (max ${MAX_BYTES / 1024 / 1024} MB)`, code: 'FILE_TOO_LARGE', status: 413 }
  }
  return bytes.toString('base64')
}

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const userId = (auth.user as { id?: string } | undefined)?.id || 'anon'
  const rl = checkRateLimit(userId)
  if (!rl.ok) {
    return new NextResponse(JSON.stringify({ error: `Too many comparisons. Try again in ${rl.retryAfter}s.` }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
    })
  }

  let body: { aRev?: unknown; bRev?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const aRev = String(body.aRev || '').trim()
  const bRev = String(body.bRev || '').trim()
  if (!aRev || !bRev) return NextResponse.json({ error: 'aRev and bRev are required revision ids' }, { status: 400 })
  if (aRev === bRev) return NextResponse.json({ error: 'aRev and bRev must be different revisions' }, { status: 400 })

  const drawing = await prisma.drawing.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } }, revisions: true },
  })
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

  const revA = drawing.revisions.find(r => r.id === aRev)
  const revB = drawing.revisions.find(r => r.id === bRev)
  if (!revA || !revB) return NextResponse.json({ error: 'One or both revisions are not on this drawing' }, { status: 404 })

  // Earlier = lower uploadedAt; later = higher.
  const earlier = new Date(revA.uploadedAt) <= new Date(revB.uploadedAt) ? revA : revB
  const later = earlier === revA ? revB : revA

  const earlierImg = await loadRevImage(earlier)
  if (typeof earlierImg !== 'string') return NextResponse.json({ error: earlierImg.error, code: earlierImg.code }, { status: earlierImg.status })
  const laterImg = await loadRevImage(later)
  if (typeof laterImg !== 'string') return NextResponse.json({ error: laterImg.error, code: laterImg.code }, { status: laterImg.status })

  const system = [
    'You are a UK construction architect reviewing two revisions of the same drawing.',
    `Drawing: "${drawing.title}" (${drawing.number}${drawing.discipline ? `, ${drawing.discipline}` : ''})`,
    'The first image is the EARLIER revision; the second is the LATER revision.',
    'Identify design changes between the two. Be grounded — only mention what you can clearly see on the sheet.',
    'Output STRICT JSON only with this shape:',
    `{ "summary": string (max 400 chars), "changes": [{ "description": string (max 280 chars), "severity": "minor"|"moderate"|"major", "affects"?: "structural"|"mep"|"finishes"|"layout"|"annotation"|"other" }, ...], "designIntent": "preserved"|"modified"|"unclear", "reviewRecommended": boolean, "notes"?: string }`,
    'Severity rubric:',
    '  - minor    — annotation edits, dimensions tightened, notes added/clarified',
    '  - moderate — layout adjustments, finish swaps, MEP route changes',
    '  - major    — structural changes, footprint changes, removed/added rooms or load-bearing elements',
    'Set reviewRecommended=true if any change is "major" or if the design intent is materially modified (engineer / client sign-off needed).',
    'Max 12 changes. If the sheets look unrelated (different drawing), set designIntent="unclear" and explain in notes.',
  ].join('\n')

  const userPrompt = [
    `Earlier revision: ${earlier.revision} (${earlier.fileName || 'unnamed'}, uploaded ${new Date(earlier.uploadedAt).toLocaleDateString('en-GB')})`,
    `Later revision: ${later.revision} (${later.fileName || 'unnamed'}, uploaded ${new Date(later.uploadedAt).toLocaleDateString('en-GB')})`,
    'Compare the two sheets and return JSON per the schema.',
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
        projectId: drawing.projectId,
        actorName: actorName(auth),
        actorType: 'ai',
        action: `compared drawing revisions: ${drawing.number} ${earlier.revision} → ${later.revision}`,
        detail: `${result.changes.length} change${result.changes.length === 1 ? '' : 's'} · ${result.designIntent}${result.reviewRecommended ? ' · review recommended' : ''}`,
        iconType: 'spark',
      },
    }).catch(() => {})

    return NextResponse.json({
      ...result,
      drawing: { id: drawing.id, number: drawing.number, title: drawing.title },
      earlier: { id: earlier.id, revision: earlier.revision, fileName: earlier.fileName, fileUrl: earlier.fileUrl, uploadedAt: earlier.uploadedAt },
      later:   { id: later.id,   revision: later.revision,   fileName: later.fileName,   fileUrl: later.fileUrl,   uploadedAt: later.uploadedAt },
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
      { error: err instanceof Error ? err.message : 'Failed to compare revisions', code: 'PARSE_FAILED' },
      { status: 422 }
    )
  }
}

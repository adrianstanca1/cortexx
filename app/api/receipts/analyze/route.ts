import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { downloadToTemp } from '@/lib/storage'
import { chat, isLlmEmpty, isLlmUnavailable, LLM_CONFIG } from '@/lib/llm'
import receiptVision from '@/lib/receipt-vision'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const { parseReceiptVision } = receiptVision
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'moondream'
const ANALYSIS_TIMEOUT_MS = 120_000

async function markFailure(documentId: string, code: string, message: string) {
  await prisma.expenseReceipt.updateMany({
    where: { documentId },
    data: {
      status: 'needs_review',
      extraction: { error: code, message: message.slice(0, 300), at: new Date().toISOString() } as Prisma.InputJsonValue,
    },
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'vision', (auth.user as { id?: string }).id)
  if (limited) return limited

  let body: { documentId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const documentId = String(body.documentId || '').trim()
  if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 })

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { id: true, name: true } }, expenseReceipt: true },
  })
  if (!document || document.type !== 'receipt') return NextResponse.json({ error: 'Receipt document not found' }, { status: 404 })
  if (!document.url || !/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(document.url)) {
    return NextResponse.json({ error: 'Receipt image is missing or invalid', code: 'INVALID_RECEIPT_IMAGE' }, { status: 400 })
  }

  const receipt = document.expenseReceipt || await prisma.expenseReceipt.create({
    data: {
      documentId: document.id,
      projectId: document.projectId,
      status: 'pending',
      capturedAt: document.capturedAt || document.createdAt,
      latitude: document.latitude,
      longitude: document.longitude,
      accuracyM: document.accuracyM,
      extraction: {} as Prisma.InputJsonValue,
    },
  })

  const filename = document.url.replace(/^\/api\/uploads\//, '')
  const dl = await downloadToTemp(filename)
  if (!dl) {
    await markFailure(documentId, 'IMAGE_MISSING', 'Receipt image file not found')
    return NextResponse.json({ error: 'Receipt image file not found', code: 'IMAGE_MISSING', receiptId: receipt.id }, { status: 404 })
  }

  let imageBase64 = ''
  try {
    const bytes = await readFile(dl.path)
    if (bytes.length > 8 * 1024 * 1024) {
      await markFailure(documentId, 'IMAGE_TOO_LARGE', 'Receipt image exceeds 8 MB analysis limit')
      return NextResponse.json({ error: 'Receipt image too large for OCR (max 8 MB)', code: 'IMAGE_TOO_LARGE', receiptId: receipt.id }, { status: 413 })
    }
    imageBase64 = bytes.toString('base64')
  } catch (error) {
    await markFailure(documentId, 'IMAGE_READ_FAILED', error instanceof Error ? error.message : 'Failed to read receipt image')
    return NextResponse.json({ error: 'Failed to read receipt image', code: 'IMAGE_READ_FAILED', receiptId: receipt.id }, { status: 500 })
  } finally {
    dl.cleanup().catch(() => {})
  }

  const system = [
    'You are Cortex Receipt OCR for a UK construction company.',
    'Read only what is visible in the attached receipt image. Do not invent missing values.',
    'Return STRICT JSON only:',
    '{"vendor":string|null,"date":"YYYY-MM-DD"|null,"subtotal":number|null,"vatAmount":number|null,"totalAmount":number|null,"currency":"GBP","category":"materials|plant|tools|fuel|travel|accommodation|subcontract|office|other","items":[{"description":string,"quantity":number,"unitPrice":number|null,"total":number|null}],"confidence":number,"notes":string|null}',
    'Use the final amount actually paid as totalAmount. VAT should be the VAT/tax amount printed, not an estimate.',
    'If the image is unclear, lower confidence and explain briefly in notes.',
    'Never infer a project from the receipt. Project assignment comes from the capture context.',
  ].join('\n')

  try {
    const response = await chat([
      { role: 'system', content: system },
      { role: 'user', content: 'Extract this construction expense receipt and return JSON.', images: [imageBase64] },
    ], { json: true, model: VISION_MODEL, timeoutMs: ANALYSIS_TIMEOUT_MS })
    const extraction = parseReceiptVision(response.content)
    const receiptDate = extraction.receiptDate ? new Date(`${extraction.receiptDate}T00:00:00Z`) : null
    const status = extraction.confidence >= 0.75 ? 'extracted' : 'needs_review'
    const updated = await prisma.expenseReceipt.update({
      where: { id: receipt.id },
      data: {
        vendor: extraction.vendor,
        receiptDate,
        subtotal: extraction.subtotal,
        vatAmount: extraction.vatAmount,
        totalAmount: extraction.totalAmount,
        currency: extraction.currency,
        category: extraction.category,
        items: extraction.items as unknown as Prisma.InputJsonValue,
        confidence: extraction.confidence,
        notes: extraction.notes,
        status,
        extraction: {
          model: response.model,
          latencyMs: response.totalDurationMs,
          extractedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
      include: { project: { select: { id: true, name: true } }, document: true },
    })

    const rawTags = Array.isArray(document.tags) ? document.tags.filter((x): x is string => typeof x === 'string') : []
    const tags = [...new Set([...rawTags, 'receipt', extraction.category, extraction.vendor ? extraction.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : ''].filter(Boolean))]
    await prisma.document.update({ where: { id: document.id }, data: { tags: tags as Prisma.InputJsonValue } }).catch(() => {})

    prisma.activity.create({
      data: {
        projectId: document.projectId,
        actorName: actorName(auth),
        actorType: 'ai',
        action: `scanned receipt${extraction.vendor ? `: ${extraction.vendor}` : ''}`,
        detail: `${extraction.totalAmount === null ? 'amount unclear' : `£${extraction.totalAmount.toFixed(2)}`} · ${Math.round(extraction.confidence * 100)}% confidence · review required`,
        iconType: 'receipt',
      },
    }).catch(() => {})

    return NextResponse.json({ receipt: updated, extraction, model: response.model, latencyMs: response.totalDurationMs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt OCR failed'
    if (isLlmUnavailable(error)) {
      await markFailure(documentId, 'VISION_UNAVAILABLE', message)
      return NextResponse.json({ error: message, code: 'VISION_UNAVAILABLE', receiptId: receipt.id, config: { model: VISION_MODEL, baseUrl: LLM_CONFIG.baseUrl } }, { status: 503 })
    }
    if (isLlmEmpty(error)) {
      await markFailure(documentId, 'VISION_EMPTY', message)
      return NextResponse.json({ error: message, code: 'VISION_EMPTY', receiptId: receipt.id }, { status: 502 })
    }
    await markFailure(documentId, 'OCR_PARSE_FAILED', message)
    return NextResponse.json({ error: message, code: 'OCR_PARSE_FAILED', receiptId: receipt.id }, { status: 422 })
  }
}

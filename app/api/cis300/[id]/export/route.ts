import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

// Copied from /api/export/[type] — kept in-file so this route doesn't
// share a module with the existing exporter.
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = value instanceof Date ? value.toISOString() : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCSV(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

interface LineItem {
  subcontractorId?: string
  name?: string
  utr?: string | null
  cisStatus?: string
  gross?: number
  cis?: number
  net?: number
  materialsCost?: number
  verificationNumber?: string | null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof Response) return auth
  const { id } = await params
  const item = await prisma.cis300Return.findUnique({ where: { id } })
  if (!item) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const lineItems: LineItem[] = Array.isArray(item.lineItems)
    ? (item.lineItems as unknown as LineItem[])
    : []

  const headers = [
    'Verification Number',
    'Subcontractor Name',
    'Subcontractor UTR',
    'Gross Amount Paid',
    'Cost of Materials',
    'Tax Deducted',
  ]
  const rows = lineItems.map(li => ({
    'Verification Number': li.verificationNumber ?? '',
    'Subcontractor Name': li.name ?? '',
    'Subcontractor UTR': li.utr ?? '',
    'Gross Amount Paid': (li.gross ?? 0).toFixed(2),
    'Cost of Materials': (li.materialsCost ?? 0).toFixed(2),
    'Tax Deducted': (li.cis ?? 0).toFixed(2),
  }))
  const csv = toCSV(headers, rows)

  const dt = new Date(item.taxMonth)
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const filename = `cis300-${yyyy}-${mm}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

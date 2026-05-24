import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const SLATE = '#152641'
const AMBER = '#f59e0b'
const GREEN = '#10b981'
const RED = '#ef4444'
const TEXT = '#0f172a'
const MUTED = '#64748b'

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusColor(status: string): string {
  if (status === 'paid') return GREEN
  if (status === 'overdue') return RED
  if (status === 'sent') return AMBER
  return MUTED
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { project: true },
  })
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const issued = new Date(inv.issuedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const due = new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const paid = inv.paidDate ? new Date(inv.paidDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const sc = statusColor(inv.status)

  const pdfBytes: Buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ─── Header band ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(SLATE)
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(22).text('INVOICE', 48, 30)
    doc.font('Helvetica').fontSize(11).fillColor('#8ea8c5').text(inv.number, 48, 60)
    doc.fontSize(10).fillColor('#8ea8c5').text('Cortexx', doc.page.width - 48 - 80, 36, { width: 80, align: 'right' })
    doc.fontSize(9).fillColor('#8ea8c5').text('cortexbuildpro.com', doc.page.width - 48 - 120, 52, { width: 120, align: 'right' })

    // Status pill, top-right corner of the header band
    const pillW = 90
    const pillX = doc.page.width - 48 - pillW
    doc.roundedRect(pillX, 70, pillW, 14, 3).fill(sc)
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(inv.status.toUpperCase(), pillX, 73, { width: pillW, align: 'center' })

    // ─── Meta block ───────────────────────────────────────────
    let y = 120
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('BILL TO', 48, y)
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(14).text(inv.clientName, 48, y + 12)
    if (inv.project?.name) doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`Project · ${inv.project.name}`, 48, y + 32)
    if (inv.project?.address) {
      const addr = `${inv.project.address}${inv.project.postcode ? `, ${inv.project.postcode}` : ''}`
      doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(addr, 48, y + 46)
    }

    // Right column: dates
    const rightX = doc.page.width - 48 - 200
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('ISSUED', rightX, y)
    doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(issued, rightX, y + 12)
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('DUE', rightX, y + 32)
    doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(due, rightX, y + 44)
    if (paid) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PAID', rightX, y + 64)
      doc.fillColor(GREEN).font('Helvetica').fontSize(11).text(paid, rightX, y + 76)
    }

    // ─── Line item ────────────────────────────────────────────
    y = 220
    doc.fillColor(SLATE).rect(48, y, doc.page.width - 96, 22).fill()
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(9)
    doc.text('DESCRIPTION', 56, y + 7)
    doc.text('AMOUNT', doc.page.width - 48 - 80, y + 7, { width: 72, align: 'right' })

    y += 30
    const description = inv.project?.name ? `${inv.project.name} — services rendered` : `${inv.clientName} — services rendered`
    doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(description, 56, y, { width: doc.page.width - 96 - 90 })
    doc.font('Helvetica-Bold').text(gbp(inv.amount), doc.page.width - 48 - 80, y, { width: 72, align: 'right' })
    y += 24
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(48, y).lineTo(doc.page.width - 48, y).stroke()

    // ─── Total ────────────────────────────────────────────────
    y += 24
    const totalLabel = inv.status === 'paid' ? 'AMOUNT PAID' : 'TOTAL DUE'
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(10).text(totalLabel, doc.page.width - 48 - 200, y, { width: 110, align: 'right' })
    doc.fillColor(sc).font('Helvetica-Bold').fontSize(22).text(gbp(inv.amount), doc.page.width - 48 - 90, y - 4, { width: 90, align: 'right' })

    // ─── Notes ────────────────────────────────────────────────
    if (inv.notes) {
      y += 48
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('NOTES', 48, y)
      doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(inv.notes, 48, y + 12, { width: doc.page.width - 96 })
    }

    // ─── Footer ───────────────────────────────────────────────
    const footerY = doc.page.height - 40
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Generated by Cortexx · ${new Date().toLocaleString('en-GB')}`, 48, footerY, { width: doc.page.width - 96, align: 'center' })

    doc.end()
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${inv.number}.pdf"`,
      'Content-Length': String(pdfBytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}

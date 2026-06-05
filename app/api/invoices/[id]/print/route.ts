import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Returns a print-optimised HTML invoice. Open in a browser and use
 * Print → Save as PDF for a real PDF. Avoids heavy PDF libraries.
 */
export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof Response) return auth
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { project: true },
    })
    if (!inv) return new Response('Not found', { status: 404 })

    const issued = new Date(inv.issuedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const due = new Date(inv.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const paid = inv.paidDate ? new Date(inv.paidDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
    const amount = inv.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const statusColor = inv.status === 'paid' ? '#10b981' : inv.status === 'overdue' ? '#ef4444' : inv.status === 'sent' ? '#f59e0b' : '#52749a'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(inv.number)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "SF Pro Text", Inter, system-ui, sans-serif; color: #1a2f4e; max-width: 760px; margin: 0 auto; padding: 32px; line-height: 1.5; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a2f4e; padding-bottom: 18px; margin-bottom: 28px; }
  .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .logo span { color: #f59e0b; }
  .meta { text-align: right; }
  .meta h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
  .meta .num { font-family: ui-monospace, "SF Mono", monospace; color: #52749a; font-size: 14px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 8px; background: ${statusColor}; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 28px; }
  .grid h3 { font-size: 11px; color: #52749a; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 8px; }
  .grid p { margin: 0; font-size: 15px; }
  .grid .name { font-weight: 700; font-size: 17px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  table th { text-align: left; padding: 10px 0; border-bottom: 1px solid #c9d6e8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #52749a; }
  table td { padding: 14px 0; border-bottom: 1px solid #e6eef8; font-size: 15px; }
  table td.right, table th.right { text-align: right; }
  .total { text-align: right; padding-top: 14px; }
  .total .label { font-size: 13px; color: #52749a; margin-bottom: 4px; }
  .total .amt { font-family: ui-monospace, "SF Mono", monospace; font-size: 32px; font-weight: 800; letter-spacing: -1px; }
  .notes { padding: 14px 16px; background: #f4f7fb; border-radius: 10px; font-size: 14px; margin-bottom: 28px; }
  .notes h3 { font-size: 11px; color: #52749a; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px; }
  footer { color: #8ea8c5; font-size: 11px; text-align: center; padding-top: 24px; border-top: 1px solid #e6eef8; }
  .print-button { position: fixed; top: 20px; right: 20px; background: #f59e0b; color: #fff; border: none; border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  @media print { .print-button { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <button class="print-button" onclick="window.print()">Print / Save as PDF</button>
  <header>
    <div>
      <div class="logo">Cortex<span>x</span></div>
      <div style="font-size: 13px; color: #52749a; margin-top: 4px;">Construction management</div>
    </div>
    <div class="meta">
      <h1>Invoice</h1>
      <div class="num">${esc(inv.number)}</div>
      <div class="status">${esc(inv.status)}</div>
    </div>
  </header>

  <div class="grid">
    <div>
      <h3>Bill to</h3>
      <p class="name">${esc(inv.clientName)}</p>
      ${inv.project ? `<p style="color:#52749a; font-size:13px; margin-top:2px;">Project · ${esc(inv.project.name)}</p>` : ''}
      ${inv.project?.address ? `<p style="color:#52749a; font-size:13px;">${esc(inv.project.address)}${inv.project?.postcode ? ', ' + esc(inv.project.postcode) : ''}</p>` : ''}
    </div>
    <div style="text-align:right">
      <h3>Dates</h3>
      <p style="font-size:13px;"><strong>Issued:</strong> ${issued}</p>
      <p style="font-size:13px;"><strong>Due:</strong> ${due}</p>
      ${paid ? `<p style="font-size:13px; color:#10b981"><strong>Paid:</strong> ${paid}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${esc(inv.project?.name || inv.clientName)} — services rendered</td>
        <td class="right">£${amount}</td>
      </tr>
    </tbody>
  </table>

  <div class="total">
    <div class="label">Total due</div>
    <div class="amt">£${amount}</div>
  </div>

  ${inv.notes ? `<div class="notes"><h3>Notes</h3>${esc(inv.notes).split('\n').map(l => `<p>${l}</p>`).join('')}</div>` : ''}

  <footer>
    Generated by Cortexx · ${new Date().toLocaleString('en-GB')}
  </footer>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    reportError(error)
    return new Response('Print failed', { status: 500 })
  }
}

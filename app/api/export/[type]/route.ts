import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = value instanceof Date ? value.toISOString() : String(value)
  // RFC 4180: quote if contains comma, quote, or newline; double-quote inner quotes
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

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ type: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof Response) return auth

  let csv: string
  let filename: string
  const type = params.type

  try {
    if (type === 'projects') {
      const data = await prisma.project.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { tasks: true, assignments: true, invoices: true } } },
      })
      csv = toCSV(
        ['id', 'name', 'clientName', 'status', 'progress', 'budget', 'spent', 'startDate', 'endDate', 'tasks', 'assignments', 'invoices', 'createdAt'],
        data.map(p => ({
          id: p.id, name: p.name, clientName: p.clientName, status: p.status,
          progress: p.progress, budget: p.budget, spent: p.spent,
          startDate: p.startDate, endDate: p.endDate,
          tasks: p._count.tasks, assignments: p._count.assignments, invoices: p._count.invoices,
          createdAt: p.createdAt,
        })),
      )
      filename = 'projects.csv'
    } else if (type === 'tasks') {
      const data = await prisma.task.findMany({
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        include: { project: { select: { name: true } }, assignee: { select: { name: true } } },
      })
      csv = toCSV(
        ['id', 'title', 'status', 'priority', 'category', 'project', 'assignee', 'dueDate', 'dueTime', 'createdAt'],
        data.map(t => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          category: t.category, project: t.project?.name, assignee: t.assignee?.name,
          dueDate: t.dueDate, dueTime: t.dueTime, createdAt: t.createdAt,
        })),
      )
      filename = 'tasks.csv'
    } else if (type === 'invoices') {
      const data = await prisma.invoice.findMany({
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        include: { project: { select: { name: true } } },
      })
      csv = toCSV(
        ['id', 'number', 'clientName', 'project', 'status', 'amount', 'issuedDate', 'dueDate', 'paidDate'],
        data.map(i => ({
          id: i.id, number: i.number, clientName: i.clientName,
          project: i.project?.name, status: i.status, amount: i.amount,
          issuedDate: i.issuedDate, dueDate: i.dueDate, paidDate: i.paidDate,
        })),
      )
      filename = 'invoices.csv'
    } else if (type === 'team') {
      const data = await prisma.teamMember.findMany({ orderBy: { name: 'asc' } })
      csv = toCSV(
        ['id', 'name', 'role', 'email', 'phone', 'dailyRate', 'onSite', 'createdAt'],
        data.map(m => ({
          id: m.id, name: m.name, role: m.role, email: m.email, phone: m.phone,
          dailyRate: m.dailyRate, onSite: m.onSite, createdAt: m.createdAt,
        })),
      )
      filename = 'team.csv'
    } else if (type === 'timeentries') {
      const data = await prisma.timeEntry.findMany({
        orderBy: { date: 'desc' },
        include: { member: { select: { name: true } }, project: { select: { name: true } } },
      })
      csv = toCSV(
        ['id', 'member', 'project', 'date', 'hours', 'week', 'year', 'approved'],
        data.map(e => ({
          id: e.id, member: e.member.name, project: e.project?.name,
          date: e.date, hours: e.hours, week: e.week, year: e.year, approved: e.approved,
        })),
      )
      filename = 'timeentries.csv'
    } else if (type === 'sub-invoices') {
      const data = await prisma.subInvoice.findMany({
        orderBy: [{ status: 'asc' }, { invoiceDate: 'desc' }],
        include: { subcontractor: { select: { name: true, cisStatus: true, utrNumber: true } }, project: { select: { name: true } } },
      })
      csv = toCSV(
        ['id', 'number', 'subcontractor', 'utr', 'cisStatus', 'project', 'invoiceDate', 'status', 'netAmount', 'vatAmount', 'cisAmount', 'grossAmount', 'payableAmount', 'paidAt'],
        data.map(s => ({
          id: s.id, number: s.number,
          subcontractor: s.subcontractor.name,
          utr: s.subcontractor.utrNumber,
          cisStatus: s.subcontractor.cisStatus,
          project: s.project?.name, invoiceDate: s.invoiceDate, status: s.status,
          netAmount: s.netAmount, vatAmount: s.vatAmount, cisAmount: s.cisAmount,
          grossAmount: s.grossAmount, payableAmount: s.payableAmount, paidAt: s.paidAt,
        })),
      )
      filename = 'sub-invoices.csv'
    } else if (type === 'ledger') {
      // Xero / QuickBooks / Sage import format: Date, Reference,
      // Description, AccountCode, TaxRate, TaxAmount, GrossAmount.
      // Combines outgoing invoices (sales — credit account 200) and
      // incoming sub-invoices (cost-of-sales — debit account 310).
      const [inv, sub] = await Promise.all([
        prisma.invoice.findMany({ orderBy: { issuedDate: 'desc' }, include: { project: { select: { name: true } } } }),
        prisma.subInvoice.findMany({ orderBy: { invoiceDate: 'desc' }, include: { subcontractor: { select: { name: true } }, project: { select: { name: true } } } }),
      ])
      const rows: Array<Record<string, unknown>> = []
      for (const i of inv) {
        rows.push({
          Date: i.issuedDate ? new Date(i.issuedDate).toISOString().slice(0, 10) : '',
          Reference: i.number,
          Description: `${i.clientName}${i.project?.name ? ' — ' + i.project.name : ''}`,
          AccountCode: '200',
          TaxRate: '20% (VAT on Income)',
          TaxAmount: (i.amount * 0.2 / 1.2).toFixed(2),
          GrossAmount: i.amount.toFixed(2),
          ContactName: i.clientName,
          InvoiceStatus: i.status,
        })
      }
      for (const s of sub) {
        rows.push({
          Date: new Date(s.invoiceDate).toISOString().slice(0, 10),
          Reference: s.number,
          Description: `${s.subcontractor.name}${s.project?.name ? ' — ' + s.project.name : ''} (sub-invoice, CIS ${s.cisAmount.toFixed(2)})`,
          AccountCode: '310',
          TaxRate: s.vatAmount > 0 ? '20% (VAT on Expenses)' : 'No VAT',
          TaxAmount: s.vatAmount.toFixed(2),
          GrossAmount: s.grossAmount.toFixed(2),
          ContactName: s.subcontractor.name,
          InvoiceStatus: s.status,
        })
      }
      csv = toCSV(
        ['Date', 'Reference', 'Description', 'AccountCode', 'TaxRate', 'TaxAmount', 'GrossAmount', 'ContactName', 'InvoiceStatus'],
        rows,
      )
      filename = 'ledger.csv'
    } else {
      return Response.json({ error: 'Unknown export type. Use: projects, tasks, invoices, sub-invoices, ledger, team, timeentries' }, { status: 400 })
    }

    const ts = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cortexx-${type}-${ts}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Export failed' }, { status: 500 })
  }
}

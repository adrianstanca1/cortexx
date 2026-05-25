import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

/**
 * Workspace-wide search. Auto-scoped per-org by the Prisma tenancy
 * extension (requireAuth sets the AsyncLocalStorage context).
 *
 * LIKE-based for now; Postgres FTS migration 20260525020000 added
 * STORED tsvector columns + GIN indexes on the 8 most-searched
 * tables — a follow-up will swap this to `searchVector @@
 * websearch_to_tsquery($1)` via $queryRaw for sub-50 ms on 100k+ rows.
 *
 * Each `take: 10` is per-tenant since the extension rewrites the
 * implicit where to include organizationId.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const q = String(new URL(req.url).searchParams.get('q') || '').trim()
    if (q.length < 2) {
      return NextResponse.json({
        projects: [], tasks: [], team: [], invoices: [],
        snags: [], rfis: [], documents: [], customers: [], subcontractors: [],
        tags: [], processDocs: [], reminders: [],
        total: 0,
      })
    }

    const contains = { contains: q, mode: 'insensitive' as const }
    const [
      projects, tasks, team, invoices,
      snags, rfis, documents, customers, subcontractors,
      tags, processDocs, reminders,
    ] = await Promise.all([
      prisma.project.findMany({
        where: { OR: [
          { name: contains }, { clientName: contains },
          { postcode: contains }, { address: contains },
        ] },
        select: { id: true, name: true, status: true, clientName: true, postcode: true, progress: true },
        take: 10,
      }),
      prisma.task.findMany({
        where: { OR: [{ title: contains }, { description: contains }] },
        include: { project: { select: { name: true } }, assignee: { select: { name: true } } },
        take: 10,
      }),
      prisma.teamMember.findMany({
        where: { OR: [{ name: contains }, { role: contains }, { email: contains }] },
        select: { id: true, name: true, role: true, avatarColor: true, onSite: true },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: { OR: [{ number: contains }, { clientName: contains }] },
        select: { id: true, number: true, clientName: true, amount: true, status: true, projectId: true, project: { select: { name: true } } },
        take: 10,
      }),
      prisma.snag.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { location: contains }] },
        select: { id: true, title: true, status: true, priority: true, projectId: true, project: { select: { name: true } } },
        take: 10,
      }),
      prisma.rfi.findMany({
        where: { OR: [{ number: contains }, { subject: contains }, { body: contains }, { assignee: contains }] },
        select: { id: true, number: true, subject: true, status: true, priority: true, project: { select: { name: true } } },
        take: 10,
      }),
      prisma.document.findMany({
        where: { OR: [{ name: contains }, { type: contains }] },
        select: { id: true, name: true, type: true, project: { select: { name: true } } },
        take: 10,
      }),
      prisma.customer.findMany({
        where: { OR: [{ name: contains }, { contactName: contains }, { contactEmail: contains }, { postcode: contains }] },
        select: { id: true, name: true, contactName: true, contactEmail: true, postcode: true },
        take: 10,
      }),
      prisma.subcontractor.findMany({
        where: { OR: [{ name: contains }, { trade: contains }, { contactName: contains }] },
        select: { id: true, name: true, trade: true, contactName: true, cisStatus: true },
        take: 10,
      }),
      prisma.tag.findMany({
        where: { OR: [{ name: contains }, { description: contains }] },
        select: { id: true, name: true, color: true },
        take: 10,
      }),
      prisma.processDoc.findMany({
        where: { OR: [{ title: contains }, { category: contains }, { body: contains }] },
        select: { id: true, title: true, category: true, owner: true, version: true },
        take: 10,
      }),
      prisma.reminder.findMany({
        where: { OR: [{ title: contains }, { notes: contains }] },
        select: { id: true, title: true, dueAt: true, done: true },
        take: 10,
      }),
    ])

    const total =
      projects.length + tasks.length + team.length + invoices.length +
      snags.length + rfis.length + documents.length + customers.length + subcontractors.length +
      tags.length + processDocs.length + reminders.length

    return NextResponse.json({
      projects, tasks, team, invoices,
      snags, rfis, documents, customers, subcontractors,
      tags, processDocs, reminders,
      total,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

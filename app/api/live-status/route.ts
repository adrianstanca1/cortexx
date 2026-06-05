import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * Live status — read-only aggregation: who is on which site right now.
 * No new model. Reads SiteCheckIn (open ones), TeamMember.onSite,
 * Project lat/lng/onSiteCount.
 */
export async function GET(_req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const [activeCheckins, projects, team] = await Promise.all([
      prisma.siteCheckIn.findMany({
        where: { checkedOutAt: null },
        include: {
          member: { select: { id: true, name: true, role: true, avatarColor: true } },
          project: { select: { id: true, name: true, lat: true, lng: true } },
        },
        orderBy: { checkedInAt: 'desc' },
        take: 200,
      }),
      prisma.project.findMany({
        // Cap at 500 — live-status is polled frequently; tenants with
        // more active projects need a paginated view, not a single fetch.
        take: 500,
        where: { status: 'active', archivedAt: null },
        select: { id: true, name: true, address: true, postcode: true, lat: true, lng: true, onSiteCount: true, status: true, progress: true },
        orderBy: { name: 'asc' },
      }),
      prisma.teamMember.findMany({
        // Cap at 500 — same rationale as projects above.
        take: 500,
        select: { id: true, name: true, role: true, avatarColor: true, onSite: true },
        orderBy: { name: 'asc' },
      }),
    ])

    // Group active check-ins by project
    const byProject: Record<string, { project: typeof projects[0]; checkins: typeof activeCheckins }> = {}
    for (const p of projects) byProject[p.id] = { project: p, checkins: [] }
    for (const ci of activeCheckins) {
      if (ci.project && byProject[ci.project.id]) {
        byProject[ci.project.id].checkins.push(ci)
      }
    }

    const totalOnSite = team.filter(m => m.onSite).length
    const offSite = team.filter(m => !m.onSite)

    return NextResponse.json({
      byProject: Object.values(byProject),
      offSite,
      totals: {
        onSite: totalOnSite,
        offSite: offSite.length,
        activeProjects: projects.length,
        sitesOccupied: Object.values(byProject).filter(g => g.checkins.length > 0).length,
      },
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch live status' }, { status: 500 })
  }
}

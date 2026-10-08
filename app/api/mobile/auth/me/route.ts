import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { getCurrentOrg } from '@/lib/tenancy'
import { resolvePersona } from '@/lib/persona'

export const dynamic = 'force-dynamic'

/** The same user and tenant memberships are used by web and native clients. */
export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const user = session.user as { id?: string; email?: string | null; name?: string | null; role?: string }
  if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.userOrganization.findMany({
    where: { userId: user.id },
    include: {
      organization: { select: { id: true, slug: true, name: true } },
      user: { select: { role: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  const organizations = memberships.map(m => ({
    ...m.organization,
    role: m.role,
    personaRole: resolvePersona(m.personaRole, m.user.role, m.role),
  }))
  const active = organizations.find(o => o.id === getCurrentOrg()?.organizationId)
  if (!active) return NextResponse.json({ error: 'Organization access denied' }, { status: 403 })
  return NextResponse.json({ user: {
    id: user.id, email: user.email, name: user.name,
    role: active.personaRole, organizationRole: active.role,
    organization: { id: active.id, name: active.name, slug: active.slug },
    organizations,
  } })
}

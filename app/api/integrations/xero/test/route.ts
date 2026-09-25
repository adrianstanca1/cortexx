import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { xeroApiRequest } from '@/lib/xero-server'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
  if (!connection || connection.status === 'disconnected') return NextResponse.json({ error: 'Xero is not connected' }, { status: 409 })
  try {
    const body = await xeroApiRequest(connection, '/Organisation')
    const org = Array.isArray(body.Organisations) ? body.Organisations[0] : null
    return NextResponse.json({ ok: true, organisation: org ? { name: org.Name || connection.externalTenantName, baseCurrency: org.BaseCurrency || null, organisationID: org.OrganisationID || connection.externalTenantId } : null })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Xero test failed' }, { status: 502 })
  }
}

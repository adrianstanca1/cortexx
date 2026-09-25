import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import xeroAdapter from '@/lib/xero-adapter'
import { xeroPlatformConfig } from '@/lib/xero-server'

export const dynamic = 'force-dynamic'
const { buildAuthorizeUrl, XERO_SCOPES } = xeroAdapter

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const cfg = xeroPlatformConfig(req.nextUrl.origin)
  if (!cfg.configured) return NextResponse.json({ error: 'Xero platform integration is not configured', missing: cfg.missing }, { status: 503 })
  const state = crypto.randomBytes(32).toString('base64url')
  const stateHash = crypto.createHash('sha256').update(state).digest('hex')
  await prisma.accountingOAuthState.deleteMany({ where: { provider: 'xero', expiresAt: { lt: new Date() } } })
  await prisma.accountingOAuthState.create({
    data: {
      organizationId: auth.orgId,
      provider: 'xero',
      stateHash,
      requestedById: auth.userId,
      returnTo: '/settings/integrations/xero',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })
  return NextResponse.json({ authorizeUrl: buildAuthorizeUrl({ clientId: cfg.clientId, redirectUri: cfg.redirectUri, state, scopes: XERO_SCOPES }) })
}

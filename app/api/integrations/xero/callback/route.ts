import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bypassTenancy } from '@/lib/tenancy'
import { auditLog } from '@/lib/audit'
import xeroAdapter from '@/lib/xero-adapter'
import { encryptedTokenData, exchangeXeroCode, listXeroConnections } from '@/lib/xero-server'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
const { selectAuthorizedConnection } = xeroAdapter

function redirect(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/settings/integrations/xero', req.nextUrl.origin)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return NextResponse.redirect(url, { status: 302 })
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') || ''
  const code = req.nextUrl.searchParams.get('code') || ''
  const oauthError = req.nextUrl.searchParams.get('error')
  if (oauthError) return redirect(req, { error: `xero_${oauthError}` })
  if (!state || !code) return redirect(req, { error: 'xero_callback_missing_parameters' })
  const stateHash = crypto.createHash('sha256').update(state).digest('hex')
  try {
    return await bypassTenancy(async () => {
      const pending = await prisma.accountingOAuthState.findUnique({ where: { stateHash } })
      if (!pending || pending.provider !== 'xero' || pending.expiresAt.getTime() < Date.now()) {
        if (pending) await prisma.accountingOAuthState.delete({ where: { id: pending.id } }).catch(() => undefined)
        return redirect(req, { error: 'xero_state_invalid_or_expired' })
      }
      await prisma.accountingOAuthState.delete({ where: { id: pending.id } })
      const tokens = await exchangeXeroCode(code, req.nextUrl.origin)
      if (!tokens.refresh_token) return redirect(req, { error: 'xero_refresh_token_missing' })
      const connections = await listXeroConnections(tokens.access_token)
      const existing = await prisma.accountingConnection.findUnique({ where: { organizationId_provider: { organizationId: pending.organizationId, provider: 'xero' } } })
      const selected = selectAuthorizedConnection(connections, tokens.access_token, existing?.externalTenantId)
      if (!selected?.tenantId || !selected.id) return redirect(req, { error: 'xero_tenant_ambiguous' })
      const duplicate = await prisma.accountingConnection.findFirst({ where: { provider: 'xero', externalTenantId: selected.tenantId, organizationId: { not: pending.organizationId } } })
      if (duplicate) return redirect(req, { error: 'xero_tenant_already_linked' })
      const tokenData = encryptedTokenData(tokens)
      const connection = await prisma.accountingConnection.upsert({
        where: { organizationId_provider: { organizationId: pending.organizationId, provider: 'xero' } },
        create: {
          organizationId: pending.organizationId,
          provider: 'xero',
          externalConnectionId: selected.id,
          externalTenantId: selected.tenantId,
          externalTenantName: selected.tenantName || selected.tenantId,
          ...tokenData,
          status: 'connected',
          lastConnectedAt: new Date(),
          disconnectedAt: null,
          settings: {},
        },
        update: {
          externalConnectionId: selected.id,
          externalTenantId: selected.tenantId,
          externalTenantName: selected.tenantName || selected.tenantId,
          ...tokenData,
          status: 'connected',
          lastConnectedAt: new Date(),
          disconnectedAt: null,
          lastSyncError: null,
        },
      })
      auditLog({ organizationId: pending.organizationId, userId: pending.requestedById, action: 'accounting.xero.connect', resourceType: 'AccountingConnection', resourceId: connection.id, metadata: { tenantId: selected.tenantId, tenantName: selected.tenantName || null } })
      return redirect(req, { connected: '1' })
    })
  } catch (error) {
    reportError(error)
    return redirect(req, { error: 'xero_callback_failed' })
  }
}

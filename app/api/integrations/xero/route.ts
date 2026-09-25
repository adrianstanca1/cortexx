import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { ensureXeroAccessToken, removeXeroConnection, safeXeroConnection, xeroPlatformConfig } from '@/lib/xero-server'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function guard(role: string | null) {
  return role && canManage(role) ? null : NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = guard(auth.role)
  if (forbidden) return forbidden
  try {
    const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    const importedCount = connection ? await prisma.bankTransaction.count({ where: { source: 'xero', connectionId: connection.id } }) : 0
    const cfg = xeroPlatformConfig(req.nextUrl.origin)
    return NextResponse.json({ platformConfigured: cfg.configured, missingPlatformConfig: cfg.missing, connection: safeXeroConnection(connection, importedCount) })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load Xero integration' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = guard(auth.role)
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const body = await req.json() as Record<string, unknown>
    if (body.maxPages === undefined) return NextResponse.json({ error: 'maxPages is required' }, { status: 400 })
    const maxPages = Math.trunc(Number(body.maxPages))
    if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 10) return NextResponse.json({ error: 'maxPages must be between 1 and 10' }, { status: 400 })
    const existing = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    const current = existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings as Record<string, unknown> : {}
    const settings = { ...current, maxPages }
    const connection = existing
      ? await prisma.accountingConnection.update({ where: { id: existing.id }, data: { settings } })
      : await prisma.accountingConnection.create({ data: { organizationId: auth.orgId, provider: 'xero', status: 'disconnected', settings } })
    auditLog({ action: 'accounting.xero.configure', resourceType: 'AccountingConnection', resourceId: connection.id, metadata: { maxPages }, ...requestMeta(req) })
    return NextResponse.json({ connection: safeXeroConnection(connection) })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update Xero settings' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = guard(auth.role)
  if (forbidden) return forbidden
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    if (!connection) return NextResponse.json({ ok: true, warning: null })
    let warning: string | null = null
    if (connection.externalConnectionId && (connection.accessTokenCipher || connection.refreshTokenCipher)) {
      try {
        const { token } = await ensureXeroAccessToken(connection)
        await removeXeroConnection(token, connection.externalConnectionId)
      } catch (error) {
        warning = error instanceof Error ? error.message.slice(0, 500) : 'Remote Xero disconnect failed'
      }
    }
    const updated = await prisma.accountingConnection.update({
      where: { id: connection.id },
      data: {
        status: 'disconnected', accessTokenCipher: null, refreshTokenCipher: null, accessTokenExpiresAt: null,
        externalConnectionId: null, externalTenantId: null, externalTenantName: null,
        disconnectedAt: new Date(), lastSyncError: warning, lastHealthError: null,
      },
    })
    auditLog({ action: 'accounting.xero.disconnect', resourceType: 'AccountingConnection', resourceId: updated.id, metadata: { warning }, ...requestMeta(req) })
    return NextResponse.json({ ok: true, warning })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to disconnect Xero' }, { status: 500 })
  }
}

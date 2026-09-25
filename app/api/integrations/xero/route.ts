import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { decryptXeroToken } from '@/lib/xero-token-vault'
import { ensureXeroAccessToken, removeXeroConnection, safeXeroConnection, xeroPlatformConfig } from '@/lib/xero-server'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function guard(role: string | null) {
  return role && canManage(role) ? null : NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
}

function cleanSettings(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const key of ['salesAccountCode', 'salesTaxType', 'purchaseAccountCode', 'purchaseTaxType']) {
    if (body[key] !== undefined) data[key] = String(body[key] || '').trim().slice(0, 40)
  }
  if (body.syncBills !== undefined) data.syncBills = body.syncBills === true
  return data
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const forbidden = guard(auth.role)
  if (forbidden) return forbidden
  try {
    const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    const links = connection ? await prisma.accountingSyncLink.count({ where: { connectionId: connection.id } }) : 0
    const cfg = xeroPlatformConfig(req.nextUrl.origin)
    return NextResponse.json({
      platformConfigured: cfg.configured,
      missingPlatformConfig: cfg.missing,
      connection: safeXeroConnection(connection, links),
    })
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
    const existing = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    const current = existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings as Record<string, unknown> : {}
    const settings = { ...current, ...cleanSettings(body) }
    const connection = existing
      ? await prisma.accountingConnection.update({ where: { id: existing.id }, data: { settings } })
      : await prisma.accountingConnection.create({ data: { organizationId: auth.orgId, provider: 'xero', status: 'disconnected', settings } })
    auditLog({ action: 'accounting.xero.configure', resourceType: 'AccountingConnection', resourceId: connection.id, metadata: { settings: Object.keys(cleanSettings(body)) }, ...requestMeta(req) })
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
        warning = error instanceof Error ? error.message : 'Remote Xero disconnect failed'
      }
    } else if (connection.refreshTokenCipher) {
      // Touch the ciphertext only to verify local token material is readable before clearing it.
      try { decryptXeroToken(connection.refreshTokenCipher) } catch { warning = 'Stored Xero token could not be decrypted; local connection cleared' }
    }
    const updated = await prisma.accountingConnection.update({
      where: { id: connection.id },
      data: {
        status: 'disconnected',
        accessTokenCipher: null,
        refreshTokenCipher: null,
        accessTokenExpiresAt: null,
        externalConnectionId: null,
        externalTenantId: null,
        externalTenantName: null,
        disconnectedAt: new Date(),
        lastSyncError: warning,
      },
    })
    auditLog({ action: 'accounting.xero.disconnect', resourceType: 'AccountingConnection', resourceId: updated.id, metadata: { warning }, ...requestMeta(req) })
    return NextResponse.json({ ok: true, warning })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to disconnect Xero' }, { status: 500 })
  }
}

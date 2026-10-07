import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { ensureXeroAccessToken, removeXeroConnection, safeXeroConnection, xeroApiRequest, xeroPlatformConfig } from '@/lib/xero-server'
import xeroWriteback from '@/lib/xero-writeback'
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
    const connection = await prisma.accountingConnection.findFirst({ where: { organizationId: auth.orgId, provider: 'xero' } })
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
    const existing = await prisma.accountingConnection.findFirst({ where: { organizationId: auth.orgId, provider: 'xero' } })
    const current = existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings) ? existing.settings as Record<string, unknown> : {}
    const settings: Record<string, unknown> = { ...current }
    const changed: Record<string, unknown> = {}

    if (body.maxPages !== undefined) {
      const maxPages = Math.trunc(Number(body.maxPages))
      if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 10) return NextResponse.json({ error: 'maxPages must be between 1 and 10' }, { status: 400 })
      settings.maxPages = maxPages
      changed.maxPages = maxPages
    }

    const mappingKeys = ['salesAccountCode', 'salesTaxType', 'purchaseAccountCode', 'purchaseTaxType', 'paymentAccountCode'] as const
    const mappingRequested = mappingKeys.some(key => body[key] !== undefined) || body.writebackEnabled !== undefined
    if (mappingRequested) {
      if (!existing || existing.status !== 'connected' || !existing.externalTenantId) {
        return NextResponse.json({ error: 'Connect Xero before configuring write-back' }, { status: 409 })
      }
      const missingScopes = xeroWriteback.missingWriteScopes(existing.scopes)
      if (missingScopes.length) return NextResponse.json({ error: 'Reconnect Xero to grant write-back permissions', missingScopes }, { status: 409 })

      const [accountsBody, taxRatesBody] = await Promise.all([
        xeroApiRequest(existing, '/Accounts'),
        xeroApiRequest(existing, '/TaxRates'),
      ])
      const accounts = Array.isArray(accountsBody.Accounts) ? accountsBody.Accounts as Array<Record<string, unknown>> : []
      const taxRates = Array.isArray(taxRatesBody.TaxRates) ? taxRatesBody.TaxRates as Array<Record<string, unknown>> : []
      const activeAccounts = accounts.filter(row => !row.Status || row.Status === 'ACTIVE')
      const activeTaxRates = taxRates.filter(row => !row.Status || row.Status === 'ACTIVE')
      const activeTaxTypes = new Set(activeTaxRates.map(row => String(row.TaxType || '')).filter(Boolean))
      const taxRateRecordByType = new Map(activeTaxRates.map(row => [String(row.TaxType || ''), row]))
      const taxRateByType = new Map(activeTaxRates.map(row => {
        const raw = row.EffectiveRate ?? row.DisplayTaxRate
        const rate = Number(raw)
        return [String(row.TaxType || ''), Number.isFinite(rate) ? rate : null]
      }))
      const byCode = new Map(activeAccounts.map(row => [String(row.Code || ''), row]))
      const salesTypes = new Set(['REVENUE', 'SALES', 'OTHERINCOME'])
      const purchaseTypes = new Set(['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS', 'CISLABOUREXPENSE', 'CISMATERIALS'])

      for (const key of mappingKeys) {
        if (body[key] === undefined) continue
        const value = String(body[key] || '').trim()
        if (key.endsWith('TaxType')) {
          if (value && !activeTaxTypes.has(value)) return NextResponse.json({ error: `Unknown or inactive Xero tax rate for ${key}` }, { status: 400 })
          const taxRate = value ? taxRateRecordByType.get(value) : undefined
          if (key === 'salesTaxType' && value && taxRate?.CanApplyToRevenue !== true) {
            return NextResponse.json({ error: 'Sales tax rate must be applicable to Xero revenue accounts' }, { status: 400 })
          }
          if (key === 'purchaseTaxType' && value && taxRate?.CanApplyToExpenses !== true) {
            return NextResponse.json({ error: 'Purchase tax rate must be applicable to Xero expense accounts' }, { status: 400 })
          }
        } else if (value) {
          const account = byCode.get(value)
          if (!account) return NextResponse.json({ error: `Unknown or inactive Xero account for ${key}` }, { status: 400 })
          const accountType = String(account.Type || '').toUpperCase()
          if (key === 'salesAccountCode' && !salesTypes.has(accountType)) {
            return NextResponse.json({ error: 'Sales account must be a Xero revenue/sales account' }, { status: 400 })
          }
          if (key === 'purchaseAccountCode' && !purchaseTypes.has(accountType)) {
            return NextResponse.json({ error: 'Purchase account must be a Xero expense/direct-cost account' }, { status: 400 })
          }
          if (key === 'paymentAccountCode' && accountType !== 'BANK' && account.EnablePaymentsToAccount !== true) {
            return NextResponse.json({ error: 'Payment account must be a Xero bank/payment-enabled account' }, { status: 400 })
          }
        }
        settings[key] = value
        changed[key] = value
        if (key === 'salesTaxType') {
          settings.salesTaxRate = value ? (taxRateByType.get(value) ?? null) : null
          changed.salesTaxRate = settings.salesTaxRate
        }
        if (key === 'purchaseTaxType') {
          settings.purchaseTaxRate = value ? (taxRateByType.get(value) ?? null) : null
          changed.purchaseTaxRate = settings.purchaseTaxRate
        }
      }
      if (body.writebackEnabled !== undefined) {
        const enabled = body.writebackEnabled === true
        const candidate = xeroWriteback.writebackMapping({ ...settings, writebackEnabled: enabled })
        if (enabled && (!candidate.salesAccountCode || !candidate.salesTaxType) && (!candidate.purchaseAccountCode || !candidate.purchaseTaxType)) {
          return NextResponse.json({ error: 'Configure at least one complete sales or purchase mapping before enabling write-back' }, { status: 400 })
        }
        settings.writebackEnabled = enabled
        changed.writebackEnabled = enabled
      }
    }

    if (Object.keys(changed).length === 0) return NextResponse.json({ error: 'No recognised settings supplied' }, { status: 400 })
    const connection = existing
      ? await prisma.accountingConnection.update({ where: { id: existing.id }, data: { settings: settings as Prisma.InputJsonValue } })
      : await prisma.accountingConnection.create({ data: { organizationId: auth.orgId, provider: 'xero', status: 'disconnected', settings: settings as Prisma.InputJsonValue } })
    auditLog({ action: 'accounting.xero.configure', resourceType: 'AccountingConnection', resourceId: connection.id, metadata: changed as Prisma.InputJsonValue, ...requestMeta(req) })
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
    const connection = await prisma.accountingConnection.findFirst({ where: { organizationId: auth.orgId, provider: 'xero' } })
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
    const rawSettings = connection.settings && typeof connection.settings === 'object' && !Array.isArray(connection.settings)
      ? connection.settings as Record<string, unknown>
      : {}
    const preservedSettings: Record<string, unknown> = {}
    const maxPages = Number(rawSettings.maxPages)
    if (Number.isFinite(maxPages) && maxPages >= 1 && maxPages <= 10) preservedSettings.maxPages = Math.trunc(maxPages)
    const updated = await prisma.$transaction(async tx => {
      await tx.accountingWriteback.deleteMany({ where: { connectionId: connection.id } })
      return tx.accountingConnection.update({
        where: { id: connection.id },
        data: {
          status: 'disconnected', accessTokenCipher: null, refreshTokenCipher: null, accessTokenExpiresAt: null,
          externalConnectionId: null, externalTenantId: null, externalTenantName: null,
          settings: preservedSettings as Prisma.InputJsonValue,
          disconnectedAt: new Date(), lastSyncError: warning, lastHealthError: null,
        },
      })
    })
    auditLog({ action: 'accounting.xero.disconnect', resourceType: 'AccountingConnection', resourceId: updated.id, metadata: { warning }, ...requestMeta(req) })
    return NextResponse.json({ ok: true, warning })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to disconnect Xero' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { xeroApiRequest } from '@/lib/xero-server'
import xeroWriteback from '@/lib/xero-writeback'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

type XeroAccount = {
  AccountID?: string
  Code?: string
  Name?: string
  Type?: string
  Status?: string
  EnablePaymentsToAccount?: boolean
}

type XeroTaxRate = {
  Name?: string
  TaxType?: string
  Status?: string
  EffectiveRate?: number
  DisplayTaxRate?: number
}

const { missingWriteScopes, writebackMapping } = xeroWriteback

export async function GET(_req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.role || !canManage(auth.role)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })

  try {
    const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    if (!connection || connection.status !== 'connected' || !connection.externalTenantId) {
      return NextResponse.json({ error: 'Xero is not connected' }, { status: 409 })
    }

    const missingScopes = missingWriteScopes(connection.scopes)
    if (missingScopes.length) {
      return NextResponse.json({
        error: 'Reconnect Xero to grant write-back permissions',
        missingScopes,
        reconnectRequired: true,
      }, { status: 409 })
    }

    const [accountsBody, taxRatesBody] = await Promise.all([
      xeroApiRequest(connection, '/Accounts'),
      xeroApiRequest(connection, '/TaxRates'),
    ])
    const accounts = (Array.isArray(accountsBody.Accounts) ? accountsBody.Accounts : []) as XeroAccount[]
    const taxRates = (Array.isArray(taxRatesBody.TaxRates) ? taxRatesBody.TaxRates : []) as XeroTaxRate[]
    const activeAccounts = accounts.filter(account => !account.Status || account.Status === 'ACTIVE')
    const salesTypes = new Set(['REVENUE', 'SALES', 'OTHERINCOME'])
    const purchaseTypes = new Set(['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS', 'CISLABOUREXPENSE', 'CISMATERIALS'])

    const shapeAccount = (account: XeroAccount) => ({
      id: account.AccountID || null,
      code: account.Code || '',
      name: account.Name || account.Code || 'Account',
      type: account.Type || '',
      enablePaymentsToAccount: Boolean(account.EnablePaymentsToAccount),
    })

    return NextResponse.json({
      mapping: writebackMapping(connection.settings),
      salesAccounts: activeAccounts.filter(account => salesTypes.has(String(account.Type || '').toUpperCase())).map(shapeAccount),
      purchaseAccounts: activeAccounts.filter(account => purchaseTypes.has(String(account.Type || '').toUpperCase())).map(shapeAccount),
      paymentAccounts: activeAccounts.filter(account => String(account.Type || '').toUpperCase() === 'BANK' || account.EnablePaymentsToAccount).map(shapeAccount),
      taxRates: taxRates
        .filter(rate => !rate.Status || rate.Status === 'ACTIVE')
        .map(rate => ({
          name: rate.Name || rate.TaxType || 'Tax rate',
          taxType: rate.TaxType || '',
          rate: rate.EffectiveRate ?? rate.DisplayTaxRate ?? null,
        }))
        .filter(rate => rate.taxType),
    })
  } catch (error) {
    reportError(error, { context: 'xero.mappings' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load Xero mappings' }, { status: 502 })
  }
}

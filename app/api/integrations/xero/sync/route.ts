import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import xeroAdapter from '@/lib/xero-adapter'
import { xeroApiRequest } from '@/lib/xero-server'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const { salesInvoicePayload, purchaseBillPayload, payloadHash, xeroStatusToLocal } = xeroAdapter
const MAX_SYNC_ITEMS = 25

type ResourceType = 'invoice' | 'sub_invoice'
type SyncError = { resourceType: ResourceType; localId: string; error: string }
type SyncResult = { resourceType: ResourceType; localId: string; remoteId: string; remoteNumber: string | null; action: 'created' | 'updated' | 'pulled' }

function isFinancialAdmin(role: string | null) {
  return !!role && canManage(role)
}

function settingsOf(connection: { settings: unknown }) {
  return connection.settings && typeof connection.settings === 'object' && !Array.isArray(connection.settings)
    ? connection.settings as Record<string, unknown>
    : {}
}

function firstRemoteInvoice(body: Record<string, unknown>) {
  const invoices = Array.isArray(body.Invoices) ? body.Invoices as Array<Record<string, unknown>> : []
  return invoices[0] || null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1800) : 'Unknown Xero sync error'
}

async function markLinkError(connectionId: string, resourceType: ResourceType, localId: string, error: unknown) {
  const organizationId = (await prisma.accountingConnection.findUniqueOrThrow({ where: { id: connectionId }, select: { organizationId: true } })).organizationId
  await prisma.accountingSyncLink.upsert({
    where: { organizationId_provider_resourceType_localId: {
      organizationId,
      provider: 'xero', resourceType, localId,
    } },
    create: { organizationId, connectionId, provider: 'xero', resourceType, localId, status: 'error', lastError: errorMessage(error) },
    update: { connectionId, status: 'error', lastError: errorMessage(error) },
  })
}

async function pushSales(connection: Awaited<ReturnType<typeof prisma.accountingConnection.findFirst>>, localId?: string | null, limit = MAX_SYNC_ITEMS) {
  if (!connection) return { results: [] as SyncResult[], errors: [] as SyncError[], skipped: 0 }
  const settings = settingsOf(connection)
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(localId ? { id: localId } : {}),
      status: { in: ['draft', 'sent', 'overdue'] },
    },
    include: { project: { select: { name: true } } },
    orderBy: { issuedDate: 'asc' },
    take: limit,
  })
  const results: SyncResult[] = []
  const errors: SyncError[] = []
  for (const invoice of invoices) {
    try {
      const payload = salesInvoicePayload(invoice, settings)
      const hash = payloadHash(payload)
      const link = await prisma.accountingSyncLink.findUnique({
        where: { organizationId_provider_resourceType_localId: { organizationId: connection.organizationId, provider: 'xero', resourceType: 'invoice', localId: invoice.id } },
      })
      if (link?.remoteId && link.payloadHash === hash && link.status === 'synced') continue
      const body = link?.remoteId
        ? await xeroApiRequest(connection, `/Invoices/${encodeURIComponent(link.remoteId)}`, { method: 'POST', body: JSON.stringify(payload) })
        : await xeroApiRequest(connection, '/Invoices', { method: 'PUT', body: JSON.stringify({ Invoices: [payload] }) })
      const remote = firstRemoteInvoice(body)
      const remoteId = String(remote?.InvoiceID || link?.remoteId || '')
      if (!remoteId) throw new Error('Xero did not return an InvoiceID')
      const remoteNumber = remote?.InvoiceNumber ? String(remote.InvoiceNumber) : invoice.number
      await prisma.accountingSyncLink.upsert({
        where: { organizationId_provider_resourceType_localId: { organizationId: connection.organizationId, provider: 'xero', resourceType: 'invoice', localId: invoice.id } },
        create: { organizationId: connection.organizationId, connectionId: connection.id, provider: 'xero', resourceType: 'invoice', localId: invoice.id, remoteId, remoteNumber, status: 'synced', payloadHash: hash, lastSyncedAt: new Date() },
        update: { connectionId: connection.id, remoteId, remoteNumber, status: 'synced', payloadHash: hash, lastSyncedAt: new Date(), lastError: null },
      })
      results.push({ resourceType: 'invoice', localId: invoice.id, remoteId, remoteNumber, action: link?.remoteId ? 'updated' : 'created' })
    } catch (error) {
      errors.push({ resourceType: 'invoice', localId: invoice.id, error: errorMessage(error) })
      await markLinkError(connection.id, 'invoice', invoice.id, error)
    }
  }
  return { results, errors, skipped: 0 }
}

async function pushBills(connection: Awaited<ReturnType<typeof prisma.accountingConnection.findFirst>>, localId?: string | null, limit = MAX_SYNC_ITEMS) {
  if (!connection) return { results: [] as SyncResult[], errors: [] as SyncError[], skipped: 0 }
  const settings = settingsOf(connection)
  if (settings.syncBills !== true) return { results: [] as SyncResult[], errors: [] as SyncError[], skipped: 1 }
  const invoices = await prisma.subInvoice.findMany({
    where: {
      ...(localId ? { id: localId } : {}),
      status: { in: ['received', 'approved'] },
    },
    include: {
      subcontractor: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: { invoiceDate: 'asc' },
    take: limit,
  })
  const results: SyncResult[] = []
  const errors: SyncError[] = []
  for (const invoice of invoices) {
    try {
      const payload = purchaseBillPayload(invoice, settings)
      const hash = payloadHash(payload)
      const link = await prisma.accountingSyncLink.findUnique({
        where: { organizationId_provider_resourceType_localId: { organizationId: connection.organizationId, provider: 'xero', resourceType: 'sub_invoice', localId: invoice.id } },
      })
      if (link?.remoteId && link.payloadHash === hash && link.status === 'synced') continue
      const body = link?.remoteId
        ? await xeroApiRequest(connection, `/Invoices/${encodeURIComponent(link.remoteId)}`, { method: 'POST', body: JSON.stringify(payload) })
        : await xeroApiRequest(connection, '/Invoices', { method: 'PUT', body: JSON.stringify({ Invoices: [payload] }) })
      const remote = firstRemoteInvoice(body)
      const remoteId = String(remote?.InvoiceID || link?.remoteId || '')
      if (!remoteId) throw new Error('Xero did not return an InvoiceID for the bill')
      const remoteNumber = remote?.InvoiceNumber ? String(remote.InvoiceNumber) : invoice.number
      await prisma.accountingSyncLink.upsert({
        where: { organizationId_provider_resourceType_localId: { organizationId: connection.organizationId, provider: 'xero', resourceType: 'sub_invoice', localId: invoice.id } },
        create: { organizationId: connection.organizationId, connectionId: connection.id, provider: 'xero', resourceType: 'sub_invoice', localId: invoice.id, remoteId, remoteNumber, status: 'synced', payloadHash: hash, lastSyncedAt: new Date() },
        update: { connectionId: connection.id, remoteId, remoteNumber, status: 'synced', payloadHash: hash, lastSyncedAt: new Date(), lastError: null },
      })
      results.push({ resourceType: 'sub_invoice', localId: invoice.id, remoteId, remoteNumber, action: link?.remoteId ? 'updated' : 'created' })
    } catch (error) {
      errors.push({ resourceType: 'sub_invoice', localId: invoice.id, error: errorMessage(error) })
      await markLinkError(connection.id, 'sub_invoice', invoice.id, error)
    }
  }
  return { results, errors, skipped: 0 }
}

async function pullStatuses(connection: NonNullable<Awaited<ReturnType<typeof prisma.accountingConnection.findFirst>>>, resourceType?: ResourceType | null, localId?: string | null, limit = MAX_SYNC_ITEMS) {
  const links = await prisma.accountingSyncLink.findMany({
    where: {
      connectionId: connection.id,
      remoteId: { not: null },
      ...(resourceType ? { resourceType } : { resourceType: { in: ['invoice', 'sub_invoice'] } }),
      ...(localId ? { localId } : {}),
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })
  const results: SyncResult[] = []
  const errors: SyncError[] = []
  for (const link of links) {
    const type = link.resourceType as ResourceType
    try {
      const body = await xeroApiRequest(connection, `/Invoices/${encodeURIComponent(link.remoteId!)}`)
      const remote = firstRemoteInvoice(body)
      if (!remote) throw new Error('Xero invoice status response was empty')
      const localStatus = xeroStatusToLocal(remote.Status, type)
      if (localStatus) {
        if (type === 'invoice') {
          const local = await prisma.invoice.findUnique({ where: { id: link.localId }, select: { status: true } })
          if (local) {
            const rank: Record<string, number> = { draft: 0, sent: 1, overdue: 2, paid: 3 }
            if ((rank[localStatus] ?? -1) > (rank[local.status] ?? -1)) {
              await prisma.invoice.update({ where: { id: link.localId }, data: { status: localStatus, ...(localStatus === 'paid' ? { paidDate: new Date() } : {}) } })
            }
          }
        } else {
          const local = await prisma.subInvoice.findUnique({ where: { id: link.localId }, select: { status: true } })
          if (local) {
            const rank: Record<string, number> = { received: 0, approved: 1, paid: 2, disputed: 3 }
            if ((rank[localStatus] ?? -1) > (rank[local.status] ?? -1) && local.status !== 'disputed') {
              await prisma.subInvoice.update({ where: { id: link.localId }, data: { status: localStatus, ...(localStatus === 'paid' ? { paidAt: new Date() } : {}) } })
            }
          }
        }
      }
      await prisma.accountingSyncLink.update({ where: { id: link.id }, data: { status: 'synced', lastSyncedAt: new Date(), lastError: null, remoteNumber: remote.InvoiceNumber ? String(remote.InvoiceNumber) : link.remoteNumber } })
      results.push({ resourceType: type, localId: link.localId, remoteId: link.remoteId!, remoteNumber: remote.InvoiceNumber ? String(remote.InvoiceNumber) : link.remoteNumber, action: 'pulled' })
    } catch (error) {
      errors.push({ resourceType: type, localId: link.localId, error: errorMessage(error) })
      await prisma.accountingSyncLink.update({ where: { id: link.id }, data: { status: 'error', lastError: errorMessage(error) } })
    }
  }
  return { results, errors }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!isFinancialAdmin(auth.role)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = ['push', 'pull', 'all'].includes(String(body.action)) ? String(body.action) : 'all'
    const resourceType = ['invoice', 'sub_invoice'].includes(String(body.resourceType)) ? String(body.resourceType) as ResourceType : null
    const localId = body.localId ? String(body.localId) : null
    const requestedLimit = Number(body.limit || MAX_SYNC_ITEMS)
    const limit = Math.min(MAX_SYNC_ITEMS, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : MAX_SYNC_ITEMS))

    const connection = await prisma.accountingConnection.findFirst({ where: { provider: 'xero' } })
    if (!connection || connection.status === 'disconnected' || !connection.externalTenantId) return NextResponse.json({ error: 'Xero is not connected' }, { status: 409 })

    const pushed: SyncResult[] = []
    const pulled: SyncResult[] = []
    const errors: SyncError[] = []
    let skipped = 0

    if (action === 'push' || action === 'all') {
      if (!resourceType || resourceType === 'invoice') {
        const result = await pushSales(connection, resourceType === 'invoice' ? localId : null, limit)
        pushed.push(...result.results); errors.push(...result.errors); skipped += result.skipped
      }
      if (!resourceType || resourceType === 'sub_invoice') {
        const result = await pushBills(connection, resourceType === 'sub_invoice' ? localId : null, limit)
        pushed.push(...result.results); errors.push(...result.errors); skipped += result.skipped
      }
    }
    if (action === 'pull' || action === 'all') {
      const result = await pullStatuses(connection, resourceType, localId, limit)
      pulled.push(...result.results); errors.push(...result.errors)
    }

    const status = errors.length ? (pushed.length || pulled.length ? 'partial' : 'error') : 'ok'
    const errorSummary = errors.length ? errors.slice(0, 5).map(item => `${item.resourceType}:${item.localId} ${item.error}`).join(' | ').slice(0, 3000) : null
    await prisma.accountingConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: status, lastSyncError: errorSummary, status: status === 'error' ? 'error' : 'connected' },
    })
    auditLog({ action: 'accounting.xero.sync', resourceType: 'AccountingConnection', resourceId: connection.id, metadata: { action, resourceType, localId, pushed: pushed.length, pulled: pulled.length, errors: errors.length, skipped }, ...requestMeta(req) })
    return NextResponse.json({ status, pushed, pulled, errors, skipped })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Xero sync failed' }, { status: 502 })
  }
}

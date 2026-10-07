import { NextRequest, NextResponse } from 'next/server'
import type { AccountingConnection } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { xeroApiRequest } from '@/lib/xero-server'
import xeroWriteback from '@/lib/xero-writeback'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const {
  clientInvoicePayload,
  subInvoicePayload,
  paymentPayload,
  contactNumber,
  payloadHash,
  idempotencyKey,
  recoverPaymentId,
  money,
  missingWriteScopes,
  writebackMapping,
} = xeroWriteback

type EntityType = 'client_invoice' | 'sub_invoice'

function admin(auth: { role: string | null }) {
  return !!auth.role && canManage(auth.role)
}

function xeroWhereLiteral(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

async function connectedXero(organizationId: string) {
  const connection = await prisma.accountingConnection.findFirst({ where: { organizationId, provider: 'xero' } })
  if (!connection || connection.status !== 'connected' || !connection.externalTenantId) throw new Error('Xero is not connected')
  const missingScopes = missingWriteScopes(connection.scopes)
  if (missingScopes.length) throw new Error(`Reconnect Xero to grant: ${missingScopes.join(', ')}`)
  return connection
}

async function contactIdFor(
  connection: AccountingConnection,
  entityType: EntityType,
  contactKey: string,
  name: string,
  email?: string | null,
) {
  const number = contactNumber(entityType, contactKey)
  const where = encodeURIComponent(`ContactNumber=="${xeroWhereLiteral(number)}"`)
  const existing = await xeroApiRequest(connection, `/Contacts?where=${where}`)
  const contacts = Array.isArray(existing.Contacts) ? existing.Contacts as Array<Record<string, unknown>> : []
  const found = contacts.find(contact => contact.ContactID)
  if (found?.ContactID) return String(found.ContactID)

  const created = await xeroApiRequest(connection, '/Contacts', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey(connection.id, 'contact', number) },
    body: JSON.stringify({
      Contacts: [{
        Name: name.slice(0, 255),
        ContactNumber: number,
        ...(email ? { EmailAddress: email.slice(0, 255) } : {}),
      }],
    }),
  })
  const rows = Array.isArray(created.Contacts) ? created.Contacts as Array<Record<string, unknown>> : []
  const id = rows[0]?.ContactID
  if (!id) throw new Error('Xero contact creation returned no ContactID')
  return String(id)
}

async function remoteInvoiceByNumber(connection: AccountingConnection, number: string, entityType: EntityType) {
  const type = entityType === 'client_invoice' ? 'ACCREC' : 'ACCPAY'
  const where = encodeURIComponent(`InvoiceNumber=="${xeroWhereLiteral(number)}" AND Type=="${type}"`)
  const body = await xeroApiRequest(connection, `/Invoices?where=${where}`)
  const rows = Array.isArray(body.Invoices) ? body.Invoices as Array<Record<string, unknown>> : []
  if (rows.length > 1) throw new Error('Multiple Xero invoices share this number; manual reconciliation required')
  return rows.find(row => row.InvoiceID) || null
}

async function recoverRemotePayment(connection: AccountingConnection, invoiceId: string, expected: ReturnType<typeof paymentPayload>) {
  const body = await xeroApiRequest(connection, `/Invoices/${encodeURIComponent(invoiceId)}`)
  const rows = Array.isArray(body.Invoices) ? body.Invoices as Array<Record<string, unknown>> : []
  const invoice = rows[0]
  if (!invoice || invoice.InvoiceID !== invoiceId) throw new Error('Xero invoice details unavailable; manual reconciliation required')
  if (!Array.isArray(invoice.Payments) && money(invoice.AmountPaid) !== 0) {
    throw new Error('Xero payment history unavailable; manual reconciliation required')
  }
  const summaries = invoice && Array.isArray(invoice.Payments) ? invoice.Payments as Array<Record<string, unknown>> : []
  const candidates = summaries.filter(payment => money(payment.Amount) === expected.Amount && payment.Status !== 'DELETED')
  if (candidates.length > 10) throw new Error('Too many candidate Xero payments; manual reconciliation required')
  const payments = []
  for (const summary of candidates) {
    if (!summary.PaymentID) throw new Error('Xero payment is missing its identity; manual reconciliation required')
    const detail = await xeroApiRequest(connection, `/Payments/${encodeURIComponent(String(summary.PaymentID))}`)
    const records = Array.isArray(detail.Payments) ? detail.Payments as Array<Record<string, unknown>> : []
    const payment = records.find(row => row.PaymentID === summary.PaymentID)
    if (!payment) throw new Error('Xero payment details unavailable; manual reconciliation required')
    payments.push(payment)
  }
  return recoverPaymentId(payments, expected)
}

async function entityData(entityType: EntityType, entityId: string, organizationId: string) {
  if (entityType === 'client_invoice') {
    const invoice = await prisma.invoice.findFirst({
      where: { id: entityId, organizationId },
      include: { project: { select: { name: true } } },
    })
    if (!invoice) throw new Error('Client invoice not found')
    const normalizedClient = invoice.clientName.trim().toLowerCase().replace(/\s+/g, ' ')
    return {
      entity: invoice,
      contactKey: 'client:' + normalizedClient,
      contactName: invoice.clientName,
      contactEmail: null,
      paid: invoice.status === 'paid',
      paidAt: invoice.paidDate,
      paymentAmount: invoice.amount,
      reference: invoice.number,
    }
  }

  const invoice = await prisma.subInvoice.findFirst({
    where: { id: entityId, organizationId },
    include: {
      project: { select: { name: true } },
      subcontractor: { select: { id: true, name: true, contactEmail: true } },
    },
  })
  if (!invoice) throw new Error('Subcontract invoice not found')
  return {
    entity: invoice,
    contactKey: 'subcontractor:' + invoice.subcontractor.id,
    contactName: invoice.subcontractor.name,
    contactEmail: invoice.subcontractor.contactEmail,
    paid: invoice.status === 'paid',
    paidAt: invoice.paidAt,
    paymentAmount: invoice.payableAmount,
    reference: invoice.number,
  }
}

function previewPayload(entityType: EntityType, entity: unknown, mapping: ReturnType<typeof writebackMapping>) {
  return entityType === 'client_invoice'
    ? clientInvoicePayload(entity, mapping, 'PREVIEW_CONTACT_ID')
    : subInvoicePayload(entity, mapping, 'PREVIEW_CONTACT_ID')
}

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  if (!admin(auth)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const parsedTake = Number.parseInt(searchParams.get('take') || '30', 10)
    const take = Math.max(1, Math.min(Number.isNaN(parsedTake) ? 30 : parsedTake, 100))
    const clientSkip = Math.max(0, Number.parseInt(searchParams.get('clientSkip') || '0', 10) || 0)
    const subSkip = Math.max(0, Number.parseInt(searchParams.get('subSkip') || '0', 10) || 0)
    const connection = await prisma.accountingConnection.findFirst({ where: { organizationId: auth.orgId, provider: 'xero' } })
    if (!connection) return NextResponse.json({ connection: null, items: [], pagination: { take, clientSkip: 0, subSkip: 0, hasMore: false, total: 0 } })

    const mapping = writebackMapping(connection.settings)
    const missingScopes = missingWriteScopes(connection.scopes)
    const [clientInvoices, subInvoices, clientTotal, subTotal] = await Promise.all([
      prisma.invoice.findMany({ where: { organizationId: auth.orgId }, orderBy: { issuedDate: 'desc' }, take, skip: clientSkip, include: { project: { select: { name: true } } } }),
      prisma.subInvoice.findMany({
        where: { organizationId: auth.orgId },
        orderBy: { invoiceDate: 'desc' },
        take,
        skip: subSkip,
        include: { project: { select: { name: true } }, subcontractor: { select: { name: true } } },
      }),
      prisma.invoice.count({ where: { organizationId: auth.orgId } }),
      prisma.subInvoice.count({ where: { organizationId: auth.orgId } }),
    ])
    const clientIds = clientInvoices.map(row => row.id)
    const subIds = subInvoices.map(row => row.id)
    const writebacks = clientIds.length || subIds.length
      ? await prisma.accountingWriteback.findMany({
          where: {
            connectionId: connection.id,
            OR: [
              ...(clientIds.length ? [{ entityType: { in: ['client_invoice', 'client_invoice_payment'] }, entityId: { in: clientIds } }] : []),
              ...(subIds.length ? [{ entityType: { in: ['sub_invoice', 'sub_invoice_payment'] }, entityId: { in: subIds } }] : []),
            ],
          },
        })
      : []
    const byKey = new Map(writebacks.map(row => [row.entityType + ':' + row.entityId, row]))
    const item = (entityType: EntityType, row: any) => {
      let blocker: string | null = null
      let currentHash: string | null = null
      try { currentHash = payloadHash(previewPayload(entityType, row, mapping)) } catch (error) { blocker = error instanceof Error ? error.message : 'Not ready' }
      const writeback = byKey.get(entityType + ':' + row.id) || null
      const changedSinceSync = Boolean(writeback?.status === 'synced' && writeback.payloadHash && currentHash && writeback.payloadHash !== currentHash)
      if (changedSinceSync && !blocker) blocker = 'Changed since last Xero sync; reconcile the existing Xero document before another export'
      const paid = row.status === 'paid'
      const paidAt = entityType === 'client_invoice' ? row.paidDate : row.paidAt
      const paymentBlocker = paid && !paidAt
        ? 'Record the paid date before syncing this paid invoice'
        : paid && !mapping.paymentAccountCode
          ? 'Map a Xero payment account before syncing a paid invoice'
          : null
      return {
        entityType,
        entityId: row.id,
        number: row.number,
        counterparty: entityType === 'client_invoice' ? row.clientName : row.subcontractor?.name,
        project: row.project?.name || null,
        date: entityType === 'client_invoice' ? row.issuedDate : row.invoiceDate,
        amount: entityType === 'client_invoice' ? row.amount : row.payableAmount,
        localStatus: row.status,
        blocker,
        paymentBlocker,
        writeback,
        changedSinceSync,
        paymentWriteback: byKey.get(`${entityType}_payment:${row.id}`) || null,
      }
    }

    return NextResponse.json({
      connection: {
        id: connection.id,
        status: connection.status,
        writebackEnabled: mapping.enabled,
        missingScopes,
      },
      mapping,
      items: [
        ...clientInvoices.map(row => item('client_invoice', row)),
        ...subInvoices.map(row => item('sub_invoice', row)),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      pagination: {
        take,
        clientSkip: clientSkip + clientInvoices.length,
        subSkip: subSkip + subInvoices.length,
        clientHasMore: clientSkip + clientInvoices.length < clientTotal,
        subHasMore: subSkip + subInvoices.length < subTotal,
        hasMore: clientSkip + clientInvoices.length < clientTotal || subSkip + subInvoices.length < subTotal,
        total: clientTotal + subTotal,
      },
    })
  } catch (error) {
    reportError(error, { context: 'xero.writeback.queue' })
    return NextResponse.json({ error: 'Failed to load write-back queue' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  if (!admin(auth)) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited

  try {
    const body = await req.json() as Record<string, unknown>
    const entityType = String(body.entityType || '') as EntityType
    const entityId = String(body.entityId || '')
    const dryRun = body.dryRun !== false
    const syncPayment = body.syncPayment === true
    if (!['client_invoice', 'sub_invoice'].includes(entityType) || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    const connection = await connectedXero(auth.orgId)
    const mapping = writebackMapping(connection.settings)
    const data = await entityData(entityType, entityId, auth.orgId)
    const preview = previewPayload(entityType, data.entity, mapping)

    if (data.paid && !syncPayment && !dryRun) {
      return NextResponse.json({ error: 'Paid local invoices must sync their Xero payment in the same governed action' }, { status: 409 })
    }
    if (data.paid && syncPayment && !mapping.paymentAccountCode) {
      return NextResponse.json({ error: 'Map a Xero payment account before syncing a paid invoice' }, { status: 409 })
    }

    // Validate all payment data before any external contact or invoice mutation.
    if (syncPayment && data.paid) {
      try {
        paymentPayload({ invoiceId: 'PREVIEW_INVOICE_ID', amount: data.paymentAmount, paidAt: data.paidAt, reference: data.reference, accountCode: mapping.paymentAccountCode })
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid local payment' }, { status: 409 })
      }
    }

    if (dryRun) {
      auditLog({
        action: 'accounting.xero.writeback_preview',
        resourceType: entityType,
        resourceId: entityId,
        metadata: { payloadHash: payloadHash(preview), syncPayment },
        ...requestMeta(req),
      })
      return NextResponse.json({
        dryRun: true,
        payload: preview,
        paymentReady: !data.paid || Boolean(mapping.paymentAccountCode),
        requiresPayment: data.paid,
      })
    }

    if (!mapping.enabled) return NextResponse.json({ error: 'Xero write-back is not enabled for this company' }, { status: 409 })

    const hash = payloadHash(previewPayload(entityType, data.entity, mapping))
    const key = { connectionId: connection.id, entityType, entityId }

    const existing = await prisma.accountingWriteback.findUnique({
      where: { connectionId_entityType_entityId: key },
    })
    if (existing?.payloadHash && existing.payloadHash !== hash) {
      return NextResponse.json({
        error: 'This record changed since its Xero write was attempted. Automatic overwrite is blocked; reconcile the Xero record before retrying.',
        externalId: existing.externalId,
      }, { status: 409 })
    }

    let xeroInvoiceId = existing?.externalId || null
    if (!xeroInvoiceId) {
      const remote = await remoteInvoiceByNumber(connection, String(data.entity.number), entityType)
      if (remote?.InvoiceID) {
        const expectedReference = `Cortexx:${entityId}`
        if (String(remote.Reference || '') !== expectedReference) {
          return NextResponse.json({
            error: `Xero already has invoice number ${data.entity.number} with a different origin. Change the Cortexx invoice number or reconcile manually.`,
          }, { status: 409 })
        }
        xeroInvoiceId = String(remote.InvoiceID)
      }
    }

    const invoiceWriteback = await prisma.accountingWriteback.upsert({
      where: { connectionId_entityType_entityId: key },
      create: {
        organizationId: auth.orgId,
        connectionId: connection.id,
        entityType,
        entityId,
        externalId: xeroInvoiceId,
        payloadHash: hash,
        status: xeroInvoiceId ? 'synced' : 'pending',
        lastAttemptAt: new Date(),
        ...(xeroInvoiceId ? { syncedAt: new Date() } : {}),
      },
      update: xeroInvoiceId
        ? { externalId: xeroInvoiceId, payloadHash: hash, status: 'synced', lastError: null, lastAttemptAt: new Date(), syncedAt: new Date() }
        : { payloadHash: hash, lastError: null },
    })

    if (!xeroInvoiceId) {
      const claim = await prisma.accountingWriteback.updateMany({
        where: { id: invoiceWriteback.id, status: { in: ['pending', 'error'] } },
        data: { status: 'in_flight', lastError: null, lastAttemptAt: new Date() },
      })
      if (claim.count !== 1) return NextResponse.json({ error: 'This Xero write-back is already in progress; retry after it completes' }, { status: 409 })
      try {
        const contactId = await contactIdFor(connection, entityType, data.contactKey, data.contactName, data.contactEmail)
        const payload = entityType === 'client_invoice'
          ? clientInvoicePayload(data.entity, mapping, contactId)
          : subInvoicePayload(data.entity, mapping, contactId)
        const created = await xeroApiRequest(connection, '/Invoices', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey(connection.id, entityType, entityId) }, body: JSON.stringify({ Invoices: [payload] }) })
        const rows = Array.isArray(created.Invoices) ? created.Invoices as Array<Record<string, unknown>> : []
        const createdId = rows[0]?.InvoiceID
        if (!createdId) throw new Error('Xero invoice creation returned no InvoiceID')
        xeroInvoiceId = String(createdId)
        await prisma.accountingWriteback.update({
          where: { connectionId_entityType_entityId: key },
          data: { externalId: xeroInvoiceId, status: 'synced', syncedAt: new Date(), lastError: null },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1800) : 'Xero invoice write-back failed'
        await prisma.accountingWriteback.update({
          where: { connectionId_entityType_entityId: key },
          data: { status: 'error', lastError: message, lastAttemptAt: new Date() },
        }).catch(() => undefined)
        throw error
      }
    }

    let payment: unknown = null
    if (syncPayment && data.paid) {
      const paymentType = `${entityType}_payment`
      const paymentBody = paymentPayload({
        invoiceId: xeroInvoiceId,
        amount: data.paymentAmount,
        paidAt: data.paidAt,
        reference: data.reference,
        accountCode: mapping.paymentAccountCode,
      })
      const paymentHash = payloadHash(paymentBody)
      const paymentKey = { connectionId: connection.id, entityType: paymentType, entityId }
      const priorPayment = await prisma.accountingWriteback.findUnique({
        where: { connectionId_entityType_entityId: paymentKey },
      })

      if (priorPayment?.payloadHash && priorPayment.payloadHash !== paymentHash) {
        return NextResponse.json({
          error: 'The local payment changed since its Xero write was attempted. Automatic overwrite is blocked.',
          externalId: priorPayment.externalId,
        }, { status: 409 })
      }
      if (priorPayment?.status === 'synced') {
        if (!priorPayment.externalId) throw new Error('Synced Xero payment has no PaymentID; manual reconciliation required')
        payment = priorPayment
      } else {
        const recoveredPaymentId = await recoverRemotePayment(connection, xeroInvoiceId, paymentBody)
        if (recoveredPaymentId) {
          payment = await prisma.accountingWriteback.upsert({
            where: { connectionId_entityType_entityId: paymentKey },
            create: {
              organizationId: auth.orgId,
              connectionId: connection.id,
              entityType: paymentType,
              entityId,
              externalId: recoveredPaymentId,
              payloadHash: paymentHash,
              status: 'synced',
              lastAttemptAt: new Date(),
              syncedAt: new Date(),
            },
            update: {
              externalId: recoveredPaymentId,
              payloadHash: paymentHash,
              status: 'synced',
              lastError: null,
              lastAttemptAt: new Date(),
              syncedAt: new Date(),
            },
          })
        } else {
          const paymentWriteback = await prisma.accountingWriteback.upsert({
            where: { connectionId_entityType_entityId: paymentKey },
            create: {
              organizationId: auth.orgId,
              connectionId: connection.id,
              entityType: paymentType,
              entityId,
              payloadHash: paymentHash,
              status: 'pending',
              lastAttemptAt: new Date(),
            },
            update: { payloadHash: paymentHash, lastError: null },
          })
          const paymentClaim = await prisma.accountingWriteback.updateMany({
            where: { id: paymentWriteback.id, status: { in: ['pending', 'error'] } },
            data: { status: 'in_flight', lastError: null, lastAttemptAt: new Date() },
          })
          if (paymentClaim.count !== 1) return NextResponse.json({ error: 'This Xero payment write-back is already in progress; retry after it completes' }, { status: 409 })

          try {
            const response = await xeroApiRequest(connection, '/Payments', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey(connection.id, paymentType, entityId) }, body: JSON.stringify({ Payments: [paymentBody] }) })
            const payments = Array.isArray(response.Payments) ? response.Payments as Array<Record<string, unknown>> : []
            const externalPaymentId = payments[0]?.PaymentID ? String(payments[0].PaymentID) : null
            if (!externalPaymentId) throw new Error('Xero payment creation returned no PaymentID')
            payment = await prisma.accountingWriteback.update({
              where: { connectionId_entityType_entityId: paymentKey },
              data: {
                externalId: externalPaymentId,
                status: 'synced',
                lastError: null,
                lastAttemptAt: new Date(),
                syncedAt: new Date(),
              },
            })
          } catch (error) {
            const message = error instanceof Error ? error.message.slice(0, 1800) : 'Xero payment write-back failed'
            await prisma.accountingWriteback.update({
              where: { connectionId_entityType_entityId: paymentKey },
              data: { status: 'error', lastError: message, lastAttemptAt: new Date() },
            }).catch(() => undefined)
            throw error
          }
        }
      }
    }

    const writeback = await prisma.accountingWriteback.findUnique({
      where: { connectionId_entityType_entityId: key },
    })

    auditLog({
      action: 'accounting.xero.writeback',
      resourceType: entityType,
      resourceId: entityId,
      metadata: { externalId: xeroInvoiceId, payloadHash: hash, paymentSynced: Boolean(payment) },
      ...requestMeta(req),
    })
    return NextResponse.json({ status: 'synced', writeback, payment })
  } catch (error) {
    reportError(error, { context: 'xero.writeback' })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Xero write-back failed' }, { status: 502 })
  }
}

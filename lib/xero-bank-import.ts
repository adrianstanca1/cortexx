import { prisma } from './db'
import type { NormalizedXeroBankTransaction } from './xero-adapter'

export type XeroBankImportCounts = { created: number; updated: number; unchanged: number }

function sameDate(a: Date | null, b: Date) { return !!a && a.getTime() === b.getTime() }

export async function upsertXeroBankTransactions(connectionId: string, rows: NormalizedXeroBankTransaction[]): Promise<XeroBankImportCounts> {
  let created = 0
  let updated = 0
  let unchanged = 0
  for (const item of rows) {
    const existing = await prisma.bankTransaction.findFirst({ where: { source: 'xero', externalId: item.externalId } })
    if (!existing) {
      await prisma.bankTransaction.create({
        data: {
          source: 'xero', externalId: item.externalId, connectionId,
          accountName: item.accountName, occurredAt: item.occurredAt, amount: item.amount, currency: item.currency,
          description: item.description, reference: item.reference, status: 'unmatched', reconciled: false,
        },
      })
      created += 1
      continue
    }
    const changed = existing.connectionId !== connectionId || existing.accountName !== item.accountName || !sameDate(existing.occurredAt, item.occurredAt)
      || Number(existing.amount) !== item.amount || existing.currency !== item.currency || existing.description !== item.description || existing.reference !== item.reference
    if (!changed) { unchanged += 1; continue }
    await prisma.bankTransaction.update({
      where: { id: existing.id },
      data: {
        connectionId, accountName: item.accountName, occurredAt: item.occurredAt,
        amount: item.amount, currency: item.currency, description: item.description, reference: item.reference,
        // Never write status/reconciled/matchedInvoiceId: those are Cortexx reconciliation decisions.
      },
    })
    updated += 1
  }
  return { created, updated, unchanged }
}

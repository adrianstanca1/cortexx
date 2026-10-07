export const WRITE_SCOPES: readonly string[]
export function money(value: unknown): number | null
export function writebackMapping(settings: unknown): {
  enabled: boolean
  salesAccountCode: string
  salesTaxType: string
  purchaseAccountCode: string
  purchaseTaxType: string
  paymentAccountCode: string
}
export function missingWriteScopes(scopes: string | null | undefined): string[]
export function validateGrossBreakdown(input: { amount: unknown; netAmount: unknown; vatAmount: unknown; vatRate?: unknown }): { ok: boolean; error?: string; gross?: number; net?: number; vat?: number }
export function clientInvoicePayload(invoice: any, mapping: any, contactId: string): any
export function subInvoicePayload(invoice: any, mapping: any, contactId: string): any
export function paymentPayload(input: { invoiceId: string; amount: unknown; paidAt?: string | Date | null; reference?: string; accountCode: string }): any
export function contactNumber(entityType: string, entityId: string): string
export function payloadHash(payload: unknown): string
export function idempotencyKey(connectionId: string, entityType: string, entityId: string): string
export function recoverPaymentId(payments: Array<Record<string, any>>, expected: any): string | null
declare const api: {
  WRITE_SCOPES: typeof WRITE_SCOPES
  money: typeof money
  writebackMapping: typeof writebackMapping
  missingWriteScopes: typeof missingWriteScopes
  validateGrossBreakdown: typeof validateGrossBreakdown
  clientInvoicePayload: typeof clientInvoicePayload
  subInvoicePayload: typeof subInvoicePayload
  paymentPayload: typeof paymentPayload
  contactNumber: typeof contactNumber
  payloadHash: typeof payloadHash
  idempotencyKey: typeof idempotencyKey
  recoverPaymentId: typeof recoverPaymentId
}
export default api

export const XERO_SCOPES: readonly string[]
export function buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; scopes?: readonly string[] }): string
export function decodeJwtPayload(token: string): Record<string, unknown>
export function selectAuthorizedConnection(connections: any[], accessToken: string, existingTenantId?: string | null): any | null
export function salesInvoicePayload(invoice: any, settings?: Record<string, unknown>): Record<string, unknown>
export function purchaseBillPayload(invoice: any, settings?: Record<string, unknown>): Record<string, unknown>
export function payloadHash(payload: unknown): string
export function xeroStatusToLocal(status: unknown, resourceType: 'invoice' | 'sub_invoice'): string | null

declare const api: {
  XERO_SCOPES: typeof XERO_SCOPES
  buildAuthorizeUrl: typeof buildAuthorizeUrl
  decodeJwtPayload: typeof decodeJwtPayload
  selectAuthorizedConnection: typeof selectAuthorizedConnection
  salesInvoicePayload: typeof salesInvoicePayload
  purchaseBillPayload: typeof purchaseBillPayload
  payloadHash: typeof payloadHash
  xeroStatusToLocal: typeof xeroStatusToLocal
}
export default api

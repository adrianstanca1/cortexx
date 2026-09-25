export type NormalizedXeroBankTransaction = {
  externalId: string
  occurredAt: Date
  amount: number
  currency: string
  description: string
  reference: string
  accountName: string | null
}
export const XERO_SCOPES: readonly string[]
export function buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; scopes?: readonly string[] }): string
export function decodeJwtPayload(token: string): Record<string, unknown>
export function selectAuthorizedConnection(connections: any[], accessToken: string, existingTenantId?: string | null): any | null
export function parseXeroDate(value: unknown): Date | null
export function xeroBankAmount(transaction: any): number | null
export function normalizeXeroBankTransaction(transaction: any): NormalizedXeroBankTransaction | null
export function bankTransactionsFromResponse(body: any): NormalizedXeroBankTransaction[]
declare const api: {
  XERO_SCOPES: typeof XERO_SCOPES
  buildAuthorizeUrl: typeof buildAuthorizeUrl
  decodeJwtPayload: typeof decodeJwtPayload
  selectAuthorizedConnection: typeof selectAuthorizedConnection
  parseXeroDate: typeof parseXeroDate
  xeroBankAmount: typeof xeroBankAmount
  normalizeXeroBankTransaction: typeof normalizeXeroBankTransaction
  bankTransactionsFromResponse: typeof bankTransactionsFromResponse
}
export default api

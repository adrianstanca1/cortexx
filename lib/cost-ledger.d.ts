export type CostAmounts = { netAmount: number; vatAmount: number; grossAmount: number }
export type CostBreakdown = { costCodeId: string | null; code: string; name: string; actualNet: number; openCommitments: number; forecastNet: number }
declare const api: {
  money(value: unknown): number
  receiptPosting(receipt?: Record<string, unknown>): CostAmounts
  subInvoicePosting(invoice?: Record<string, unknown>): CostAmounts
  costControlSummary(input?: { entries?: any[]; purchaseOrders?: any[]; subInvoices?: any[] }): {
    actualNet: number; actualVat: number; actualGross: number; uncodedNet: number; committedNet: number; openCommitments: number; forecastNet: number; codedPct: number; breakdown: CostBreakdown[]
  }
}
export default api

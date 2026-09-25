declare const procurementRfq: {
  money(value: unknown): number
  normalizeProcurementItems(raw: unknown, options?: { requirePrice?: boolean }): any[]
  alignQuoteItems(requestedRaw: unknown, quotedRaw: unknown): any[]
  quoteTotals(lineItems: any[], vatRate?: number): { netAmount: number; vatRate: number; vatAmount: number; totalAmount: number }
  canTransitionRequisition(from: string, to: string, isManager: boolean): boolean
  compareSupplierQuotes(quotes: any[]): any[]
}
export = procurementRfq

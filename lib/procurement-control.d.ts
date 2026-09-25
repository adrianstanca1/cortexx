declare const procurementControl: {
  money(value: unknown): number
  canTransitionPurchaseOrder(from: string, to: string, isManager: boolean): boolean
  receiptValue(poLineItems: any[], receiptLines: any[], previousReceipts?: any[]): { lineItems: any[]; netReceived: number; fullyReceived: boolean }
  evaluateThreeWayMatch(input?: { orderedNet?: unknown; receivedNet?: unknown; previousApprovedNet?: unknown; invoiceNet?: unknown; toleranceAbs?: unknown; tolerancePct?: unknown }): {
    status: "matched" | "pending_delivery" | "over_order" | "over_received" | "invalid"
    orderedNet: number; receivedNet: number; previousApprovedNet: number; invoiceNet: number; cumulativeInvoiceNet: number; orderVariance: number; receiptVariance: number; tolerance: number
  }
  countsAsCommitment(status: string): boolean
}
export = procurementControl

declare const api: {
  money(value: unknown): number
  allocationSummary(transactionAmount: unknown, allocations?: Array<{ amount?: number | null }>): { total: number; allocated: number; remaining: number; overAllocated: number; status: 'unmatched' | 'partial' | 'reconciled' }
  directionForAmount(amount: unknown): 'credit' | 'debit' | 'zero'
  targetAllowed(amount: unknown, targetType: string): boolean
  outstanding(targetAmount: unknown, allocations?: Array<{ amount?: number | null }>): number
}
export default api

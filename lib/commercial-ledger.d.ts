declare const ledger: {
  roundMoney(value: number): number
  calculateCertificate(input: { grossToDate: number; retentionPct: number; previousCertified: number; retentionRelease?: number }): {
    grossToDate: number; retentionPct: number; retentionAmount: number; previousCertified: number; retentionRelease: number; amountCertified: number
  }
  paymentSummary(amountCertified: number, payments: Array<{ amount: number }>): { paid: number; outstanding: number; settled: boolean }
  certificateNumber(applicationNumber: number, revision: number): string
}
export default ledger

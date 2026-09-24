interface ExportValuation {
  project: { name: string; clientName: string }
  applicationNumber: number; periodEnd: Date | string; status: string; grossToDate: number; retentionAmount: number; previousCertified: number; netDue: number; notes: string | null
  certificates: Array<{ status: string; certificateNumber: string; amountCertified: number; dueDate: Date | string | null; payments: Array<{ amount: number }> }>
}
declare const exporter: { csvCell(value: unknown): string; csvHeader: string; valuationCsvRow(value: ExportValuation): string }
export default exporter

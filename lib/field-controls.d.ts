export type ProductionMetrics = {
  plannedQty: number
  installedQty: number
  labourHours: number
  varianceQty: number
  completionPct: number | null
  qtyPerLabourHour: number | null
  labourHoursPerUnit: number | null
}
declare const api: {
  cleanText(value: unknown, max?: number): string
  normalizeNonNegative(value: unknown, max?: number): number | null
  productionMetrics(plannedQty: unknown, installedQty: unknown, labourHours: unknown): ProductionMetrics
  sanitizeOpenItems(raw: unknown): Array<{ id: string; title: string; owner: string | null; dueDate: string | null; status: string }>
  sanitizeEvidence(raw: unknown): { photoUrls: string[]; signatureUrl: string | null; signedBy: string | null; condition: string | null; storageLocation: string | null }
  initialReleaseStatus(pointType: string): string
  canCompletePoint(pointType: string, releaseStatus: string): boolean
  canTransitionConstraintStatus(from: string, to: string): boolean
}
export default api

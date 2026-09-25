export type ProgrammeBaselineSnapshot = {
  version: number
  capturedAt: string | null
  activities: Array<Record<string, unknown>>
  dependencies: Array<Record<string, unknown>>
}
declare const api: {
  buildBaselineSnapshot(activities?: any[], dependencies?: any[], capturedAt?: Date | string): ProgrammeBaselineSnapshot
  canTransitionDelayStatus(from: string, to: string): boolean
  normalizeDelayDays(value: unknown): number | null
}
export default api

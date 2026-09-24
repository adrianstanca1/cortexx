declare const api: {
  RIDDOR_STATUSES: Set<string>
  riddorReviewRequired(type: string, severity: string): boolean
  initialRiddorStatus(type: string, severity: string, explicitReportable?: boolean): string
  closeoutReadiness(incident: Record<string, unknown>, actions?: Array<Record<string, unknown>>): { ready: boolean; missing: string[] }
}
export default api

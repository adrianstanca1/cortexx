export type CloseoutEvidence = {
  photoUrls: string[]
  signatureUrl: string | null
  signedBy: string | null
  condition: string | null
  storageLocation: string | null
}
declare const api: {
  snagCloseoutReadiness(input?: Record<string, unknown>): { ready: boolean; missing: string[]; resolution: string; evidence: CloseoutEvidence }
  inspectionPassReadiness(input?: Record<string, unknown>): { ready: boolean; missing: string[]; evidence: CloseoutEvidence; isFailureCloseout: boolean }
}
export default api

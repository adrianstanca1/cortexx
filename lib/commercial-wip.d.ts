declare const api: {
  money(value: unknown): number
  commercialSummary(input: Record<string, any>): Record<string, number>
}
export default api

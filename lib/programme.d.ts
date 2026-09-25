export type ProgrammeLike = { id: string; plannedStart: string | Date; plannedEnd: string | Date; status?: string; progress?: number }
export type ProgrammeDependencyLike = { id?: string; predecessorId: string; successorId: string; type?: string; lagDays?: number }
declare const api: {
  DAY_MS: number
  daysBetween(start: string | Date, end: string | Date): number
  calculateCriticalPath(activities?: ProgrammeLike[], dependencies?: ProgrammeDependencyLike[]): any
  dependencyViolations(activities?: ProgrammeLike[], dependencies?: ProgrammeDependencyLike[]): any[]
  programmeSummary(activities?: ProgrammeLike[], dependencies?: ProgrammeDependencyLike[], options?: { now?: string | Date; lookaheadDays?: number }): any
  wouldCreateCycle(activities: ProgrammeLike[], dependencies: ProgrammeDependencyLike[], candidate: ProgrammeDependencyLike): boolean
}
export default api

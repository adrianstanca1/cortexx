export type AttendanceIssue = 'missing_checkout' | 'missing_time' | 'time_without_attendance' | 'variance'
export type AttendanceRow = {
  key: string
  memberId: string | null
  memberName: string
  projectId: string | null
  projectName: string
  date: string
  observedHours: number
  loggedHours: number
  varianceHours: number
  openCheckins: number
  checkinIds: string[]
  timeEntryIds: string[]
  approvedAny: boolean
  issues: AttendanceIssue[]
  status: 'matched' | 'exception'
  canApplyAttendance: boolean
}
declare const api: {
  moneyHours(value: unknown): number
  dateKey(value: string | Date): string | null
  hoursBetween(start: string | Date, end: string | Date): number
  isoWeek(date: Date): { week: number; year: number }
  isoWeekRange(week: number, year: number): { start: Date; end: Date }
  buildAttendanceReconciliation(input?: { checkins?: any[]; timeEntries?: any[]; varianceThreshold?: number }): AttendanceRow[]
}
export default api

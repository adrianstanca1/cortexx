export type ResourceConflict = { type: 'labour_overlap' | 'equipment_overlap'; date: string; resourceId: string | null; resourceName: string; activityIds: string[] }
export type ResourceDay = { date: string; labourPeople: number; labourHours: number; equipmentUnits: number; materialNeeds: Array<{ allocationId: string; materialId: string | null; label: string; quantity: number; unit: string }> }
declare const api: {
  round(value: unknown): number
  dayKey(value: string | Date): string | null
  eachDay(start: string | Date, end: string | Date, maxDays?: number): string[]
  buildResourceLoad(input?: { activities?: any[]; allocations?: any[] }): { daily: ResourceDay[]; conflicts: ResourceConflict[]; materialShortages: any[]; peakLabourPeople: number; peakLabourHours: number; peakEquipmentUnits: number; totalAllocations: number }
}
export default api

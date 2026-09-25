interface PerformanceOrder {
  id: string; number: string; status: string; subtotal: number;
  expectedDelivery?: Date | string | null; receivedAt?: Date | string | null;
  goodsReceipts?: { netReceived: number; deliveredAt: Date | string }[];
}
interface SupplierPerformance {
  orderCount: number; orderedNet: number; receivedNet: number; outstandingNet: number;
  completed: number; assessed: number; onTime: number; late: number; overdue: number; missingDates: number;
  onTimePercent: number | null;
  orders: { id: string; number: string; status: string; orderedNet: number; receivedNet: number; expectedDelivery: string | null; completedDelivery: string | null; delivery: string }[];
}
declare const performance: { supplierPerformance(orders: PerformanceOrder[], now?: Date): SupplierPerformance }
export type { SupplierPerformance }
export default performance

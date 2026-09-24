export type ReceiptItem = { description: string; quantity: number; unitPrice: number | null; total: number | null }
export type ReceiptExtraction = {
  vendor: string | null
  receiptDate: string | null
  subtotal: number | null
  vatAmount: number | null
  totalAmount: number | null
  currency: string
  category: string
  items: ReceiptItem[]
  confidence: number
  notes: string | null
}
declare const api: {
  CATEGORIES: Set<string>
  parseReceiptVision(raw: string): ReceiptExtraction
  money(value: unknown): number | null
  date(value: unknown): string | null
}
export default api

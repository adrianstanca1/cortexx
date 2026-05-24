export type FinanceInvoiceView = {
  id: string;
  vendor: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  cisDeduction?: number;
  total: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  isCIS: boolean;
};

export type PipelineView = {
  id: string;
  name: string;
  stages: string[];
  enquiryCount: number;
  color: string;
};

export type TenderView = {
  id: string;
  title: string;
  clientName?: string;
  totalValue: number;
  status: string;
  createdAt?: string;
};

const PIPELINE_COLORS = ['#1E3A5F', '#E97316', '#8B5CF6', '#0EA5E9', '#16A34A'];

export function parseNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function parseJsonArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

export function mapInvoiceRows(rows: any[] | undefined, fallback: FinanceInvoiceView[]): FinanceInvoiceView[] {
  if (!rows) return fallback;
  return rows.map((row: any) => ({
    id: String(row.id),
    vendor: row.clientName ?? row.type ?? 'Invoice',
    invoiceNumber: row.invoiceNumber,
    date: row.issueDate ?? row.createdAt?.toISOString?.().slice(0, 10) ?? String(row.createdAt ?? ''),
    subtotal: parseNumber(row.subtotal),
    vatRate: row.vatRate === 'reduced_5' || row.vatRate === 'reduced_5_percent' ? 5
      : row.vatRate === 'zero_0' || row.vatRate === 'zero_rated' || row.vatRate === 'exempt' || row.vatRate === 'reverse_charge' ? 0
      : 20,
    vatAmount: parseNumber(row.vatAmount),
    cisDeduction: parseNumber(row.cisDeductionAmount) || undefined,
    total: parseNumber(row.total),
    status: row.status === 'draft' ? 'pending' : (row.status ?? 'pending'),
    isCIS: Boolean(row.isCisJob),
  }));
}

export function mapPipelineRows(rows: any[] | undefined, fallback: PipelineView[]): PipelineView[] {
  if (!rows) return fallback;
  return rows.map((row: any, index: number) => ({
    id: String(row.id),
    name: row.name,
    stages: parseJsonArray(row.stages, ['New Enquiry', 'Quoted', 'Follow-up', 'Won', 'Lost']),
    enquiryCount: Number(row.enquiryCount ?? 0),
    color: PIPELINE_COLORS[index % PIPELINE_COLORS.length],
  }));
}

export function mapTenderRows(rows: any[] | undefined): TenderView[] {
  if (!rows) return [];
  return rows.map((row: any) => ({
    id: String(row.id),
    title: row.title,
    clientName: row.clientName ?? undefined,
    totalValue: parseNumber(row.totalValue),
    status: row.status ?? 'draft',
    createdAt: row.createdAt ? (row.createdAt.toISOString?.() ?? String(row.createdAt)) : undefined,
  }));
}

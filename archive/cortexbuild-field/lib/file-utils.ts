export function toAbsoluteFileUrl(apiBaseUrl: string, url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return `${apiBaseUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

export function normalizeFileCategory(category: string): 'photo' | 'certificate' | 'payslip' | 'drawing' | 'report' | 'document' | 'other' {
  return category === 'invoice' ? 'document' : (
    ['photo', 'certificate', 'payslip', 'drawing', 'report', 'document', 'other'].includes(category)
      ? category as 'photo' | 'certificate' | 'payslip' | 'drawing' | 'report' | 'document' | 'other'
      : 'other'
  );
}

export type VaultDisplayCategory = 'photo' | 'certificate' | 'payslip' | 'document' | 'report' | 'invoice';

export function getVaultDisplayCategory(category: string, tags: string[] = [], storageKey?: string | null): VaultDisplayCategory {
  const normalized = normalizeFileCategory(category);
  const tagSet = new Set(tags.map(tag => tag.toLowerCase()));
  const isInvoiceByKey = typeof storageKey === 'string' && storageKey.startsWith('invoice/');
  if (category === 'invoice' || isInvoiceByKey || tagSet.has('invoice') || tagSet.has('receipt-scanner')) return 'invoice';
  if (normalized === 'photo' || normalized === 'certificate' || normalized === 'payslip' || normalized === 'report') return normalized;
  return 'document';
}

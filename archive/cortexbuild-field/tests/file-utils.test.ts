import { describe, expect, it } from 'vitest';
import { getVaultDisplayCategory, toAbsoluteFileUrl } from '../lib/file-utils';

describe('file utils', () => {
  it('keeps absolute URLs unchanged', () => {
    expect(toAbsoluteFileUrl('https://api.example', 'https://files.example/a.jpg')).toBe('https://files.example/a.jpg');
  });

  it('prefixes relative storage URLs with the API base URL', () => {
    expect(toAbsoluteFileUrl('https://api.example/', '/storage/photo/a.jpg')).toBe('https://api.example/storage/photo/a.jpg');
  });

  it('returns empty string for missing URL', () => {
    expect(toAbsoluteFileUrl('https://api.example', null)).toBe('');
  });

  it('displays invoice-tagged documents as invoices', () => {
    expect(getVaultDisplayCategory('document', ['invoice', 'vault'])).toBe('invoice');
    expect(getVaultDisplayCategory('invoice', [])).toBe('invoice');
    expect(getVaultDisplayCategory('drawing', [])).toBe('document');
  });

  it('falls back to storage-key prefix when tags are missing', () => {
    expect(getVaultDisplayCategory('document', [], 'invoice/2026-01-01_receipt.pdf')).toBe('invoice');
    expect(getVaultDisplayCategory('document', [], 'document/2026-01-01_other.pdf')).toBe('document');
    expect(getVaultDisplayCategory('document', [], null)).toBe('document');
  });
});

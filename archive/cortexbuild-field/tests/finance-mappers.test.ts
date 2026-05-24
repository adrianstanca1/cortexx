import { describe, expect, it } from 'vitest';
import { mapInvoiceRows, mapPipelineRows, mapTenderRows } from '../lib/finance-mappers';

describe('finance mappers', () => {
  it('maps invoice rows and preserves valid empty responses', () => {
    expect(mapInvoiceRows([], [{ id: 'fallback' } as any])).toEqual([]);

    expect(mapInvoiceRows([{
      id: 3,
      clientName: 'Client Ltd',
      invoiceNumber: 'INV-003',
      issueDate: '2026-04-28',
      subtotal: '1000',
      vatRate: 'standard_20',
      vatAmount: '200',
      cisDeductionAmount: '50',
      total: '1200',
      status: 'approved',
      isCisJob: true,
    }], [])).toEqual([{
      id: '3',
      vendor: 'Client Ltd',
      invoiceNumber: 'INV-003',
      date: '2026-04-28',
      subtotal: 1000,
      vatRate: 20,
      vatAmount: 200,
      cisDeduction: 50,
      total: 1200,
      status: 'approved',
      isCIS: true,
    }]);
  });

  it('maps pipeline rows with parsed stages', () => {
    expect(mapPipelineRows([{ id: 2, name: 'Commercial', stages: '["Lead","Won"]', enquiryCount: 4 }], [])[0]).toMatchObject({
      id: '2',
      name: 'Commercial',
      stages: ['Lead', 'Won'],
      enquiryCount: 4,
    });
  });

  it('maps tender rows into finance tender items', () => {
    expect(mapTenderRows([{ id: 7, title: 'School refurb', totalValue: '12345.50', status: 'draft' }])[0]).toMatchObject({
      id: '7',
      title: 'School refurb',
      totalValue: 12345.5,
      status: 'draft',
    });
  });
});

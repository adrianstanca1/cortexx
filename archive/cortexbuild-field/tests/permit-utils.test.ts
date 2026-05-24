import { describe, expect, it, vi } from 'vitest';
import { buildPermitPayload } from '../lib/permit-utils';

describe('permit utils', () => {
  it('builds a permit payload from the active project and issuer', () => {
    vi.setSystemTime(new Date('2026-04-28T08:00:00.000Z'));

    expect(buildPermitPayload({
      companyId: 5,
      projectId: 12,
      title: '  Hot works in plant room  ',
      type: 'hot_work',
      location: '  Level B1  ',
      issuedBy: 'Sarah Supervisor',
      issuedTo: 'Welding team',
      validHours: 8,
      conditions: '  Fire watch required  ',
      riskLevel: 'high',
    })).toEqual({
      companyId: 5,
      projectId: 12,
      title: 'Hot works in plant room',
      type: 'hot_work',
      location: 'Level B1',
      issuedBy: 'Sarah Supervisor',
      issuedTo: 'Welding team',
      validFrom: '2026-04-28T08:00:00.000Z',
      validTo: '2026-04-28T16:00:00.000Z',
      conditions: 'Fire watch required',
      riskLevel: 'high',
    });

    vi.useRealTimers();
  });
});

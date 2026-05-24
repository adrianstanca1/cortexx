import { describe, expect, it } from 'vitest';
import { mapTimesheetRows, rowsToWeekEntries } from '../lib/timesheet-mappers';

describe('timesheet mappers', () => {
  it('preserves empty live timesheet responses', () => {
    expect(mapTimesheetRows([], [{ id: 'fallback' } as any])).toEqual([]);
  });

  it('maps live timesheet rows into submission view models', () => {
    expect(mapTimesheetRows([{
      id: 9,
      workerName: 'Alice Worker',
      weekStarting: '2026-04-27',
      totalHours: '41.5',
      overtimeHours: '1.5',
      status: 'approved',
      submittedAt: '2026-04-28T12:00:00.000Z',
      approvedBy: 'Manager',
      notes: 'Approved',
    }], [])[0]).toMatchObject({
      id: '9',
      workerName: 'Alice Worker',
      weekStarting: '2026-04-27',
      totalHours: 41.5,
      overtimeHours: 1.5,
      status: 'approved',
      reviewedBy: 'Manager',
    });
  });

  it('expands the current week row into daily entries', () => {
    const entries = rowsToWeekEntries([{
      id: 3,
      workerName: 'Alice Worker',
      projectName: 'Project A',
      weekStarting: '2026-04-27',
      mondayHours: '8',
      tuesdayHours: '7.5',
      wednesdayHours: '0',
      thursdayHours: '0',
      fridayHours: '0',
      saturdayHours: '0',
      sundayHours: '0',
      totalHours: '15.5',
      overtimeHours: '0',
      status: 'submitted',
      notes: 'Partial week',
    }], '2026-04-27');

    expect(entries).toHaveLength(7);
    expect(entries[0]).toMatchObject({ date: '2026-04-27', regularHours: 8, status: 'submitted' });
    expect(entries[1]).toMatchObject({ date: '2026-04-28', regularHours: 7.5, status: 'submitted' });
  });
});

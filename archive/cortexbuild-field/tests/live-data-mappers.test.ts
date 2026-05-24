import { describe, expect, it } from 'vitest';
import { MOCK_INCIDENTS } from '../lib/mock-data';
import { mapIncidentRows } from '../lib/live-data-mappers';

describe('live data mappers', () => {
  it('preserves valid empty incident responses instead of falling back to mocks', () => {
    expect(mapIncidentRows([], true)).toEqual([]);
  });

  it('uses mock incidents only when no live rows are available due to fallback', () => {
    expect(mapIncidentRows(undefined, true)).toEqual(MOCK_INCIDENTS);
  });

  it('maps live incident rows into app incident shape', () => {
    const [incident] = mapIncidentRows([
      {
        id: 7,
        projectId: 3,
        title: 'Trip hazard',
        description: null,
        severity: 'high',
        status: 'open',
        location: 'Level 2',
        reportedBy: 'A. Worker',
        photoUrls: '["https://files.example/incident.jpg"]',
        createdAt: '2026-04-28T10:00:00.000Z',
      },
    ], false);

    expect(incident).toMatchObject({
      id: '7',
      projectId: '3',
      title: 'Trip hazard',
      description: '',
      severity: 'high',
      status: 'open',
      location: 'Level 2',
      reportedBy: 'A. Worker',
      photoUrls: ['https://files.example/incident.jpg'],
    });
  });
});

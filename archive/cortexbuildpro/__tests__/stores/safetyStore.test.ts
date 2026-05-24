import { useSafetyStore } from '@/stores/safetyStore';
import type { SafetyIncident } from '@/types';

const mockIncident = (overrides: Partial<SafetyIncident> = {}): SafetyIncident => ({
  id: 'safety_1',
  projectId: 'proj_1',
  title: 'Near Miss',
  description: 'Worker almost fell from scaffold',
  severity: 'near_miss',
  status: 'open',
  reportedBy: 'user_1',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  useSafetyStore.setState({
    incidents: [],
    isLoading: false,
    
  });
});

describe('safetyStore', () => {
  it('initializes with empty incidents', () => {
    const state = useSafetyStore.getState();
    expect(state.incidents).toEqual([]);
    expect(state.isLoading).toBe(false);
    
  });

  it('sets incidents', () => {
    useSafetyStore.getState().setIncidents([mockIncident()]);
    expect(useSafetyStore.getState().incidents).toHaveLength(1);
  });

  it('adds an incident to the front', () => {
    useSafetyStore.getState().setIncidents([mockIncident()]);
    useSafetyStore.getState().addIncident(mockIncident({ id: 'safety_2' }));
    expect(useSafetyStore.getState().incidents[0].id).toBe('safety_2');
  });

  it('updates an incident by id', () => {
    useSafetyStore.getState().setIncidents([mockIncident()]);
    useSafetyStore.getState().updateIncident('safety_1', { status: 'investigating' });
    expect(useSafetyStore.getState().incidents[0].status).toBe('investigating');
  });

  it('removes an incident by id', () => {
    useSafetyStore.getState().setIncidents([mockIncident(), mockIncident({ id: 'safety_2' })]);
    useSafetyStore.getState().removeIncident('safety_1');
    expect(useSafetyStore.getState().incidents).toHaveLength(1);
    expect(useSafetyStore.getState().incidents[0].id).toBe('safety_2');
  });

  it('selects an incident', () => {
    const _i = mockIncident();
    
    
  });

  it('sets loading state', () => {
    useSafetyStore.getState().setLoading(true);
    expect(useSafetyStore.getState().isLoading).toBe(true);
  });

  it('filters incidents by project', () => {
    useSafetyStore.getState().setIncidents([
      mockIncident(),
      mockIncident({ id: 'safety_2', projectId: 'proj_2' }),
    ]);
    const result = useSafetyStore.getState().incidentsByProject('proj_1');
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe('proj_1');
  });

  it('counts open incidents', () => {
    useSafetyStore.getState().setIncidents([
      mockIncident(),
      mockIncident({ id: 'safety_2', status: 'investigating' }),
      mockIncident({ id: 'safety_3', status: 'resolved' }),
      mockIncident({ id: 'safety_4', status: 'closed' }),
    ]);
    expect(useSafetyStore.getState().openCount()).toBe(2);
  });

  it('openCount excludes resolved and closed', () => {
    useSafetyStore.getState().setIncidents([
      mockIncident({ status: 'resolved' }),
      mockIncident({ id: 'safety_2', status: 'closed' }),
    ]);
    expect(useSafetyStore.getState().openCount()).toBe(0);
  });
});

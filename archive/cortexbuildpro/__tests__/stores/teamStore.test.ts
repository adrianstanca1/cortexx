import { useTeamStore } from '@/stores/teamStore';
import type { TeamMember } from '@/types';

const mockMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  id: 'member_1',
  orgId: 'org_1',
  userId: 'user_1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'worker',
  trade: 'electrician',
  certifications: ['JIB Gold'],
  hourlyRate: 35,
  ...overrides,
});

beforeEach(() => {
  useTeamStore.setState({
    members: [],
    isLoading: false,
  });
});

describe('teamStore', () => {
  it('initializes with empty members', () => {
    const state = useTeamStore.getState();
    expect(state.members).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('sets members', () => {
    useTeamStore.getState().setMembers([mockMember()]);
    expect(useTeamStore.getState().members).toHaveLength(1);
  });

  it('adds a member to the front', () => {
    useTeamStore.getState().setMembers([mockMember()]);
    useTeamStore.getState().addMember(mockMember({ id: 'member_2' }));
    expect(useTeamStore.getState().members[0].id).toBe('member_2');
  });

  it('updates a member by id', () => {
    useTeamStore.getState().setMembers([mockMember()]);
    useTeamStore.getState().updateMember('member_1', { role: 'foreman' });
    expect(useTeamStore.getState().members[0].role).toBe('foreman');
  });

  it('removes a member by id', () => {
    useTeamStore.getState().setMembers([mockMember(), mockMember({ id: 'member_2' })]);
    useTeamStore.getState().removeMember('member_1');
    expect(useTeamStore.getState().members).toHaveLength(1);
    expect(useTeamStore.getState().members[0].id).toBe('member_2');
  });

  it('sets loading state', () => {
    useTeamStore.getState().setLoading(true);
    expect(useTeamStore.getState().isLoading).toBe(true);
  });

  it('preserves existing members on partial update', () => {
    useTeamStore.getState().addMember(mockMember());
    useTeamStore.getState().updateMember('member_1', { certifications: ['NICIEC'] });
    const member = useTeamStore.getState().members[0];
    expect(member.certifications).toEqual(['NICIEC']);
    expect(member.trade).toBe('electrician'); // unchanged
  });
});

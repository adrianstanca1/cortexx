import { useAuthStore } from '@/stores/authStore';

// Reset store before each test
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: true,
  });
});

describe('authStore', () => {
  it('initializes with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('sets user correctly', () => {
    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'admin' as const,
      orgId: 'org_1',
    };
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('sets session correctly', () => {
    const mockSession = { access_token: 'abc123' };
    useAuthStore.getState().setSession(mockSession);
    expect(useAuthStore.getState().session).toEqual(mockSession);
  });

  it('sets loading correctly', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('clears state on signOut', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'x@x.com', role: 'worker' },
      session: { token: 'x' },
      isLoading: false,
    });
    useAuthStore.getState().signOut();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it('supports manager role', () => {
    useAuthStore.getState().setUser({
      id: 'mgr_1',
      email: 'mgr@example.com',
      role: 'manager',
      orgId: 'org_1',
    });
    expect(useAuthStore.getState().user?.role).toBe('manager');
  });
});

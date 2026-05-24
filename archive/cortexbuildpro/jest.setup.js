jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => ({ data: null, error: null })) })) })),
        order: jest.fn(() => ({ limit: jest.fn(() => ({ data: [], error: null })) })),
        limit: jest.fn(() => ({ data: [], error: null })),
        single: jest.fn(() => ({ data: null, error: null })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({ single: jest.fn(() => ({ data: {}, error: null })) })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({ single: jest.fn(() => ({ data: {}, error: null })) })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null })),
      })),
    }),
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

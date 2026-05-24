/**
 * Tests for the Phase 3.7 replay-loop branches: conflict and row_deleted.
 *
 * The pure helper `decideReplayAction(mutation, result)` is the seam that
 * isolates the switch decision from the React provider. By exercising it
 * directly we verify:
 *
 *   - 'conflict'    → park with conflictId attached, no halt, no retry-delay
 *   - 'row_deleted' → drop (no push, no halt)
 *   - 'auth'        → park with halt (existing behaviour, regression-pinned)
 *   - 'transient'   → park with retries+1 and retry-delay
 *   - 'success' / 'permanent' → drop
 *
 * Pinning these as a flat decision table beats setting up a full provider +
 * fetch + AsyncStorage mock for one switch statement.
 */
import { describe, expect, it, vi } from 'vitest';
import { decideReplayAction, type QueuedMutation } from '@/lib/sync-queue';

// Mock the runtime deps that `lib/sync-queue.tsx` imports at the top level
// so the file can load in a Node-only test env. The pure helper under test
// (`decideReplayAction`) doesn't touch any of them; they have to be stubbed
// only because importing the helper executes the module's top-level imports.
// Without these, the chain reaches react-native/index.js and Node fails on
// the Flow-only `import typeof` directive.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
    addEventListener: vi.fn(() => () => {}),
  },
}));
vi.mock('@/constants/oauth', () => ({ getApiBaseUrl: () => 'https://api.test' }));
vi.mock('@/lib/_core/auth', () => ({ getSessionToken: vi.fn(async () => null) }));

function mkMutation(over: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: 'm1',
    type: 'rfis.update',
    payload: { id: 1, companyId: 7, question: 'edited' },
    createdAt: '2026-05-06T10:00:00Z',
    retries: 0,
    ...over,
  };
}

describe('decideReplayAction', () => {
  it('drops on success', () => {
    expect(decideReplayAction(mkMutation(), { outcome: 'success' })).toEqual({ kind: 'drop' });
  });

  it('drops on permanent (4xx) — original call already showed an error', () => {
    expect(decideReplayAction(mkMutation(), { outcome: 'permanent' })).toEqual({ kind: 'drop' });
  });

  it('drops on row_deleted — the row this mutation targets no longer exists', () => {
    expect(decideReplayAction(mkMutation(), { outcome: 'row_deleted' })).toEqual({ kind: 'drop' });
  });

  it('parks + halts on auth (whole queue stops; other items would 401 too)', () => {
    const action = decideReplayAction(mkMutation(), { outcome: 'auth' });
    expect(action.kind).toBe('park');
    if (action.kind !== 'park') throw new Error('unreachable');
    expect(action.halt).toBe(true);
    expect(action.retryDelay).toBe(false);
    expect(action.mutation.lastError).toContain('Session expired');
    // Auth must NOT bump retries — a worker offline past JWT expiry must not
    // lose data after MAX_RETRIES of fruitless retries.
    expect(action.mutation.retries).toBe(0);
  });

  it('parks on conflict with conflictId attached, NO halt, NO retry-delay', () => {
    const result = { outcome: 'conflict' as const, conflictId: 4242, fields: ['question'] };
    const action = decideReplayAction(mkMutation(), result);
    expect(action.kind).toBe('park');
    if (action.kind !== 'park') throw new Error('unreachable');
    expect(action.halt).toBe(false);  // other rows still proceed — conflicts are per-row
    expect(action.retryDelay).toBe(false);
    expect(action.mutation.conflictId).toBe(4242);
    expect(action.mutation.lastError).toBe('Awaiting resolution');
    // Conflict is not a retryable error; retries must NOT bump (otherwise
    // a busy row would self-drop after MAX_RETRIES of conflict, losing user work).
    expect(action.mutation.retries).toBe(0);
  });

  it('parks on transient with retries+1 and retry-delay', () => {
    const action = decideReplayAction(mkMutation({ retries: 2 }), { outcome: 'transient' });
    expect(action.kind).toBe('park');
    if (action.kind !== 'park') throw new Error('unreachable');
    expect(action.mutation.retries).toBe(3);
    expect(action.mutation.lastError).toBe('Network error');
    expect(action.halt).toBe(false);
    expect(action.retryDelay).toBe(true);
  });

  it('preserves the original mutation fields when parking on conflict', () => {
    const original = mkMutation({ retries: 2, baseSnapshot: { rowId: 1, updatedAt: 'T0', originalValues: {} } });
    const action = decideReplayAction(original, { outcome: 'conflict', conflictId: 5, fields: ['question'] });
    if (action.kind !== 'park') throw new Error('unreachable');
    // Original retries and baseSnapshot are kept (don't reset to 0; don't drop the snapshot).
    expect(action.mutation.retries).toBe(2);
    expect(action.mutation.baseSnapshot).toEqual({ rowId: 1, updatedAt: 'T0', originalValues: {} });
  });

  it('a queue with one conflict + one success: caller pushes only the conflict to remaining', () => {
    // Sketches what replayQueue does end-to-end: it iterates and pushes to
    // `remaining` only when action.kind === 'park'. This is a property check
    // on the action shape, exercising the discriminator the caller relies on.
    const a = decideReplayAction(mkMutation({ id: 'a' }), { outcome: 'conflict', conflictId: 1, fields: [] });
    const b = decideReplayAction(mkMutation({ id: 'b' }), { outcome: 'success' });
    const remaining: QueuedMutation[] = [];
    for (const action of [a, b]) {
      if (action.kind === 'park') remaining.push(action.mutation);
    }
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('a');
    expect(remaining[0].conflictId).toBe(1);
  });
});

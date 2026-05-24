import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Adjust import path (tests is at project root, server is at project root)
// so tests/server/lib/services is 4 levels deep
import { offlineQueue, OfflineQueueDatabase, QueuedAction } from '../../../../server/lib/services/offline-queue';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator.onLine
let isOnline = true;
Object.defineProperty(window.navigator, 'onLine', {
  get: () => isOnline,
  configurable: true
});

describe('OfflineQueueService', () => {
  let mockDb: OfflineQueueDatabase;

  beforeEach(() => {
    // Reset mocks and state
    vi.clearAllMocks();
    localStorageMock.clear();
    isOnline = true;

    // Reset singleton queue
    offlineQueue.clearQueue();

    mockDb = {
      addTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined)
    };

    offlineQueue.setDb(mockDb);

    // Suppress console logs during tests to keep output clean
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should enqueue items and save to localStorage', () => {
    const payload = { title: 'Test Task' };
    offlineQueue.enqueue('ADD_TASK', payload);

    expect(offlineQueue.getQueueSize()).toBe(1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'buildpro_offline_queue',
      expect.any(String)
    );
  });

  it('should drop oldest action when queue exceeds MAX_QUEUE_SIZE', () => {
    // Enqueue 105 items (MAX_QUEUE_SIZE is 100)
    for (let i = 0; i < 105; i++) {
      offlineQueue.enqueue('ADD_TASK', { title: `Task ${i}` });
    }

    expect(offlineQueue.getQueueSize()).toBe(100);
    expect(console.warn).toHaveBeenCalledWith('[Offline] Queue full, dropping oldest action');
  });

  it('should successfully process queue when online and db is injected', async () => {
    offlineQueue.enqueue('ADD_TASK', { title: 'Task 1' });
    offlineQueue.enqueue('UPDATE_TASK', { id: '1', updates: { status: 'done' } });

    expect(offlineQueue.getQueueSize()).toBe(2);

    await offlineQueue.processQueue();

    expect(mockDb.addTask).toHaveBeenCalledWith({ title: 'Task 1' });
    expect(mockDb.updateTask).toHaveBeenCalledWith('1', { status: 'done' });

    // Queue should be cleared after successful processing
    expect(offlineQueue.getQueueSize()).toBe(0);
  });

  it('should not process queue when offline', async () => {
    isOnline = false;

    offlineQueue.enqueue('ADD_TASK', { title: 'Task 1' });
    await offlineQueue.processQueue();

    expect(mockDb.addTask).not.toHaveBeenCalled();
    expect(offlineQueue.getQueueSize()).toBe(1);
  });

  it('should gracefully handle processing when db is not injected', async () => {
    offlineQueue.setDb(null as any); // Clear DB

    offlineQueue.enqueue('ADD_TASK', { title: 'Task 1' });
    await offlineQueue.processQueue();

    // Since DB is not set, it should warn and skip, but the action is dequeued
    expect(console.warn).toHaveBeenCalledWith('[Offline] Database not injected, skipping action execution');
    expect(offlineQueue.getQueueSize()).toBe(0);
  });

  it('should handle errors during execution and re-queue failed actions', async () => {
    // Setup DB to fail on the first task, succeed on the second
    mockDb.addTask = vi.fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(undefined);

    offlineQueue.enqueue('ADD_TASK', { title: 'Task 1' });
    offlineQueue.enqueue('ADD_TASK', { title: 'Task 2' });

    await offlineQueue.processQueue();

    // The first task should throw an error, causing it to be re-queued.
    // The second task succeeds.
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[Offline] Failed to sync action'),
      expect.any(Error)
    );

    // Queue size should be 1 since Task 1 failed and was put back into the queue
    expect(offlineQueue.getQueueSize()).toBe(1);

    // Now if we run again, it should succeed
    await offlineQueue.processQueue();
    expect(offlineQueue.getQueueSize()).toBe(0);
    expect(mockDb.addTask).toHaveBeenCalledTimes(3); // 1 failure, 1 success, then 1 retry success
  });

  it('should prevent concurrent processing calls', async () => {
    // We mock the DB to have a delay so processQueue doesn't finish immediately
    mockDb.addTask = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));

    offlineQueue.enqueue('ADD_TASK', { title: 'Task 1' });

    // Call processQueue twice concurrently
    const p1 = offlineQueue.processQueue();
    const p2 = offlineQueue.processQueue();

    await Promise.all([p1, p2]);

    // DB operation should only be triggered once
    expect(mockDb.addTask).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('[Offline] Already processing queue, skipping...');
  });
});


/**
 * Offline Queue Service - Frontend only
 * Queues actions when offline and syncs when back online
 */

// Frontend-only: db is imported from the main app, not this file
// This service is designed for browser use only

/**
 * Payload types for different queue actions.
 */
export interface TaskPayload {
  title?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

export interface TaskUpdatePayload {
  id: string;
  updates: Record<string, unknown>;
}

export interface LogPayload {
  message?: string;
  level?: string;
  [key: string]: unknown;
}

export type QueuePayload = TaskPayload | TaskUpdatePayload | LogPayload | Record<string, unknown>;

export interface QueuedAction {
  id: string;
  type: 'ADD_TASK' | 'UPDATE_TASK' | 'ADD_LOG' | 'SYNC';
  payload: QueuePayload;
  timestamp: number;
}

// Maximum queue size to prevent localStorage overflow
const MAX_QUEUE_SIZE = 100;

/**
 * Database interface for offline queue operations.
 */
export interface OfflineQueueDatabase {
  addTask: (payload: TaskPayload) => Promise<void>;
  updateTask: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

class OfflineQueueService {
  private queue: QueuedAction[] = [];
  private storageKey = 'buildpro_offline_queue';
  private isProcessing = false;
  private db: OfflineQueueDatabase | null = null;

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => this.processQueue());
    }
  }

  /**
   * Inject database instance (call this from main app)
   */
  public setDb(db: OfflineQueueDatabase) {
    this.db = db;
  }

  private loadQueue() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.queue = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse offline queue", e);
        this.queue = [];
      }
    }
  }

  private saveQueue() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
  }

  public enqueue(type: QueuedAction['type'], payload: QueuePayload) {
    const action: QueuedAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now()
    };
    
    // Prevent unbounded growth
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift(); // Remove oldest
      console.warn('[Offline] Queue full, dropping oldest action');
    }
    
    this.queue.push(action);
    this.saveQueue();
    console.log(`[Offline] Action queued: ${type} (queue size: ${this.queue.length})`);
  }

  public async processQueue() {
    // Prevent race condition: only one process at a time
    if (this.isProcessing) {
      console.log('[Offline] Already processing queue, skipping...');
      return;
    }
    
    if (!navigator.onLine || this.queue.length === 0) return;

    this.isProcessing = true;
    console.log(`[Offline] Processing ${this.queue.length} actions...`);
    
    const actions = [...this.queue];
    
    // Optimistic clear, will re-queue on failure
    this.queue = []; 
    this.saveQueue();

    for (const action of actions) {
      try {
        await this.executeAction(action);
      } catch (error) {
        console.error(`[Offline] Failed to sync action ${action.id}`, error);
        // Re-queue if failed (simple retry strategy)
        this.queue.push(action);
        this.saveQueue();
      }
    }
    
    this.isProcessing = false;
    console.log(`[Offline] Queue processing complete. Remaining: ${this.queue.length}`);
  }

  private async executeAction(action: QueuedAction) {
    // Require db to be injected before use
    if (!this.db) {
      console.warn('[Offline] Database not injected, skipping action execution');
      return;
    }
    
    // Map queue actions to DB calls
    switch (action.type) {
      case 'ADD_TASK':
        await this.db.addTask(action.payload);
        break;
      case 'UPDATE_TASK':
        await this.db.updateTask(action.payload.id, action.payload.updates);
        break;
      case 'ADD_LOG':
        // Log synced
        break;
      default:
        console.warn("Unknown action type:", action.type);
    }
  }

  public getQueueSize(): number {
    return this.queue.length;
  }
  
  public clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }
}

export const offlineQueue = new OfflineQueueService();

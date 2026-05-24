import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'cortexbuild-offline';
const DB_VERSION = 2;
const STORE = 'sync_queue';

export interface QueueEntry {
  id?: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: string;
  headers: Record<string, string>;
  created_at: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
}

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('pending-requests')) {
          db.createObjectStore('pending-requests', { keyPath: 'id', autoIncrement: true });
        }
      }
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status');
        store.createIndex('created_at', 'created_at');
      }
    },
  });
}

export async function enqueue(
  req: Pick<QueueEntry, 'method' | 'url' | 'body' | 'headers'>
): Promise<number> {
  const db = await getDb();
  const entry: Omit<QueueEntry, 'id'> = {
    ...req,
    created_at: Date.now(),
    retries: 0,
    status: 'pending',
  };
  return db.add(STORE, entry) as Promise<number>;
}

export async function dequeueAll(): Promise<QueueEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE, 'status', 'pending');
  return (all as QueueEntry[]).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.countFromIndex(STORE, 'status', 'pending');
}

export async function markSynced(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function markFailed(id: number): Promise<void> {
  const db = await getDb();
  const entry = await db.get(STORE, id) as QueueEntry | undefined;
  if (entry) {
    await db.put(STORE, { ...entry, status: 'failed' });
  }
}

export async function incrementRetries(id: number): Promise<number> {
  const db = await getDb();
  const entry = await db.get(STORE, id) as QueueEntry | undefined;
  if (!entry) return 0;
  const retries = entry.retries + 1;
  await db.put(STORE, { ...entry, retries, status: retries >= 5 ? 'failed' : 'pending' });
  return retries;
}

export async function markSyncing(id: number): Promise<void> {
  const db = await getDb();
  const entry = await db.get(STORE, id) as QueueEntry | undefined;
  if (!entry) return;
  await db.put(STORE, { ...entry, status: 'syncing' });
}

export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}

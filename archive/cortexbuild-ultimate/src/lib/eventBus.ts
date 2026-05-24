/**
 * CortexBuild Ultimate — Shared Event Bus
 * Enables WebSocket messages to trigger React Query invalidation across the app.
 * Import this singleton in both useNotifications.ts (producer) and useData.ts (consumer).
 */
type EventMap = {
  'ws:message': { type: string; table?: string; action?: string; id?: string | number };
  'ws:connect': void;
  'ws:disconnect': void;
  'workflow:notification': { id: string; type: string; title: string; message: string; role: string; timestamp: string };
  'workflow:action': { action: string; context: Record<string, unknown>; timestamp: string };
};

type EventCallback<K extends keyof EventMap> = (data: EventMap[K]) => void;

class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<keyof EventMap, Set<EventCallback<any>>>();

  on<K extends keyof EventMap>(event: K, cb: EventCallback<K>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(cb);
    return () => this.handlers.get(event)?.delete(cb);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.handlers.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error('[EventBus] handler error:', e); }
    });
  }

  off<K extends keyof EventMap>(event: K, cb: EventCallback<K>): void {
    this.handlers.get(event)?.delete(cb);
  }
}

export const eventBus = new EventBus();

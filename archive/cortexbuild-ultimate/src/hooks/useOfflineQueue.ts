import { useState, useEffect } from 'react';
import { countPending } from '../services/offlineQueue';

export interface OfflineQueueState {
  pendingCount: number;
  refresh: () => Promise<void>;
}

export function useOfflineQueue(): OfflineQueueState {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = async () => {
    const count = await countPending();
    setPendingCount(count);
  };

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener('queue-updated', onUpdate);
    window.addEventListener('sync-complete', onUpdate);
    window.addEventListener('online',        onUpdate);
    return () => {
      window.removeEventListener('queue-updated', onUpdate);
      window.removeEventListener('sync-complete', onUpdate);
      window.removeEventListener('online',        onUpdate);
    };
  }, []);

  return { pendingCount, refresh };
}

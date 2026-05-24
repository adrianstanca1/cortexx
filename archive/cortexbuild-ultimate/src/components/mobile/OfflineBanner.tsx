import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useOfflineQueue();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`px-4 py-1.5 text-xs font-medium text-center transition-colors ${
        isOnline
          ? 'bg-green-600 text-white'
          : 'bg-amber-700 text-amber-100'
      }`}
    >
      {isOnline
        ? `⟳ Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}…`
        : `⚡ Offline${pendingCount > 0 ? ` — ${pendingCount} queued` : ''}`}
    </div>
  );
}

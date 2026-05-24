import type { ConnectionStatus } from '@capacitor/network';
import { isNative } from '../capacitor';

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

/**
 * Get current network status.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (isNative()) {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    return { connected: status.connected, connectionType: status.connectionType };
  }
  return { connected: navigator.onLine, connectionType: 'unknown' };
}

/**
 * Listen to network status changes.
 * Returns an unsubscribe function.
 */
export async function addNetworkListener(
  handler: (status: NetworkStatus) => void,
): Promise<() => void> {
  if (isNative()) {
    const { Network } = await import('@capacitor/network');
    const handle = await Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      handler({ connected: status.connected, connectionType: status.connectionType });
    });
    return () => { void handle.remove(); };
  }

  // Web fallback
  const onOnline = () => handler({ connected: true, connectionType: 'unknown' });
  const onOffline = () => handler({ connected: false, connectionType: 'none' });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

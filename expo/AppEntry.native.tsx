// Expo native (iOS/Android) entry — configures the shared @cortexbuild/core
// with REAL secure token storage + offline cache + offline write queue
// before the app renders.
//
// On web, packages/core falls back to localStorage (see index.ts) and skips
// the offline cache/queue. Here we install:
//   - expo-secure-store  → auth token survives app restarts (not plaintext localStorage)
//   - AsyncStorage        → offline cache (last-known-good lists) + write queue (pending creates/edits)
// When signal returns, the queue auto-replays so nothing is lost.
import 'expo-router/entry';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTokenStorage, setOfflineCache, setQueueStore, flushQueue, api } from '@cortexbuild/core';

setTokenStorage({
  get: () => SecureStore.getItemAsync('cb_token'),
  set: (t: string) => SecureStore.setItemAsync('cb_token', t),
  clear: () => SecureStore.deleteItemAsync('cb_token'),
});

// Offline cache (collections) shares AsyncStorage under cb_cache_*
setOfflineCache({
  get: (k: string) => AsyncStorage.getItem(k),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v),
});

// Offline write queue — load any persisted pending writes, then replay
// whenever the device regains connectivity.
(async () => {
  let pending: any[] = [];
  try {
    const raw = await AsyncStorage.getItem('cb_queue');
    if (raw) pending = JSON.parse(raw);
  } catch { pending = []; }
  setQueueStore(
    {
      get: (k: string) => AsyncStorage.getItem(k),
      set: (k: string, v: string) => AsyncStorage.setItem(k, v),
    },
    pending,
  );

  // Replay on (re)connection. expo-network is optional; guard if absent.
  try {
    const NetInfo = (await import('expo-network')).default;
    let wasOnline = true;
    setInterval(async () => {
      try {
        const s = await NetInfo.getNetworkStateAsync();
        if (s.isConnected && !wasOnline) {
          const t = await api.getToken();
          if (t) await flushQueue({ token: t });
        }
        wasOnline = !!s.isConnected;
      } catch { /* ignore */ }
    }, 8000);
  } catch {
    // No expo-network: best-effort flush on each app foreground is handled by
    // the Tabs badge calling flushQueue() on focus.
  }
})();

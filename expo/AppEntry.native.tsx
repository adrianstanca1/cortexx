// Expo native (iOS/Android) entry — configures the shared @cortexbuild/core
// with REAL secure token storage + offline cache before the app renders.
//
// On web, packages/core falls back to localStorage (see index.ts) and skips
// the offline cache. Here we install secure-store + AsyncStorage so that:
//   - the auth token survives app restarts (not in plaintext localStorage)
//   - collection lists keep working with no signal (last-known-good cache)
import 'expo-router/entry';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTokenStorage, setOfflineCache } from '@cortexbuild/core';

setTokenStorage({
  get: () => SecureStore.getItemAsync('cb_token'),
  set: (t: string) => SecureStore.setItemAsync('cb_token', t),
  clear: () => SecureStore.deleteItemAsync('cb_token'),
});

setOfflineCache({
  get: (k: string) => AsyncStorage.getItem(k),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v),
});

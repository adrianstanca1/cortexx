// expo/api.ts — Expo (React Native) API client.
// Consolidated into the shared @cortexbuild/core contract (single source of
// truth for auth + REST surface). Only the token STORAGE backend is
// platform-specific: Expo uses expo-secure-store instead of browser localStorage.
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './theme';
import { createApiClient } from '@cortexbuild/core';

const TOKEN_KEY = 'cb_token';

export const api = createApiClient({
  apiUrl: API_URL,
  tokenStorage: {
    get: async () => {
      try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
    },
    set: async (t: string) => {
      try { await SecureStore.setItemAsync(TOKEN_KEY, t); } catch {}
    },
    clear: async () => {
      try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
    },
  },
});

// Re-export the shared contract so existing screens keep working unchanged.
export const { login, getProjects, apiGet, apiPost, getCollection, postCollection, getToken, setToken, clearToken } = api;
export type AuthUser = { id: string; email: string; role: string; name?: string };

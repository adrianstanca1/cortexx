import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, setToken, clearToken, getStoredUser, setStoredUser, API_BASE } from '../lib/auth-storage';

const TOKEN_KEY = 'cortexbuild_token';
const USER_KEY = 'cortexbuild_user';

describe('auth-storage (local JWT + user in localStorage)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('token functions', () => {
    it('getToken should return null initially', () => {
      expect(getToken()).toBeNull();
    });

    it('setToken should save token to localStorage', () => {
      const token = 'test-jwt-token-123';
      setToken(token);
      expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    });

    it('getToken should retrieve the saved token', () => {
      const token = 'another-test-token';
      localStorage.setItem(TOKEN_KEY, token);
      expect(getToken()).toBe(token);
    });

    it('clearToken should remove both token and user from localStorage', () => {
      localStorage.setItem(TOKEN_KEY, 'token-to-remove');
      localStorage.setItem(USER_KEY, JSON.stringify({ id: 1 }));

      clearToken();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });
  });

  describe('user functions', () => {
    it('getStoredUser should return null initially', () => {
      expect(getStoredUser()).toBeNull();
    });

    it('setStoredUser should save stringified user to localStorage', () => {
      const user = { id: 1, name: 'Alice', roles: ['admin'] };
      setStoredUser(user);

      const stored = localStorage.getItem(USER_KEY);
      expect(stored).toBe(JSON.stringify(user));
    });

    it('getStoredUser should retrieve and parse the saved user', () => {
      const user = { id: 2, name: 'Bob' };
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      expect(getStoredUser()).toEqual(user);
    });

    it('getStoredUser should return null if stored JSON is invalid', () => {
      localStorage.setItem(USER_KEY, '{invalid-json: "test"');

      expect(getStoredUser()).toBeNull();
    });
  });

  describe('constants', () => {
    it('should export API_BASE correctly', () => {
      expect(API_BASE).toBe('/api');
    });
  });
});

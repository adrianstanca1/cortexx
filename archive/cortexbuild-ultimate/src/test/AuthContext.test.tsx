import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as authStorage from '../lib/auth-storage';

// Mock auth-storage
vi.mock('../lib/auth-storage', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getStoredUser: vi.fn(),
  setStoredUser: vi.fn(),
  API_BASE: '/api'
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin',
  company: 'Test Co'
};

const TestComponent = ({ onActionError }: { onActionError?: (error: Error) => void }) => {
  const { user, loading, isAuthenticated, signIn, signUp, signOut, updateProfile } = useAuth();

  // Helper to catch errors in async event handlers for testing
  const handleAction = (action: () => Promise<void>) => async () => {
    try {
      await action();
    } catch (error) {
      if (onActionError && error instanceof Error) onActionError(error);
    }
  };

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      {user && <div data-testid="user-name">{user.name}</div>}
      <button onClick={handleAction(() => signIn('test@example.com', 'password'))}>Sign In</button>
      <button onClick={handleAction(() => signUp('test@example.com', 'password', 'Test User', 'Test Co'))}>Sign Up</button>
      <button onClick={handleAction(() => signOut())}>Sign Out</button>
      <button onClick={handleAction(() => updateProfile({ name: 'Updated Name' }))}>Update Profile</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useAuth must be used within AuthProvider');
    consoleError.mockRestore();
  });

  describe('Initialization', () => {

    it('loads as unauthenticated when no token is present', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue(null);
      vi.mocked(authStorage.getStoredUser).mockReturnValue(null);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('validates token and loads user when token is present', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue('valid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      // Session validation uses httpOnly cookie — must include credentials
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
        credentials: 'include'
      }));
      expect(authStorage.setStoredUser).toHaveBeenCalledWith(mockUser);
    });

    it('clears session when token validation fails', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(authStorage.getToken).mockReturnValue('invalid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(authStorage.clearToken).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it('retains stored user on network error during validation', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(authStorage.getToken).mockReturnValue('valid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
      // Should not clear token on network error
      expect(authStorage.clearToken).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('signIn', () => {
    it('successfully signs in and updates state', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue(null);
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token', user: mockUser })
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      await user.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Token is now httpOnly cookie — signIn only stores user data
      expect(authStorage.setStoredUser).toHaveBeenCalledWith(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password' })
      }));
    });

    it('throws error when sign in fails', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue(null);
      const user = userEvent.setup();
      const onActionError = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' })
      });

      render(
        <AuthProvider>
          <TestComponent onActionError={onActionError} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      await user.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith(new Error('Invalid credentials'));
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(authStorage.setToken).not.toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('successfully signs up and updates state', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue(null);
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token', user: mockUser })
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      await user.click(screen.getByText('Sign Up'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      expect(authStorage.setStoredUser).toHaveBeenCalledWith(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'password', company: 'Test Co' })
      }));
    });
  });

  describe('signOut', () => {
    it('successfully signs out and clears state', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue('valid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Setup mock for the logout API call
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await user.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(authStorage.clearToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST',
        credentials: 'include'
      }));
    });

    it('clears state even if server logout fails (network error)', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue('valid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Setup mock to fail for the logout API call
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await user.click(screen.getByText('Sign Out'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(authStorage.clearToken).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('successfully updates profile', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue('valid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Setup mock for update profile
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedUser
      });

      await user.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Updated Name');
      });

      expect(authStorage.setStoredUser).toHaveBeenCalledWith(updatedUser);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' })
      }));
    });

    it('throws error when update fails', async () => {
      vi.mocked(authStorage.getToken).mockReturnValue('valid-token');
      vi.mocked(authStorage.getStoredUser).mockReturnValue(mockUser);
      const user = userEvent.setup();
      const onActionError = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      render(
        <AuthProvider>
          <TestComponent onActionError={onActionError} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Setup mock to fail for update profile
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Update failed' })
      });

      await user.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith(new Error('Update failed'));
      });

      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User'); // Name should not change
    });
  });
});

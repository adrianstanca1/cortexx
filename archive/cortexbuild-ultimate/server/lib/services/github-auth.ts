/**
 * GitHub OAuth Authentication Service
 * Handles GitHub App OAuth flow for user authentication
 */

// GitHub App Configuration
// Store these in environment variables in production
const GITHUB_CONFIG = {
  clientId: import.meta.env.VITE_GITHUB_CLIENT_ID, // GitHub App Client ID
  clientSecret: '', // Set via environment variable in production (server-side only)
  redirectUri: '/auth/callback',
  appName: 'CortexBuildPro',
  appUrl: 'https://github.com/apps/cortexbuildpro-com'
};

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  company: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface AuthState {
  state: string;
  redirectUrl?: string;
  timestamp: number;
}

class GitHubAuthService {
  private readonly baseUrl: string;
  private readonly storageKey = 'github_auth_state';
  private readonly tokenKey = 'github_access_token';

  constructor() {
    // Use the current origin for redirect URI
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  /**
   * Generate a random state string for CSRF protection
   */
  private generateState(): string {
    const array = new Uint32Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, (x) => x.toString(16)).join('');
  }

  /**
   * Get the GitHub OAuth authorization URL
   */
  getAuthorizationUrl(redirectUrl?: string): string {
    const state = this.generateState();

    // Store state for verification
    const authState: AuthState = {
      state,
      redirectUrl,
      timestamp: Date.now()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(authState));

    const params = new URLSearchParams({
      client_id: GITHUB_CONFIG.clientId,
      redirect_uri: `${this.baseUrl}${GITHUB_CONFIG.redirectUri}`,
      scope: 'user:email read:user',
      state,
      response_type: 'code'
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Initiate the GitHub OAuth login flow
   * Opens a popup window for authentication
   */
  loginWithPopup(): Promise<string> {
    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthorizationUrl();
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'GitHubLogin',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no`
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for GitHub authentication.'));
        return;
      }

      // Listen for the OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== this.baseUrl) return;
        if (event.data.type === 'github_oauth_callback') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.code);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        if (!popup.closed) {
          popup.close();
        }
        reject(new Error('Authentication timed out'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Exchange authorization code for access token
   * This should be done server-side in production to keep the client secret secure
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    // In production, this call should go to your backend which has the client secret
    // For development, we use a proxy server or GitHub's device flow
    const response = await fetch('/api/auth/github/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data: GitHubTokenResponse = await response.json();
    // SECURITY: Token is now stored in httpOnly cookie set by server
    // Do not store tokens in localStorage - vulnerable to XSS
    return data.access_token;
  }

  /**
   * Get the stored access token
   * Note: Token is retrieved from httpOnly cookie via /api/auth/user endpoint
   */
  getAccessToken(): string | null {
    // Tokens are no longer stored client-side
    // Authentication state is managed via httpOnly cookies
    return null;
  }

  /**
   * Fetch the authenticated GitHub user's profile
   * Uses httpOnly cookie for authentication
   */
  async getCurrentUser(): Promise<GitHubUser> {
    const response = await fetch('/api/auth/github/user', {
      credentials: 'include', // Include httpOnly cookies
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expired or invalid');
      }
      throw new Error('Failed to fetch user data');
    }

    return response.json();
  }

  /**
   * Get the user's email addresses
   */
  async getUserEmails(): Promise<string[]> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error('Failed to fetch emails');
    }

    const emails = await response.json();
    return emails
      .filter((e: { verified: boolean; primary: boolean }) => e.verified && e.primary)
      .map((e: { email: string }) => e.email);
  }

  /**
   * Verify the OAuth state to prevent CSRF attacks
   */
  verifyState(receivedState: string): boolean {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return false;

    try {
      const authState: AuthState = JSON.parse(stored);
      // State must match and be less than 10 minutes old
      const isValid = authState.state === receivedState &&
                      Date.now() - authState.timestamp < 10 * 60 * 1000;

      // Clean up after verification
      localStorage.removeItem(this.storageKey);

      return isValid;
    } catch {
      return false;
    }
  }

  /**
   * Log out and clear stored tokens
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}

export const githubAuth = new GitHubAuthService();
export default githubAuth;
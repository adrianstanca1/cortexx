/**
 * API utility for making authenticated requests to the backend
 * Handles auth via httpOnly cookie automatically
 *
 * @deprecated Prefer `src/services/api.ts` for new code. This module exists
 * for legacy callers; new features should use `apiFetch` which provides
 * snake_case → camelCase conversion and richer error types.
 */
import { clearToken } from "./auth-storage";

export interface ApiErrorResponse {
  error: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: ApiErrorResponse;
}

/** Avoid `/api/api/...` when callers pass paths that already include the `/api` prefix. */
function normalizeApiEndpoint(endpoint: string): string {
  const e = endpoint.trim();
  if (e.startsWith("/api/")) return e.slice(4);
  if (e.startsWith("api/")) return `/${e.slice(4)}`;
  return e.startsWith("/") ? e : `/${e}`;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const path = normalizeApiEndpoint(endpoint);
  const url = `/api${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include", // Send httpOnly cookie automatically
    });

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      console.error("Failed to parse API response:", err);
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Cookie auth failed — clear local user state and reload
        clearToken();
        window.location.reload();
      }
      const errorMessage = data?.error
        ? data.error
        : `HTTP ${response.status}: ${response.statusText}`;
      return {
        ok: false,
        status: response.status,
        error: {
          error: errorMessage,
          details: data?.details ||
            data || {
              status: response.status,
              statusText: response.statusText,
            },
        },
      };
    }

    return {
      ok: true,
      status: response.status,
      data: data as T,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      status: 0,
      error: {
        error: `Network error: ${message}`,
      },
    };
  }
}

export async function apiGet<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const result = await apiRequest<T>(endpoint, { ...options, method: "GET" });
  if (!result.ok) {
    throw new Error(result.error?.error || "Failed to fetch");
  }
  return result.data as T;
}

export async function apiPost<T>(
  endpoint: string,
  data: unknown,
  options: RequestInit = {},
): Promise<T> {
  const result = await apiRequest<T>(endpoint, {
    ...options,
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.ok) {
    throw new Error(result.error?.error || "Failed to post");
  }
  return result.data as T;
}

export async function apiPut<T>(
  endpoint: string,
  data: unknown,
  options: RequestInit = {},
): Promise<T> {
  const result = await apiRequest<T>(endpoint, {
    ...options,
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!result.ok) {
    throw new Error(result.error?.error || "Failed to update");
  }
  return result.data as T;
}

export async function apiDelete<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const result = await apiRequest<T>(endpoint, {
    ...options,
    method: "DELETE",
  });
  if (!result.ok) {
    throw new Error(result.error?.error || "Failed to delete");
  }
  return result.data as T;
}

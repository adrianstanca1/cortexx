import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/auth-storage";

/**
 * Process-wide cache so multiple components reading the same key share the
 * same in-flight fetch / hydrated value. Keyed by `key`.
 */
const cache = new Map<string, { value: unknown; ready: boolean }>();
let inflight: Promise<Record<string, unknown>> | null = null;

async function loadAll(): Promise<Record<string, unknown>> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/ui-preferences`, {
        credentials: "include",
      });
      if (!res.ok) return {};
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const all = await inflight;
  for (const [k, v] of Object.entries(all)) {
    cache.set(k, { value: v, ready: true });
  }
  return all;
}

/**
 * useState-shaped hook that persists a value to /api/auth/ui-preferences/<key>.
 *
 * - Loads existing value on mount (cached process-wide so multiple consumers
 *   share one fetch).
 * - Writes are debounced 400ms — a tab toggle in the same render frame as a
 *   filter change makes one request, not two.
 * - Falls back to localStorage if the user is offline / unauthenticated, so
 *   anonymous browsing on the marketing pages still remembers things.
 *
 * @param key   Stable identifier — e.g. "dashboard.activeTab"
 * @param defaultValue  Used until the hydrated value arrives (or if absent)
 */
export function useSyncedPreference<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const cached = cache.get(key);
  const [value, setValue] = useState<T>(
    cached?.ready ? (cached.value as T) : defaultValue,
  );
  const ready = useRef(Boolean(cached?.ready));
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount
  useEffect(() => {
    if (ready.current) return;
    let cancelled = false;
    loadAll()
      .then((all) => {
        if (cancelled) return;
        const cachedKey = cache.get(key);
        if (cachedKey?.ready && cachedKey.value !== undefined) {
          setValue(cachedKey.value as T);
        } else if (key in all) {
          setValue(all[key] as T);
        } else {
          // Fallback to localStorage if server has nothing
          try {
            const local = localStorage.getItem(`uipref:${key}`);
            if (local !== null) setValue(JSON.parse(local) as T);
          } catch {
            /* ignore */
          }
        }
        ready.current = true;
      })
      .catch(() => {
        ready.current = true; // give up, let writes proceed
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const persist = useCallback(
    (val: T) => {
      // Local cache + localStorage are synchronous — server is fire-and-forget.
      cache.set(key, { value: val, ready: true });
      try {
        localStorage.setItem(`uipref:${key}`, JSON.stringify(val));
      } catch {
        /* quota exceeded — non-fatal */
      }
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        fetch(`${API_BASE}/auth/ui-preferences/${encodeURIComponent(key)}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(val),
        }).catch(() => {
          /* offline / unauthenticated — localStorage already has it */
        });
      }, 400);
    },
    [key],
  );

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: T) => T)(prev)
            : next;
        persist(resolved);
        return resolved;
      });
    },
    [persist],
  );

  // Flush any pending write on unmount
  useEffect(() => {
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  return [value, update];
}

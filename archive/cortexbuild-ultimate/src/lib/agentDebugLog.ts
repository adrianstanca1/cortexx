/** POSTs to Vite `/__agent-debug` so the dev/preview server can append NDJSON logs. */
const SESSION = "82d802";

function isPrivateLanHost(hostname: string): boolean {
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  const m = /^172\.(\d+)\./.exec(hostname);
  if (m) {
    const oct = Number(m[1]);
    return oct >= 16 && oct <= 31;
  }
  return false;
}

function agentDebugEligibleHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    isPrivateLanHost(h)
  );
}

let warnedAgentDebugPrimaryOnce = false;
function warnAgentDebugPrimaryOnce(message: string, detail: string) {
  if (warnedAgentDebugPrimaryOnce) return;
  warnedAgentDebugPrimaryOnce = true;
  if (import.meta.env.DEV || agentDebugEligibleHost())
    console.warn(`[agent-debug] ${message}`, detail);
}

export function agentDebugLog(entry: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}): void {
  // Never run during Vitest: fetch is mocked and debug POSTs steal mockResolvedValueOnce order.
  if (import.meta.env.VITEST || import.meta.env.MODE === "test") return;
  // Preview / prod bundles use DEV=false; allow loopback + RFC1918 LAN, or explicit flag.
  const force =
    import.meta.env.VITE_AGENT_DEBUG === "true" ||
    import.meta.env.VITE_AGENT_DEBUG === "1";
  if (!import.meta.env.DEV && !force && !agentDebugEligibleHost()) return;
  // #region agent log
  const enriched = {
    ...entry,
    data: {
      ...entry.data,
      _agentDebug: {
        baseUrl: import.meta.env.BASE_URL,
        /** Leading `/` fetch targets origin root (matches Vite `proxy['/api']`). */
        apiPostPath: "/api/agent-debug",
        viteFallbackPath: "/__agent-debug",
      },
    },
  };
  const body = JSON.stringify({
    sessionId: SESSION,
    ...enriched,
    timestamp: Date.now(),
  });
  void (async () => {
    if (typeof fetch !== "function") return;
    try {
      const r = await fetch("/api/agent-debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": SESSION,
        },
        body,
        credentials: "include",
      });
      if (r.ok) return;
      const text = (await r.text()).slice(0, 200);
      warnAgentDebugPrimaryOnce(
        "POST /api/agent-debug failed",
        `${r.status} ${text}`,
      );
    } catch (e) {
      warnAgentDebugPrimaryOnce(
        "POST /api/agent-debug error",
        e instanceof Error ? e.message : String(e),
      );
    }
    void Promise.resolve(
      fetch("/__agent-debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": SESSION,
        },
        body,
      }),
    ).catch((err) => {
      console.error("[agentDebugLog] Debug log delivery failed:", err);
    });
  })();
  // #endregion
}

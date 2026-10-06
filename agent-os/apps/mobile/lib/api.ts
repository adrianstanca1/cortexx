import * as SecureStore from "expo-secure-store";

const CONNECTION_KEY = "cortex_agent_os_connection_v1";
const LEGACY_URL_KEY = "cortex_agent_os_url";
const LEGACY_TOKEN_KEY = "cortex_agent_os_token";
const PRESETS_KEY = "cortex_agent_os_presets";

export interface ConnectionPreset {
  name: string;
  url: string;
  token: string;
}

interface ConnectionRecord {
  version: 1;
  url: string;
  token: string;
}

let baseUrl = normaliseUrl(process.env.EXPO_PUBLIC_CORTEX_URL || "http://127.0.0.1:4310");
let operatorToken = "";

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normaliseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid Agent OS URL");
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback(parsed.hostname))) {
    throw new Error("Remote Agent OS connections must use HTTPS");
  }
  return parsed.toString().replace(/\/$/, "");
}

function parseConnection(raw: string | null): ConnectionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.version === 1 &&
      typeof parsed.url === "string" &&
      typeof parsed.token === "string" &&
      parsed.token.trim().length >= 32
    ) {
      return { version: 1, url: normaliseUrl(parsed.url), token: parsed.token.trim() };
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadConnection() {
  const current = parseConnection(await SecureStore.getItemAsync(CONNECTION_KEY));
  if (current) {
    baseUrl = current.url;
    operatorToken = current.token;
    return { url: baseUrl, token: operatorToken };
  }

  // One-time migration from the previous split-key format. Migrate only when
  // both values are present and the destination passes current transport rules.
  const [legacyUrl, legacyToken] = await Promise.all([
    SecureStore.getItemAsync(LEGACY_URL_KEY),
    SecureStore.getItemAsync(LEGACY_TOKEN_KEY),
  ]);
  if (legacyUrl && legacyToken && legacyToken.trim().length >= 32) {
    try {
      const migrated = await saveConnection(legacyUrl, legacyToken);
      await Promise.all([
        SecureStore.deleteItemAsync(LEGACY_URL_KEY),
        SecureStore.deleteItemAsync(LEGACY_TOKEN_KEY),
      ]);
      return migrated;
    } catch {
      // Fail closed: never combine or publish a partial legacy connection.
    }
  }
  return { url: baseUrl, token: operatorToken };
}

export async function saveConnection(url: string, token: string) {
  const nextUrl = normaliseUrl(url);
  const nextToken = token.trim();
  if (nextToken.length < 32) throw new Error("Operator token must be at least 32 characters");
  const record: ConnectionRecord = { version: 1, url: nextUrl, token: nextToken };
  await SecureStore.setItemAsync(CONNECTION_KEY, JSON.stringify(record));
  // Publish in-memory state only after durable storage succeeds.
  baseUrl = nextUrl;
  operatorToken = nextToken;
  return { url: baseUrl, token: operatorToken };
}

export async function loadPresets(): Promise<ConnectionPreset[]> {
  const raw = await SecureStore.getItemAsync(PRESETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (!item || typeof item.name !== "string" || typeof item.url !== "string" || typeof item.token !== "string") return [];
      try {
        const url = normaliseUrl(item.url);
        const token = item.token.trim();
        return token.length >= 32 ? [{ name: item.name.trim(), url, token }] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function savePreset(preset: ConnectionPreset) {
  const name = preset.name.trim();
  if (!name) throw new Error("Preset name required");
  const url = normaliseUrl(preset.url);
  const token = preset.token.trim();
  if (token.length < 32) throw new Error("Operator token must be at least 32 characters");
  const presets = await loadPresets();
  const filtered = presets.filter(item => item.name !== name);
  filtered.unshift({ name, url, token });
  const next = filtered.slice(0, 10);
  await SecureStore.setItemAsync(PRESETS_KEY, JSON.stringify(next));
  return next;
}

export async function removePreset(name: string) {
  const presets = (await loadPresets()).filter(item => item.name !== name);
  await SecureStore.setItemAsync(PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!operatorToken) throw new Error("Operator token required");
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + operatorToken,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : "Request failed (" + response.status + ")"
    );
  }
  return payload as T;
}

export async function health(url?: string) {
  const target = normaliseUrl(url || baseUrl);
  const response = await fetch(target + "/health");
  if (!response.ok) throw new Error("Agent OS health check failed");
  return response.json();
}

import * as SecureStore from "expo-secure-store";

const URL_KEY = "cortex_agent_os_url";
const TOKEN_KEY = "cortex_agent_os_token";
const PRESETS_KEY = "cortex_agent_os_presets";

export interface ConnectionPreset {
  name: string;
  url: string;
  token: string;
}

let baseUrl = process.env.EXPO_PUBLIC_CORTEX_URL || "http://127.0.0.1:4310";
let operatorToken = "";

function normaliseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function loadConnection() {
  const [savedUrl, savedToken] = await Promise.all([
    SecureStore.getItemAsync(URL_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
  ]);
  if (savedUrl) baseUrl = normaliseUrl(savedUrl);
  if (savedToken) operatorToken = savedToken;
  return { url: baseUrl, token: operatorToken };
}

export async function saveConnection(url: string, token: string) {
  baseUrl = normaliseUrl(url);
  operatorToken = token.trim();
  await Promise.all([
    SecureStore.setItemAsync(URL_KEY, baseUrl),
    SecureStore.setItemAsync(TOKEN_KEY, operatorToken),
  ]);
  return { url: baseUrl, token: operatorToken };
}

export async function loadPresets(): Promise<ConnectionPreset[]> {
  const raw = await SecureStore.getItemAsync(PRESETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item =>
      item && typeof item.name === "string" && typeof item.url === "string" && typeof item.token === "string"
    ) : [];
  } catch {
    return [];
  }
}

export async function savePreset(preset: ConnectionPreset) {
  const presets = await loadPresets();
  const filtered = presets.filter(item => item.name !== preset.name);
  filtered.unshift({
    name: preset.name.trim(),
    url: normaliseUrl(preset.url),
    token: preset.token.trim(),
  });
  await SecureStore.setItemAsync(PRESETS_KEY, JSON.stringify(filtered.slice(0, 10)));
  return filtered.slice(0, 10);
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

/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mock keeps expo-linking/expo-modules-core
   out of the import chain (no __DEV__ surprises). */
/**
 * Coverage for `lib/_core/auth.ts` — the client-side session token + cached
 * user info layer. The module branches on `Platform.OS`:
 *
 * - Web: session token is a no-op (cookie-based auth); user info uses
 *   `window.localStorage`.
 * - Native: both session token and user info use `expo-secure-store`.
 *
 * `Platform.OS` is a const set at module load, so we use `vi.doMock` +
 * `vi.resetModules()` + dynamic import to load the module under each
 * platform — same pattern `tests/auth-session.test.ts` uses for env vars.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `@/constants/oauth` pulls in `expo-linking` (and through it `expo-modules-core`),
// which can't initialise outside a real RN runtime. The auth module only needs
// the two storage key strings, so stub the constants module before any import
// chain reaches it. Keep these in sync with `constants/oauth.ts`.
const SESSION_TOKEN_KEY = "app_session_token";
const USER_INFO_KEY = "manus-runtime-user-info";

vi.mock("@/constants/oauth", () => ({
  SESSION_TOKEN_KEY,
  USER_INFO_KEY,
}));

// Sanity check: verify the stubbed values literally match `constants/oauth.ts`.
// Reading the file is the cheapest way to assert the cross-module contract
// without booting the expo-linking import chain. If either side renames the
// key the auth tests below would silently pass against the wrong key, so we
// catch the drift here first.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const oauthSource = readFileSync(
  resolve(__dirname, "../constants/oauth.ts"),
  "utf-8",
);

describe("lib/_core/auth — storage key constants", () => {
  it("SESSION_TOKEN_KEY matches the export in @/constants/oauth", () => {
    expect(oauthSource).toMatch(
      new RegExp(`SESSION_TOKEN_KEY\\s*=\\s*"${SESSION_TOKEN_KEY}"`),
    );
  });

  it("USER_INFO_KEY matches the export in @/constants/oauth", () => {
    expect(oauthSource).toMatch(
      new RegExp(`USER_INFO_KEY\\s*=\\s*"${USER_INFO_KEY}"`),
    );
  });
});

type SecureStoreMock = {
  getItemAsync: ReturnType<typeof vi.fn>;
  setItemAsync: ReturnType<typeof vi.fn>;
  deleteItemAsync: ReturnType<typeof vi.fn>;
};

function createSecureStoreMock(): SecureStoreMock {
  return {
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
  };
}

type LocalStorageMock = {
  store: Map<string, string>;
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

function createLocalStorageMock(): LocalStorageMock {
  const store = new Map<string, string>();
  return {
    store,
    getItem: vi.fn((key: string) => (store.has(key) ? (store.get(key) as string) : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

const sampleUser = {
  id: 1,
  openId: "openid-abc",
  name: "Test User",
  email: "test@example.com",
  loginMethod: "oauth",
  lastSignedIn: new Date("2026-05-04T12:00:00.000Z").toISOString(),
  role: "admin",
  companyId: 42,
  companyRole: "company_admin",
  companyUserId: 7,
  jobTitle: "Engineer",
  department: "Field",
};

/**
 * Load `lib/_core/auth.ts` with `Platform.OS` set to the requested value
 * and a fresh `expo-secure-store` mock. Returns the loaded module plus
 * the mock so tests can assert on call args.
 */
async function loadAuthModule(platform: "web" | "ios" | "android") {
  vi.resetModules();
  const secureStore = createSecureStoreMock();
  vi.doMock("expo-secure-store", () => secureStore);
  vi.doMock("react-native", () => ({ Platform: { OS: platform } }));
  const mod = await import("@/lib/_core/auth");
  return { mod, secureStore };
}

describe("lib/_core/auth — on web (cookie-based auth)", () => {
  let localStorage: LocalStorageMock;
  let originalWindow: unknown;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage = createLocalStorageMock();
    // Save the existing window (happy-dom may have set one in other suites)
    // so we can restore it instead of leaking a stub across test files.
    originalWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = { localStorage };
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
    consoleErrorSpy.mockRestore();
    vi.doUnmock("expo-secure-store");
    vi.doUnmock("react-native");
  });

  it("getSessionToken returns null without touching SecureStore (cookie auth)", async () => {
    const { mod, secureStore } = await loadAuthModule("web");
    await expect(mod.getSessionToken()).resolves.toBeNull();
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("setSessionToken is a no-op (server sets the cookie)", async () => {
    const { mod, secureStore } = await loadAuthModule("web");
    await expect(mod.setSessionToken("ignored")).resolves.toBeUndefined();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("removeSessionToken is a no-op (server clears the cookie)", async () => {
    const { mod, secureStore } = await loadAuthModule("web");
    await expect(mod.removeSessionToken()).resolves.toBeUndefined();
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("getUserInfo returns null when the localStorage key is absent", async () => {
    const { mod } = await loadAuthModule("web");
    await expect(mod.getUserInfo()).resolves.toBeNull();
    expect(localStorage.getItem).toHaveBeenCalledWith(USER_INFO_KEY);
  });

  it("getUserInfo parses the JSON payload from localStorage", async () => {
    localStorage.store.set(USER_INFO_KEY, JSON.stringify(sampleUser));
    const { mod } = await loadAuthModule("web");
    await expect(mod.getUserInfo()).resolves.toEqual(sampleUser);
  });

  it("getUserInfo returns null and does not throw on malformed JSON", async () => {
    localStorage.store.set(USER_INFO_KEY, "{not-json");
    const { mod } = await loadAuthModule("web");
    await expect(mod.getUserInfo()).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("setUserInfo writes the JSON-stringified user to localStorage", async () => {
    const { mod } = await loadAuthModule("web");
    await mod.setUserInfo(sampleUser as never);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      USER_INFO_KEY,
      JSON.stringify(sampleUser),
    );
  });

  it("clearUserInfo removes the localStorage key", async () => {
    localStorage.store.set(USER_INFO_KEY, JSON.stringify(sampleUser));
    const { mod } = await loadAuthModule("web");
    await mod.clearUserInfo();
    expect(localStorage.removeItem).toHaveBeenCalledWith(USER_INFO_KEY);
    expect(localStorage.store.has(USER_INFO_KEY)).toBe(false);
  });

  it("setUserInfo swallows storage errors (caught + logged, never thrown)", async () => {
    localStorage.setItem.mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    const { mod } = await loadAuthModule("web");
    await expect(mod.setUserInfo(sampleUser as never)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("clearUserInfo swallows storage errors", async () => {
    localStorage.removeItem.mockImplementationOnce(() => {
      throw new Error("denied");
    });
    const { mod } = await loadAuthModule("web");
    await expect(mod.clearUserInfo()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("lib/_core/auth — on native (expo-secure-store)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.doUnmock("expo-secure-store");
    vi.doUnmock("react-native");
  });

  it("getSessionToken reads SESSION_TOKEN_KEY from SecureStore", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.getItemAsync.mockResolvedValueOnce("token-xyz");

    await expect(mod.getSessionToken()).resolves.toBe("token-xyz");
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY);
  });

  it("getSessionToken returns null when SecureStore has no value", async () => {
    const { mod, secureStore } = await loadAuthModule("android");
    secureStore.getItemAsync.mockResolvedValueOnce(null);

    await expect(mod.getSessionToken()).resolves.toBeNull();
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY);
  });

  it("getSessionToken returns null and logs when SecureStore throws", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.getItemAsync.mockImplementationOnce(() => {
      throw new Error("keychain locked");
    });

    await expect(mod.getSessionToken()).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("setSessionToken writes through to SecureStore.setItemAsync", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.setItemAsync.mockResolvedValueOnce(undefined);

    await mod.setSessionToken("new-token");
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      SESSION_TOKEN_KEY,
      "new-token",
    );
  });

  it("setSessionToken propagates SecureStore failures (callers must handle)", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.setItemAsync.mockRejectedValueOnce(new Error("boom"));

    await expect(mod.setSessionToken("x")).rejects.toThrow("boom");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("removeSessionToken deletes SESSION_TOKEN_KEY from SecureStore", async () => {
    const { mod, secureStore } = await loadAuthModule("android");
    secureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

    await mod.removeSessionToken();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY);
  });

  it("removeSessionToken swallows SecureStore failures (logout must not throw)", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.deleteItemAsync.mockRejectedValueOnce(new Error("denied"));

    await expect(mod.removeSessionToken()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("getUserInfo parses JSON read from SecureStore under USER_INFO_KEY", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(sampleUser));

    await expect(mod.getUserInfo()).resolves.toEqual(sampleUser);
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(USER_INFO_KEY);
  });

  it("getUserInfo returns null when SecureStore has no cached user", async () => {
    const { mod, secureStore } = await loadAuthModule("android");
    secureStore.getItemAsync.mockResolvedValueOnce(null);

    await expect(mod.getUserInfo()).resolves.toBeNull();
  });

  it("getUserInfo returns null on malformed cached JSON instead of throwing", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.getItemAsync.mockResolvedValueOnce("not-json{");

    await expect(mod.getUserInfo()).resolves.toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("setUserInfo persists JSON-stringified user to SecureStore", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.setItemAsync.mockResolvedValueOnce(undefined);

    await mod.setUserInfo(sampleUser as never);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      USER_INFO_KEY,
      JSON.stringify(sampleUser),
    );
  });

  it("setUserInfo swallows SecureStore failures", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.setItemAsync.mockRejectedValueOnce(new Error("quota"));

    await expect(mod.setUserInfo(sampleUser as never)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("clearUserInfo deletes USER_INFO_KEY from SecureStore", async () => {
    const { mod, secureStore } = await loadAuthModule("android");
    secureStore.deleteItemAsync.mockResolvedValueOnce(undefined);

    await mod.clearUserInfo();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(USER_INFO_KEY);
  });

  it("clearUserInfo swallows SecureStore failures", async () => {
    const { mod, secureStore } = await loadAuthModule("ios");
    secureStore.deleteItemAsync.mockRejectedValueOnce(new Error("denied"));

    await expect(mod.clearUserInfo()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

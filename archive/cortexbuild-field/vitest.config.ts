import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors the path aliases declared in tsconfig.json so tests can import
// modules using the same `@/...` and `@shared/...` specifiers as the rest
// of the codebase. Without this, tests must use relative paths only and
// any module that imports `@/lib/trpc` (or similar) cannot be loaded.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "shared"),
      // Component tests use happy-dom + react-native-web. Aliasing
      // `react-native` to its web shim lets us render RN primitives
      // (View, Text, Pressable, …) into DOM elements happy-dom can query.
      // Server tests don't import react-native so they're unaffected.
      "react-native": "react-native-web",
    },
  },
  test: {
    // Disable the companyScopedProcedure audit middleware in unit tests
    // so mocked DBs don't see an extra audit_log INSERT on every
    // mutation. Integration tests (vitest.integration.config.ts) leave
    // it on so end-to-end audit-on-mutation is exercised against real PG.
    env: {
      AUDIT_DISABLED: "1",
      // Neutralise Ollama's default base URL so the unit suite never
      // accidentally hits a real Ollama instance on dev boxes that
      // happen to run one (this VPS does, for production LLM serving).
      // ollama.ts captures DEFAULT_BASE = process.env.OLLAMA_BASE_URL
      // || "http://127.0.0.1:11434" at module load; this override
      // forces every test invocation to hit an unreachable port and
      // fail fast, so the fallback path is exercised deterministically.
      // Tests that genuinely want real Ollama should override via their
      // own setup before the module is imported.
      OLLAMA_BASE_URL: "http://127.0.0.1:1",
    },
    include: ["tests/**/*.test.{ts,tsx}", "__tests__/**/*.test.{ts,tsx}"],
    // Integration tests live in tests/integration/ and require Docker
    // (testcontainers Postgres). They have their own config and are run
    // by `pnpm test:integration` — keep them out of the default unit suite
    // so `pnpm test` stays fast and Docker-free.
    exclude: ["**/node_modules/**", "tests/integration/**", "**/*.integration.test.ts"],
    // Setup file for component tests: loads jest-dom matchers and silences
    // upstream RN-web warnings. Server-only tests are unaffected because
    // jest-dom is only meaningful inside a DOM environment, and tests
    // opt into happy-dom per-file via the `@vitest-environment happy-dom` directive.
    setupFiles: ["tests/component-setup.ts"],
    coverage: {
      // v8 is built into node — no extra runtime install vs istanbul.
      provider: "v8",
      reporter: ["text", "html"],
      // Only measure files we actually exercise (server + lib helpers).
      // The Expo/React Native screen layer has no test runner today, so
      // including it would bury the real coverage numbers in zeroes.
      include: ["server/**/*.ts", "lib/**/*.{ts,tsx}", "shared/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "lib/mock-data.ts",
        "lib/types.ts",
        "lib/_core/**",
        "server/_core/types/**",
      ],
      // Floor — set ~3 percentage points below the current numbers so a
      // single low-coverage PR doesn't trip CI but we still notice if
      // coverage tanks. Ratchet upward as untested modules get covered.
      // Current at floor commit: 39.1% statements / 64% branches.
      thresholds: {
        statements: 36,
        branches: 60,
        functions: 50,
        lines: 36,
      },
    },
    testTimeout: 15000,
  },
});

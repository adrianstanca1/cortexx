/**
 * Vitest config for integration tests that need a real Postgres
 * container. Separate from the unit suite so `pnpm test` stays fast
 * and Docker-free.
 *
 * Run:
 *   pnpm test:integration             # all integration tests
 *   pnpm test:integration -- pattern  # subset
 *
 * CI runs this in a separate job (.github/workflows/ci.yml → integration)
 * on every PR and push to main alongside type-check and unit coverage.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts", "tests/**/*.integration.test.ts"],
    // Container boot + migration apply takes ~5–15s; default test timeout
    // is plenty, but per-test-file setup hooks need more headroom.
    // CI runners cold-pull postgres:16-alpine + apply migrations; 60s hooks
    // occasionally flake on busy ubuntu-latest shared hosts.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run integration test files in series to avoid spinning up multiple
    // containers in parallel (slower on CI runners; can hit Docker limits
    // on weak hosts). Within a file, tests still run sequentially anyway.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});

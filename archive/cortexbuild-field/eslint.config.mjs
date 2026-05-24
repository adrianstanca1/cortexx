// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Server-side: every `console.*` is a regression vector for credential
    // leakage to PM2 stdout. Use `log.*` from server/_core/logger.ts, which
    // redacts PIN/password/token/p8/etc. by default. Warn (not error) so
    // existing sites don't break the build during gradual migration; lift
    // to "error" once the inventory is zero.
    files: ["server/**/*.ts", "server/**/*.tsx"],
    rules: {
      "no-console": "warn",
    },
  },
  {
    // Tests can use console.* freely.
    files: ["tests/**/*.ts", "tests/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-console": "off",
    },
  },
]);

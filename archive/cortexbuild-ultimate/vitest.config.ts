import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
      "coverage",
    ],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        ".worktrees/**",
        "**/ios/**/public/**",
        "src/test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Report coverage without failing CI: most UI modules are not unit-tested yet.
      // Raise thresholds gradually once suites cover more of `src/`.
    },
    // Test timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    // reporters
    reporters: ["default", "hanging-process"],
    // Collapsed single line for CI
    silent: false,
    // Fake timers configuration
    fakeTimers: {
      toFake: ["setTimeout", "setInterval"],
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["vitest", "@vitest/coverage-v8"],
  },
});

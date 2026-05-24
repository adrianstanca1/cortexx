/* eslint-disable import/first -- this file deliberately runs side-effectful
   setup (globalThis.crypto, __DEV__) between imports so test infra picks
   them up before the next import resolves. */
import { webcrypto } from "node:crypto";

// `jose` (webcrypto build) expects `globalThis.crypto`. Node 18 does not
// expose it globally; Node 20+ does. CI uses Node 22; local/apt Node 18
// would otherwise fail auth tests with "crypto is not defined".
if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

/**
 * Setup file for React Native component tests run under vitest + happy-dom.
 *
 * The `app/` and `components/` directories use react-native primitives
 * (View, Text, Pressable, …). Vitest runs in Node, but `react-native`
 * itself ships native bindings that won't load in Node. We work around
 * that by aliasing `react-native` to `react-native-web`, which is already
 * a project dependency (used for the web build) and renders RN components
 * to DOM elements that happy-dom can introspect.
 *
 * Apply this setup file to component tests via the `@vitest-environment
 * happy-dom` directive in the test file, plus the alias configured in
 * vitest.config.ts.
 *
 * Trade-offs of this approach (vs the canonical jest-expo + RNTL):
 *  - Pro: zero new test runners, reuses existing react-native-web dep,
 *    matches what the web build does at runtime.
 *  - Con: native-only APIs (NativeModules, Animated.event with native
 *    driver, navigation primitives that touch Reanimated worklets)
 *    don't work; tests for those screens need to mock at module level.
 *
 * For most screens that are mostly View/Text/TextInput/Pressable +
 * tRPC hooks, this is enough.
 */
import "@testing-library/jest-dom/vitest";

// `__DEV__` is a Metro-injected global on real RN runtimes. Several
// project files reference it at module top level (lib/_core/api.ts,
// expo-modules-core internals, etc.); without a default value the import
// chain throws ReferenceError when those modules are pulled into a
// Node-only or DOM-based test. Set once here, before any test imports.
(globalThis as { __DEV__?: boolean }).__DEV__ ??= false;

// Silence the React Native Web warning that "props.pointerEvents is
// deprecated" — it's noise from upstream libs we don't control.
const ORIGINAL_WARN = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("pointerEvents is deprecated")) return;
  if (msg.includes("useNativeDriver")) return;
  ORIGINAL_WARN(...args);
};

/**
 * Stable import path for `@/server/routers` and `../routers` from `_core`.
 * Implementation lives in `./routers/index.ts` — re-export via explicit path
 * so `./routers` does not resolve ambiguously next to this file.
 */
export { appRouter, type AppRouter } from './routers/index';

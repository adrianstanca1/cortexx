import { TRPCError } from '@trpc/server';

/**
 * Thrown by tRPC procedures when getDb() returns null (the server
 * starts without DATABASE_URL — every db helper short-circuits).
 *
 * Single source of truth for the code + message so the client can
 * match on `err.data?.code === 'SERVICE_UNAVAILABLE'` to render a
 * "try again in a moment" state instead of treating it as a generic
 * INTERNAL_SERVER_ERROR (which is what `throw new Error(...)` would
 * become at the wire — indistinguishable from real bugs and leaks
 * stack-trace-ish text into the UI).
 */
export const dbUnavailable = (): TRPCError =>
  new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Database is temporarily unavailable. Please try again in a moment.',
  });

/**
 * NotificationGateway — barrel export.
 *
 * Consumers should import from `server/_core/notifications` rather than
 * the inner modules so `gateway.ts` and `recipients.ts` can be split or
 * merged in Step 2 without churning every call site.
 */
export * from "./gateway";
export * from "./recipients";

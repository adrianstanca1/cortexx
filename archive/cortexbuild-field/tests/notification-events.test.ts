/**
 * Tests for the shared notification-events registry — the helpers that
 * determine whether a given event type is enabled for a user, and the
 * defaults projection used by the Settings UI.
 *
 * Convention reminder (codified in shared/notification-events.ts):
 *   prefs[eventType] === undefined  → enabled (opt-out default)
 *   prefs[eventType] === false      → muted
 *   prefs[eventType] === true       → enabled (explicitly set)
 */
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_TYPES,
  isEventEnabled,
  fillDefaults,
  type UserPushPreferences,
} from "../shared/notification-events";

describe("NOTIFICATION_EVENTS registry", () => {
  it("is non-empty (z.enum cast in the tRPC procedure crashes at startup if emptied)", () => {
    // The cast `as [NotificationEventType, ...NotificationEventType[]]`
    // in pushTokens.updatePreference asserts a non-empty tuple; the
    // empty case would crash zod at module load. Pin the contract
    // here rather than in production.
    expect(NOTIFICATION_EVENT_TYPES.length).toBeGreaterThan(0);
  });

  it("includes the events we fire today", () => {
    // If you're adding a new event type, also add it here AND wire the
    // call site to pass it to sendPushToUsers — registry-only entries
    // are forbidden by design.
    expect(NOTIFICATION_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "defect_assigned",
        "defect_resolved",
        "delivery_expected",
        "delivery_received",
        "delivery_rejected",
      ]),
    );
  });

  it("every entry has a label and a category", () => {
    for (const t of NOTIFICATION_EVENT_TYPES) {
      expect(NOTIFICATION_EVENTS[t].label).toBeTruthy();
      expect(NOTIFICATION_EVENTS[t].category).toBeTruthy();
    }
  });
});

describe("isEventEnabled", () => {
  it("returns true for an event type missing from the prefs object (opt-out default)", () => {
    expect(isEventEnabled({}, "defect_assigned")).toBe(true);
  });

  it("returns false when prefs explicitly disable the event", () => {
    expect(isEventEnabled({ defect_assigned: false }, "defect_assigned")).toBe(false);
  });

  it("tolerates a legacy explicit-true value from DB drift (cast bypasses the false-only type)", () => {
    // The type forbids constructing this in code, but a hand-edited
    // row or an older deploy could still produce it. The runtime helper
    // narrows on `=== false`, so a stray `true` reads as enabled.
    const legacy = { defect_assigned: true } as unknown as UserPushPreferences;
    expect(isEventEnabled(legacy, "defect_assigned")).toBe(true);
  });

  it("treats per-event prefs independently", () => {
    const prefs: UserPushPreferences = { defect_assigned: false };
    expect(isEventEnabled(prefs, "defect_assigned")).toBe(false);
    expect(isEventEnabled(prefs, "defect_resolved")).toBe(true);
  });
});

describe("fillDefaults", () => {
  it("returns every known event type, defaulting missing ones to true", () => {
    const result = fillDefaults({});
    for (const t of NOTIFICATION_EVENT_TYPES) {
      expect(result[t]).toBe(true);
    }
  });

  it("preserves explicit false entries", () => {
    const result = fillDefaults({ defect_assigned: false });
    expect(result.defect_assigned).toBe(false);
    expect(result.defect_resolved).toBe(true);
  });

  it("treats a legacy explicit-true entry as enabled (DB-drift defence)", () => {
    const legacy = { defect_assigned: true } as unknown as UserPushPreferences;
    const result = fillDefaults(legacy);
    expect(result.defect_assigned).toBe(true);
  });
});

describe("delivery_* events", () => {
  it("isEventEnabled defaults to true for missing keys", () => {
    expect(isEventEnabled({}, "delivery_expected")).toBe(true);
    expect(isEventEnabled({}, "delivery_received")).toBe(true);
    expect(isEventEnabled({}, "delivery_rejected")).toBe(true);
  });

  it("isEventEnabled is false when explicitly muted", () => {
    expect(isEventEnabled({ delivery_received: false }, "delivery_received")).toBe(false);
  });
});

/* eslint-disable import/first -- vi.mock(...) declarations must precede
   the import they replace; the mocks keep AsyncStorage / trpc / use-auth
   out of the import chain so the pure helper runs in Node. */
import { describe, expect, it, vi } from "vitest";

// `lib/rfi-actions.ts` imports from `@/lib/company-context`, which transitively
// pulls in React Native modules (AsyncStorage, trpc, use-auth). Stub them so
// the pure helper can run in Node/vitest without a native environment.
vi.mock("@/lib/trpc", () => ({ trpc: {} }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiGet: async () => [] },
}));

import { visibleRfiActions } from "@/lib/rfi-actions";
import type { UserRole } from "@/lib/company-context";

describe("visibleRfiActions", () => {
  it("submitted + manager+: shows Answer only", () => {
    expect(visibleRfiActions("submitted", "manager")).toEqual({ answer: true, approve: false, reject: false });
    expect(visibleRfiActions("submitted", "company_admin")).toEqual({ answer: true, approve: false, reject: false });
  });

  it("submitted + below manager: no actions", () => {
    expect(visibleRfiActions("submitted", "supervisor")).toEqual({ answer: false, approve: false, reject: false });
    expect(visibleRfiActions("submitted", "worker")).toEqual({ answer: false, approve: false, reject: false });
  });

  it("answered + company_admin+: shows Approve and Reject (no Answer)", () => {
    expect(visibleRfiActions("answered", "company_admin")).toEqual({ answer: false, approve: true, reject: true });
    expect(visibleRfiActions("answered", "super_admin")).toEqual({ answer: false, approve: true, reject: true });
  });

  it("answered + manager: no actions (manager can answer but not approve)", () => {
    expect(visibleRfiActions("answered", "manager")).toEqual({ answer: false, approve: false, reject: false });
  });

  it("approved or rejected: terminal — no actions for any role", () => {
    const allRoles: UserRole[] = ["viewer", "worker", "supervisor", "manager", "company_admin", "super_admin"];
    for (const r of allRoles) {
      expect(visibleRfiActions("approved", r)).toEqual({ answer: false, approve: false, reject: false });
      expect(visibleRfiActions("rejected", r)).toEqual({ answer: false, approve: false, reject: false });
    }
  });

  it("null role (no membership): no actions", () => {
    expect(visibleRfiActions("submitted", null)).toEqual({ answer: false, approve: false, reject: false });
  });
});

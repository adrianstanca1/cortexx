import { describe, expect, it, vi } from "vitest";

import { ROLE_LEVELS, hasPermission, type UserRole } from "@/lib/company-context";

// `lib/company-context.tsx` pulls in `@/lib/trpc` (which depends on
// `@trpc/react-query`) and `@/hooks/use-auth` (which depends on
// `expo-secure-store`). Both of those try to load React Native modules at
// import time. Stub them with empty objects so we can import the file and
// assert on its pure exports — `ROLE_LEVELS`, `hasPermission`.
vi.mock("@/lib/trpc", () => ({ trpc: {} }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

const ALL_ROLES: UserRole[] = [
  "super_admin",
  "company_admin",
  "manager",
  "supervisor",
  "worker",
  "viewer",
];

describe("ROLE_LEVELS", () => {
  it("defines a level for every UserRole — no gaps", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LEVELS[role]).toBeTypeOf("number");
    }
  });

  it("is strictly monotonically decreasing in the canonical hierarchy", () => {
    // The hierarchy is the contract. If two roles end up with the same level,
    // hasPermission becomes ambiguous (e.g. supervisor would be allowed to do
    // worker things AND vice versa). This test pins the strict ordering.
    for (let i = 0; i < ALL_ROLES.length - 1; i += 1) {
      const higher = ALL_ROLES[i];
      const lower = ALL_ROLES[i + 1];
      expect(ROLE_LEVELS[higher]).toBeGreaterThan(ROLE_LEVELS[lower]);
    }
  });
});

describe("hasPermission", () => {
  it("each role can do its own operations (reflexive)", () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, role)).toBe(true);
    }
  });

  it("super_admin can do everything", () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission("super_admin", role)).toBe(true);
    }
  });

  it("viewer can only do viewer operations", () => {
    expect(hasPermission("viewer", "viewer")).toBe(true);
    for (const role of ALL_ROLES) {
      if (role === "viewer") continue;
      expect(hasPermission("viewer", role)).toBe(false);
    }
  });

  it("worker cannot escalate to supervisor or above", () => {
    expect(hasPermission("worker", "viewer")).toBe(true);
    expect(hasPermission("worker", "worker")).toBe(true);
    expect(hasPermission("worker", "supervisor")).toBe(false);
    expect(hasPermission("worker", "manager")).toBe(false);
    expect(hasPermission("worker", "company_admin")).toBe(false);
    expect(hasPermission("worker", "super_admin")).toBe(false);
  });

  it("manager can act as supervisor/worker/viewer but not above", () => {
    expect(hasPermission("manager", "supervisor")).toBe(true);
    expect(hasPermission("manager", "worker")).toBe(true);
    expect(hasPermission("manager", "viewer")).toBe(true);
    expect(hasPermission("manager", "company_admin")).toBe(false);
    expect(hasPermission("manager", "super_admin")).toBe(false);
  });

  it("company_admin can act as everyone except super_admin", () => {
    expect(hasPermission("company_admin", "manager")).toBe(true);
    expect(hasPermission("company_admin", "supervisor")).toBe(true);
    expect(hasPermission("company_admin", "worker")).toBe(true);
    expect(hasPermission("company_admin", "viewer")).toBe(true);
    expect(hasPermission("company_admin", "super_admin")).toBe(false);
  });

  it("is transitive: if A>=B and B>=C then A>=C", () => {
    // Catches accidental ROLE_LEVELS edits that flip the partial order.
    for (const a of ALL_ROLES) {
      for (const b of ALL_ROLES) {
        for (const c of ALL_ROLES) {
          if (hasPermission(a, b) && hasPermission(b, c)) {
            expect(hasPermission(a, c)).toBe(true);
          }
        }
      }
    }
  });
});

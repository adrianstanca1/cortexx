import { describe, expect, it } from "vitest";
import { requireCompanyRole } from "../../server/_core/role-check";
import type { UserRole } from "../../lib/company-context";

const ROLES: UserRole[] = [
  "viewer",
  "worker",
  "supervisor",
  "manager",
  "company_admin",
  "super_admin",
];

describe("requireCompanyRole", () => {
  it("permits when the membership role meets or exceeds the minimum", () => {
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = 0; j <= i; j++) {
        const userRole = ROLES[i];
        const min = ROLES[j];
        expect(
          () => requireCompanyRole({ companyRole: userRole }, min),
        ).not.toThrow();
      }
    }
  });

  it("throws FORBIDDEN when the membership role is below the minimum", () => {
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = i + 1; j < ROLES.length; j++) {
        const userRole = ROLES[i];
        const min = ROLES[j];
        try {
          requireCompanyRole({ companyRole: userRole }, min);
          expect.fail(`should have thrown for ${userRole} < ${min}`);
        } catch (err: any) {
          expect(err.code).toBe("FORBIDDEN");
        }
      }
    }
  });

  it("throws FORBIDDEN when membership is null (e.g. platform-admin bypass on tenant procedures)", () => {
    // companyScopedProcedure leaves companyMembership=null for platform
    // admins. Role-gated transitions on tenant data should still require
    // an explicit company role — platform admins acting in a tenant
    // context need a real seat at the table.
    try {
      requireCompanyRole(null, "manager");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });

  it("throws FORBIDDEN when companyRole is an unknown string (defensive)", () => {
    try {
      requireCompanyRole({ companyRole: "garbage" }, "viewer");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });
});

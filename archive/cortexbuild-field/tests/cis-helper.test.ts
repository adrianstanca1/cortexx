/**
 * Unit tests for `shared/cis.ts` — single source of truth for HMRC
 * Construction Industry Scheme arithmetic. Errors here cost real money,
 * so the matrix below pins every status × item-mix × override branch
 * the helper claims to handle.
 */
import { describe, expect, it } from "vitest";
import {
  cisRateForStatus,
  computeCisDeduction,
  labourSubtotal,
} from "../shared/cis";

describe("cisRateForStatus", () => {
  it("registered_20 → 20", () => {
    expect(cisRateForStatus("registered_20")).toBe(20);
  });

  it("registered_30 → 30 (unverified subcontractor)", () => {
    expect(cisRateForStatus("registered_30")).toBe(30);
  });

  it("gross_payment → 0 (HMRC-approved gross status)", () => {
    expect(cisRateForStatus("gross_payment")).toBe(0);
  });

  it("none → 0 (CIS does not apply, e.g. employee timesheet)", () => {
    expect(cisRateForStatus("none")).toBe(0);
  });
});

describe("labourSubtotal", () => {
  it("returns 0 for an empty list", () => {
    expect(labourSubtotal([])).toBe(0);
  });

  it("sums all items when every isLabour is true", () => {
    const items = [
      { quantity: 5, unitRate: 350, isLabour: true },
      { quantity: 2, unitRate: 100, isLabour: true },
    ];
    expect(labourSubtotal(items)).toBe(5 * 350 + 2 * 100);
  });

  it("excludes items with isLabour:false (HMRC: not on materials)", () => {
    const items = [
      { quantity: 5, unitRate: 350, isLabour: true },
      { quantity: 1, unitRate: 1500, isLabour: false },
    ];
    expect(labourSubtotal(items)).toBe(5 * 350); // 1500 materials excluded
  });

  it("treats undefined isLabour as labour (back-compat for callers that don't pass the flag)", () => {
    const items = [
      { quantity: 5, unitRate: 350 }, // no isLabour
      { quantity: 2, unitRate: 100, isLabour: true },
    ];
    expect(labourSubtotal(items)).toBe(5 * 350 + 2 * 100);
  });

  it("returns 0 when every item is non-labour", () => {
    const items = [
      { quantity: 1, unitRate: 1500, isLabour: false },
      { quantity: 1, unitRate: 800, isLabour: false },
    ];
    expect(labourSubtotal(items)).toBe(0);
  });
});

describe("computeCisDeduction", () => {
  it("none → 0 regardless of labour subtotal", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "none" })).toBe(0);
  });

  it("gross_payment → 0 (HMRC-approved gross status)", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "gross_payment" })).toBe(0);
  });

  it("registered_20 → 20% of labour subtotal", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "registered_20" })).toBe(200);
  });

  it("registered_30 → 30% of labour subtotal", () => {
    expect(computeCisDeduction({ labourSubtotal: 1000, status: "registered_30" })).toBe(300);
  });

  it("rounds to 2 decimal places (avoid floating-point trailing digits in £ amounts)", () => {
    // 333.33 × 0.20 = 66.666... → 66.67
    expect(computeCisDeduction({ labourSubtotal: 333.33, status: "registered_20" })).toBe(66.67);
  });

  it("overrideRate beats status (legacy callers pass an explicit rate)", () => {
    // status would say 20%, override says 25% → 250
    expect(
      computeCisDeduction({
        labourSubtotal: 1000,
        status: "registered_20",
        overrideRate: 25,
      }),
    ).toBe(250);
  });

  it("overrideRate of 0 wins (legacy caller explicitly suppressing CIS)", () => {
    expect(
      computeCisDeduction({
        labourSubtotal: 1000,
        status: "registered_20",
        overrideRate: 0,
      }),
    ).toBe(0);
  });

  it("zero labour subtotal → 0 even at non-zero rate", () => {
    expect(computeCisDeduction({ labourSubtotal: 0, status: "registered_20" })).toBe(0);
  });
});

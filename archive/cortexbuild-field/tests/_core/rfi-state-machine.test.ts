import { describe, expect, it } from "vitest";
import {
  canTransition,
  assertTransition,
  type RfiStatus,
} from "../../server/_core/rfi-state-machine";

const STATES: RfiStatus[] = ["submitted", "answered", "approved", "rejected"];

const VALID = new Set([
  "submitted->answered",
  "answered->approved",
  "answered->rejected",
]);

describe("rfi-state-machine", () => {
  it("allows the four documented transitions and rejects the rest", () => {
    for (const from of STATES) {
      for (const to of STATES) {
        const expected = VALID.has(`${from}->${to}`);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("treats approved and rejected as terminal — no outgoing transitions", () => {
    for (const to of STATES) {
      expect(canTransition("approved", to)).toBe(false);
      expect(canTransition("rejected", to)).toBe(false);
    }
  });

  it("assertTransition is a no-op on valid transitions", () => {
    expect(() => assertTransition("submitted", "answered")).not.toThrow();
    expect(() => assertTransition("answered", "approved")).not.toThrow();
    expect(() => assertTransition("answered", "rejected")).not.toThrow();
  });

  it("assertTransition throws TRPCError BAD_REQUEST on invalid transitions", async () => {
    try {
      assertTransition("submitted", "approved");
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toMatch(/submitted.*approved|cannot transition/i);
    }
  });
});

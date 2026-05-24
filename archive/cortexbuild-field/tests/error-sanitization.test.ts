import { describe, expect, it } from "vitest";
import { sanitizeErrorShape } from "../server/_core/trpc";

// The exact shape the sanitizer is fed by tRPC's errorFormatter. Mirrors the
// real production payload that triggered this fix — a Drizzle query failure
// surfaced through the auth.login mutation.
const drizzleErrorShape = {
  message:
    'Failed query: select "id", "openId", "name", "email", "loginMethod", "role", "passwordHash" from "users" where "users"."email" = $1\nparams: nonexistent@example.com',
  code: -32603,
  data: {
    code: "INTERNAL_SERVER_ERROR",
    httpStatus: 500,
    path: "auth.login",
    stack: "Error: Failed query: …\n    at <internal>",
  },
};

const operationalErrorShape = {
  message: "You may not do that, friend.",
  code: -32603,
  data: { code: "FORBIDDEN", httpStatus: 403, path: "x" },
};

describe("sanitizeErrorShape", () => {
  it("PRODUCTION: collapses INTERNAL_SERVER_ERROR message + drops stack — no SQL/schema/param leak", () => {
    const out = sanitizeErrorShape(drizzleErrorShape, "INTERNAL_SERVER_ERROR", "production");

    expect(out.message).toBe("Internal server error");
    expect(out.data.stack).toBeUndefined();
    expect(out.data.code).toBe("INTERNAL_SERVER_ERROR");
    expect(out.data.httpStatus).toBe(500);
    expect(out.data.path).toBe("auth.login");

    // None of the leaked-in-the-bug strings may appear anywhere in the output.
    const dump = JSON.stringify(out);
    expect(dump).not.toMatch(/Failed query/);
    expect(dump).not.toMatch(/passwordHash/);
    expect(dump).not.toMatch(/nonexistent@example\.com/);
  });

  it("PRODUCTION: leaves operational error messages untouched", () => {
    const out = sanitizeErrorShape(operationalErrorShape, "FORBIDDEN", "production");
    expect(out.message).toBe("You may not do that, friend.");
    expect(out).toEqual(operationalErrorShape);
  });

  it("DEVELOPMENT: keeps full INTERNAL_SERVER_ERROR message for local debugging", () => {
    const out = sanitizeErrorShape(drizzleErrorShape, "INTERNAL_SERVER_ERROR", "development");
    // Must NOT collapse — devs need the SQL message to fix the broken query.
    expect(out.message).toMatch(/Failed query/);
    expect(out.message).toMatch(/passwordHash/);
    expect(out.data.stack).toContain("Error:");
  });

  it("UNDEFINED NODE_ENV (test/CI): treated as non-production — full message kept", () => {
    const out = sanitizeErrorShape(drizzleErrorShape, "INTERNAL_SERVER_ERROR", undefined);
    expect(out.message).toMatch(/Failed query/);
  });

  it("PRODUCTION + non-INTERNAL code: leaves message untouched", () => {
    const inputShape = { ...drizzleErrorShape, data: { ...drizzleErrorShape.data, code: "BAD_REQUEST" } };
    const out = sanitizeErrorShape(inputShape, "BAD_REQUEST", "production");
    expect(out.message).toMatch(/Failed query/);
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { log, redactForLog } from "../../server/_core/logger";

describe("redactForLog", () => {
  it("returns primitives unchanged", () => {
    expect(redactForLog("hello")).toBe("hello");
    expect(redactForLog(42)).toBe(42);
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog(undefined)).toBeUndefined();
    expect(redactForLog(true)).toBe(true);
  });

  it("redacts keys matching the credential pattern", () => {
    const out = redactForLog({
      email: "x@y.com",
      pin: "123456",
      password: "test-fixture-secret",
      token: "ghp_abc",
      jwt_secret: "...",
      p8: "-----BEGIN-----",
      apiKey: "sk-...",
      sessionToken: "abc",
    });
    expect(out).toEqual({
      email: "x@y.com",
      pin: "[REDACTED]",
      password: "[REDACTED]",
      token: "[REDACTED]",
      jwt_secret: "[REDACTED]",
      p8: "[REDACTED]",
      apiKey: "[REDACTED]",
      sessionToken: "[REDACTED]",
    });
  });

  it("recurses into nested objects (a leaked PIN inside a body still redacts)", () => {
    const out = redactForLog({
      method: "POST",
      url: "/api/trpc/users.invite",
      body: { email: "a@b.c", pin: "999999" },
    });
    expect(out).toEqual({
      method: "POST",
      url: "/api/trpc/users.invite",
      body: { email: "a@b.c", pin: "[REDACTED]" },
    });
  });

  it("walks arrays element-by-element", () => {
    const out = redactForLog([{ pin: "1" }, { pin: "2" }, "literal"]);
    expect(out).toEqual([{ pin: "[REDACTED]" }, { pin: "[REDACTED]" }, "literal"]);
  });

  it("handles cyclic references without crashing", () => {
    const a: any = { pin: "x" };
    a.self = a;
    const out: any = redactForLog(a);
    expect(out.pin).toBe("[REDACTED]");
    // The cycle is broken with a sentinel string ("[cycle]") rather than
    // recursing. The contract that matters is "no infinite loop"; whether
    // the marker is an object reference or a sentinel string is impl detail.
    expect(out.self).toBe("[cycle]");
  });

  it("redacts long strings (>200 chars) of high entropy as a backstop", () => {
    const longSecret = "x".repeat(64) + "abcdef0123456789".repeat(20);
    const out = redactForLog({ blob: longSecret }) as { blob: string };
    // Even though "blob" doesn't match the credential pattern, very long
    // opaque strings are hashed/truncated to avoid log bloat AND credential
    // leak via misnamed fields (e.g. an API key stored under "data").
    expect(out.blob).toMatch(/^\[redacted-long-string len=\d+\]$/);
  });
});

describe("log.* (the public interface)", () => {
  let writes: string[];
  let origWrite: typeof process.stdout.write;
  let origErrWrite: typeof process.stderr.write;

  beforeEach(() => {
    writes = [];
    origWrite = process.stdout.write.bind(process.stdout);
    origErrWrite = process.stderr.write.bind(process.stderr);
    // Capture stdout/stderr so tests don't depend on console.* mocking.
    process.stdout.write = ((chunk: any) => { writes.push(String(chunk)); return true; }) as any;
    process.stderr.write = ((chunk: any) => { writes.push(String(chunk)); return true; }) as any;
  });

  afterEach(() => {
    process.stdout.write = origWrite;
    process.stderr.write = origErrWrite;
    vi.restoreAllMocks();
  });

  it("log.info redacts an object arg with a `pin`", () => {
    log.info("[invite]", { email: "x@y.com", pin: "654321" });
    const out = writes.join("");
    expect(out).toContain("x@y.com");
    expect(out).not.toContain("654321");
    expect(out).toContain("[REDACTED]");
  });

  it("log.error preserves Error.message + stack but redacts other args", () => {
    log.error("[boom]", new Error("Something broke"), { token: "leaked-here" });
    const out = writes.join("");
    expect(out).toContain("Something broke");
    expect(out).not.toContain("leaked-here");
    expect(out).toContain("[REDACTED]");
  });
});

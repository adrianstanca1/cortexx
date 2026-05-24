/**
 * Characterisation tests for `server/_core/notifications/gateway.ts#notify`.
 *
 * These tests pin the EXACT contract that Step 2 must implement to be
 * equivalent to the open-coded `for (const r of recipients) { void
 * sendEmail(...).catch(err => console.error(...)) }` block currently in
 * `server/routers/index.ts` rfis.* mutations.
 *
 * They will all fail today against the stub (`throw new Error("not
 * implemented — Step 2")`) — that's the point. When Step 2 ships, these
 * tests must turn green WITHOUT modification; if a test has to change to
 * pass, the rewrite is non-equivalent and the change needs justification.
 *
 * Mock strategy:
 *   - `sendEmail` (the only side-effect) is mocked via `vi.mock`. The
 *     same import path the gateway uses internally — see vi.mock
 *     hoisting docs.
 *   - No DB mock; recipient resolution is the caller's job (gateway
 *     consumes a pre-resolved list).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { log } from "../../../server/_core/logger";
import type {
  NotificationRecipient,
  EmailChannel,
} from "../../../server/_core/notifications/gateway";

// ── sendEmail mock ──────────────────────────────────────────────────────────
// Default behaviour: every call resolves successfully. Individual tests
// override with `mockImplementationOnce` / `mockRejectedValueOnce` to
// exercise rejection / never-resolves branches.
const sendEmail = vi.fn(async (_p: unknown) => {});
vi.mock("../../../server/_core/email", () => ({ sendEmail }));

// Import AFTER the mock is hoisted so the module under test picks up
// the spy, not the real Brevo HTTP call.
const { notify } = await import("../../../server/_core/notifications/gateway");

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockImplementation(async () => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Test fixtures ───────────────────────────────────────────────────────────
const ALEX: NotificationRecipient = { userId: 100, email: "alex@example.com", name: "Alex" };
const SAM:  NotificationRecipient = { userId: 101, email: "sam@example.com",  name: "Sam"  };
const JO:   NotificationRecipient = { userId: 102, email: "jo@example.com",   name: "Jo"   };
const NO_INBOX: NotificationRecipient = { userId: 103, email: null,           name: "Pat"  };

/**
 * Default channel — produces a deterministic per-recipient body so we
 * can assert that `template(recipient)` is what `sendEmail` actually
 * received (not some constant we sneaked in).
 */
const channelFor = (subjectPrefix = "Hi"): EmailChannel => ({
  template: (r) => ({
    to: r.email ?? "",
    subject: `${subjectPrefix} ${r.name}`,
    text: `Hello ${r.name} (#${r.userId})`,
  }),
});

// Deferred promise helper — used by the mode tests below to control
// when (if ever) sendEmail's returned promise settles.
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// ─── 1. Empty recipient list ─────────────────────────────────────────────────

describe("notify — empty recipient list", () => {
  it("is a no-op: dispatched=0, skipped=0; sendEmail not called", async () => {
    const result = await notify({
      to: [],
      channels: { email: channelFor() },
      context: "rfis.create",
    });
    // Default mode is fire-and-forget — result is mode-discriminated.
    expect(result).toEqual({ mode: "fire-and-forget", dispatched: 0, skipped: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

// ─── 2. Null-email skip ──────────────────────────────────────────────────────

describe("notify — null email recipient", () => {
  it("skips the null-email row, sends to the other; sent=1 / skipped=1 / failed=0", async () => {
    const result = await notify({
      to: [ALEX, NO_INBOX],
      channels: { email: channelFor() },
      context: "rfis.create",
    });
    expect(result).toEqual({ mode: "fire-and-forget", dispatched: 1, skipped: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith({
      to: "alex@example.com",
      subject: "Hi Alex",
      text: "Hello Alex (#100)",
    });
  });
});

// ─── 3. One sendEmail call per recipient ─────────────────────────────────────

describe("notify — one sendEmail call per addressable recipient", () => {
  it("invokes sendEmail with channel.template(recipient) for each of three valid recipients", async () => {
    const channel = channelFor("Notify");
    const result = await notify({
      to: [ALEX, SAM, JO],
      channels: { email: channel },
      context: "rfis.create",
    });
    expect(result).toEqual({ mode: "fire-and-forget", dispatched: 3, skipped: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(3);
    // Order-agnostic — sends may be dispatched concurrently. Compare as a set.
    const calls = sendEmail.mock.calls.map(([p]) => p);
    expect(calls).toEqual(
      expect.arrayContaining([
        { to: "alex@example.com", subject: "Notify Alex", text: "Hello Alex (#100)" },
        { to: "sam@example.com",  subject: "Notify Sam",  text: "Hello Sam (#101)"  },
        { to: "jo@example.com",   subject: "Notify Jo",   text: "Hello Jo (#102)"   },
      ]),
    );
  });
});

// ─── 4. Continue after one rejection ─────────────────────────────────────────

describe("notify — continues after one send rejects", () => {
  it("counts the rejection as failed, still attempts the others, never throws", async () => {
    // Mock the SECOND sendEmail call to reject. The first and third
    // resolve normally. Implementation may dispatch in any order, so we
    // pin behaviour by recipient identity rather than call index — but
    // mockImplementation is the simplest expression of "1st ok, 2nd
    // bad, 3rd ok" and gateway implementations almost always preserve
    // input order.
    sendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Brevo 500"))
      .mockResolvedValueOnce(undefined);

    // Silence the expected error log so test output stays readable; the
    // "logs include context" test below asserts on the log content.
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    const result = await notify({
      to: [ALEX, SAM, JO],
      channels: { email: channelFor() },
      context: "rfis.create",
      mode: "awaited",
    });

    expect(result).toEqual({
      mode: "awaited",
      sent: 2,
      failed: 1,
      skipped: 0,
      // The 2nd recipient's send rejected — the captured Error
      // is surfaced so callers can re-throw with the original
      // cause (e.g. `users.invite` does `throw result.errors[0]`
      // to preserve Brevo error messages for admin-facing throws).
      errors: [new Error("Brevo 500")],
    });
    expect(sendEmail).toHaveBeenCalledTimes(3);

    errSpy.mockRestore();
  });
});

// ─── 5. fire-and-forget mode resolves early ──────────────────────────────────

describe("notify — fire-and-forget mode", () => {
  it("resolves before the underlying sendEmail promises settle", async () => {
    // Controlled deferred: sendEmail returns a promise that we never
    // resolve. If notify() in fire-and-forget mode were waiting for the
    // sends, it would hang and the timeout below would fire.
    const d = deferred<void>();
    sendEmail.mockImplementation(() => d.promise);

    // Silence catch-handler logs from the never-settling send (some
    // implementations may attach a .catch for the eventual rejection).
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    const start = Date.now();
    const notifyPromise = notify({
      to: [ALEX],
      channels: { email: channelFor() },
      context: "rfis.create",
      mode: "fire-and-forget",
    });

    // Race notify() against a 50ms timer. A correct fire-and-forget
    // gateway resolves immediately; a buggy one would hang forever
    // because we never resolve `d`.
    const TIMEOUT_MS = 50;
    const winner = await Promise.race([
      notifyPromise.then(() => "notify" as const),
      new Promise<"timeout">((res) => setTimeout(() => res("timeout"), TIMEOUT_MS)),
    ]);
    const elapsed = Date.now() - start;

    expect(winner).toBe("notify");
    expect(elapsed).toBeLessThan(TIMEOUT_MS + 20);

    // Resolve the deferred so the dangling send doesn't keep the test
    // process alive past assertion completion.
    d.resolve();
    errSpy.mockRestore();
  });
});

// ─── 6. awaited mode waits for sends ─────────────────────────────────────────

describe("notify — awaited mode", () => {
  it("does NOT resolve until every sendEmail promise settles", async () => {
    const d1 = deferred<void>();
    const d2 = deferred<void>();
    sendEmail
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise);

    let settled = false;
    const notifyPromise = notify({
      to: [ALEX, SAM],
      channels: { email: channelFor() },
      context: "rfis.create",
      mode: "awaited",
    }).then((r) => { settled = true; return r; });

    // Yield once so any synchronous bodies inside notify() have a
    // chance to run, then verify it has NOT yet resolved.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    // Settle the first send only — notify still must not resolve.
    d1.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    // Settle the second — now notify must resolve.
    d2.resolve();
    const result = await notifyPromise;
    expect(settled).toBe(true);
    expect(result).toEqual({ mode: "awaited", sent: 2, failed: 0, skipped: 0, errors: [] });
  });
});

// ─── 8. Sync template throw (Architect H1) ───────────────────────────────────

describe("notify — sync throw inside channel.template", () => {
  it("treats a sync template throw as a failure (caught + logged), continues other recipients", async () => {
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    // Template throws on the second recipient only — exercises the
    // Promise.resolve().then(() => sendEmail(template(r))) wrapper.
    let calls = 0;
    const channel: EmailChannel = {
      template: (r) => {
        calls++;
        if (calls === 2) throw new Error("template boom");
        return { to: r.email!, subject: `Hi ${r.name}`, text: `Hello ${r.name}` };
      },
    };

    const result = await notify({
      to: [ALEX, SAM, JO],
      channels: { email: channel },
      context: "rfis.create",
      mode: "awaited",
    });

    // SAM's send was never issued (template threw before sendEmail
    // was invoked); ALEX and JO sent normally.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ mode: "awaited", sent: 2, failed: 1, skipped: 0 });
    expect(result.mode === "awaited" && result.errors).toHaveLength(1);
    expect(result.mode === "awaited" && result.errors[0]).toBeInstanceOf(Error);
    expect(result.mode === "awaited" && (result.errors[0] as Error).message).toBe("template boom");

    // The thrown error must be logged with the context tag — same
    // path as a sendEmail rejection.
    const logged = errSpy.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("rfis.create")),
    );
    expect(logged).toBe(true);

    errSpy.mockRestore();
  });
});

// ─── 8b. Awaited result.errors preserves rejection causes in dispatch order ──

describe("notify — awaited result.errors", () => {
  it("captures rejection reasons in dispatch order so callers can re-throw the original", async () => {
    // Two recipients fail with distinct errors; one succeeds. The
    // result.errors array is the load-bearing surface for callers
    // that need to preserve the original error message (e.g.
    // `users.invite` re-throws `result.errors[0]` to keep its
    // .rejects.toThrow(/Brevo/i) test contract).
    const errA = new Error("Brevo 502 Bad Gateway");
    const errB = new Error("Brevo 503 Service Unavailable");
    sendEmail
      .mockRejectedValueOnce(errA)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(errB);

    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    const result = await notify({
      to: [ALEX, SAM, JO],
      channels: { email: channelFor() },
      context: "rfis.create",
      mode: "awaited",
    });

    expect(result.mode).toBe("awaited");
    if (result.mode !== "awaited") throw new Error("type narrowing");
    expect(result.failed).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toBe(errA);
    expect(result.errors[1]).toBe(errB);

    errSpy.mockRestore();
  });
});

// ─── 9. No unhandledRejection from fire-and-forget (Architect H3) ────────────

describe("notify — fire-and-forget never produces unhandledRejection", () => {
  it("a sendEmail rejection in fire-and-forget mode does NOT escape as unhandledRejection", async () => {
    sendEmail.mockRejectedValue(new Error("Brevo 503"));
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    // Track unhandled rejections globally during the test window.
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on("unhandledRejection", onUnhandled);

    try {
      await notify({
        to: [ALEX, SAM],
        channels: { email: channelFor() },
        context: "rfis.create",
        mode: "fire-and-forget",
      });

      // Give the rejected sends time to flow through the .catch chain.
      // Two macrotasks is generous: the .catch is attached synchronously,
      // so the rejection is caught on the FIRST microtask after notify()
      // returns. Wait twice to be defensive against timing skew.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));

      expect(unhandled).toEqual([]);
      // Logs WERE produced — that's the gateway's promise. We're only
      // pinning that they don't ALSO escape as unhandledRejection.
      expect(errSpy).toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandled);
      errSpy.mockRestore();
    }
  });
});

// ─── 7. Error logs include the context tag ───────────────────────────────────

describe("notify — error logs include context", () => {
  it("forces a send rejection and asserts the error log mentions params.context", async () => {
    sendEmail.mockRejectedValueOnce(new Error("Brevo 503"));
    const errSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    await notify({
      to: [ALEX],
      channels: { email: channelFor() },
      context: "rfis.create",
      mode: "awaited",
    });

    // Grep all console.error invocations for the context tag. Match on
    // the joined args so an implementation that uses the prefix style
    // `"[rfis.create] email send failed:"` (current legacy code) and
    // a future structured-log style `({ context: "rfis.create" }, err)`
    // both pass.
    const logged = errSpy.mock.calls.some((args) =>
      args.some((a) => {
        if (typeof a === "string") return a.includes("rfis.create");
        try { return JSON.stringify(a).includes("rfis.create"); } catch { return false; }
      }),
    );
    expect(logged).toBe(true);

    errSpy.mockRestore();
  });
});

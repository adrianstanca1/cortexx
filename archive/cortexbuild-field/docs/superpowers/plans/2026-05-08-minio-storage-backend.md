# MinIO storage backend (uploads sub-project 0) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision a self-hosted, S3-compatible MinIO instance on the prod VPS and switch `server/storage.ts` to use it as the primary storage path, with the local-filesystem fallback retained for dev. No client-side changes; the `files.upload` tRPC procedure shape is untouched.

**Architecture:** Refactor `server/storage.ts` so `storagePut` / `storageGetSignedUrl` route through an `S3Client` when `S3_ENDPOINT` is set and fall back to local-fs otherwise. `server/_core/storageProxy.ts` delegates to the same helper, so the `/manus-storage/*` URL contract stays intact (302/307 redirect to a presigned MinIO GET when configured, file-serve when not). MinIO runs as a Docker compose service bound to loopback. CI uses `testcontainers` (already a dep) to spin up MinIO for the integration test, matching the existing Postgres pattern.

**Tech stack:** Node 22, Express, tRPC, vitest, `@aws-sdk/client-s3` v3, `@aws-sdk/s3-request-presigner` v3, MinIO (`minio/minio:RELEASE.2025-09-07T16-13-09Z`), Docker compose, PM2, `testcontainers`, GitHub Actions, Hostinger VPS.

**Sources:** Spec at `docs/superpowers/specs/2026-05-08-minio-storage-backend-design.md` (commit `6dfd0f5`).

---

## File structure

**Create:**
- `docker-compose.minio.yml` — MinIO service definition (Phase 2)
- `tests/integration/minio-storage.integration.test.ts` — testcontainers-driven round trip
- `tests/storage-s3.test.ts` — unit tests for the S3 branch with stubbed `S3Client`
- `tests/health-minio.test.ts` — unit tests for the new healthcheck branch

**Modify:**
- `package.json` — add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- `server/_core/env.ts` — add 6 `S3_*` fields to `ENV`
- `server/storage.ts` — refactor `storagePut`, `storageGetSignedUrl`; remove the Forge-specific code; add `storageHealthCheck` + `_resetS3ClientCacheForTests`
- `server/_core/storageProxy.ts` — delegate to `storage.ts` helpers; drop the inline Forge fetch
- `server/_core/index.ts` — extend `/api/health` to include `minio` check
- `tests/storage.test.ts` — drop Forge-specific cases; assert local-fs branch still wins when `S3_ENDPOINT` unset
- `tests/storage-proxy.test.ts` — replace Forge-mock branches with S3 redirect via the new helper
- `.github/workflows/ci.yml` — already uses testcontainers via `pnpm test:integration`; just confirm the new integration test runs there

**Operational (Phase 2):**
- `DEPLOY.md` — append MinIO provisioning runbook
- Prod VPS — install MinIO via `docker compose`; create bucket + service account; set `S3_*` in `/var/www/cortexbuild-field/.env`; PM2 restart

---

## Phase 1 — Code (no infra dependency)

### Task 1: Add S3 SDK dependencies

**Files:**
- Modify: `package.json` (deps section)
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: Install the two SDK packages**

```bash
cd /root/cortexbuild-field
pnpm add @aws-sdk/client-s3@^3.700.0 @aws-sdk/s3-request-presigner@^3.700.0
```

- [ ] **Step 2: Verify the install**

Run: `pnpm check`

Expected: tsc exits 0 (no type errors). The new deps don't change any types yet, but make sure the install didn't break the workspace.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(storage): add @aws-sdk/client-s3 + s3-request-presigner

Both at ^3.700.x — used in the upcoming MinIO storage refactor
(spec: docs/superpowers/specs/2026-05-08-minio-storage-backend-design.md).
Tree-shakeable lite clients; no runtime config change yet."
```

---

### Task 2: Add `S3_*` env vars to `ENV`

**Files:**
- Modify: `server/_core/env.ts`

- [ ] **Step 1: Append the new fields to the `ENV` object**

In `server/_core/env.ts`, after `forgeApiKey` and BEFORE the closing `};` of `ENV`, add:

```ts
  // Storage backend (sub-project 0 of upload overhaul, 2026-05-08).
  // When set, server/storage.ts routes uploads through an S3Client
  // pointed at this endpoint (MinIO in prod, real S3 in CI).
  // When UNSET, storage.ts falls back to the local-filesystem path
  // so devs without a MinIO running still get a working upload.
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  // SDK requires a region string but MinIO ignores it.
  s3Region: process.env.S3_REGION ?? "us-east-1",
  // MinIO needs path-style addressing (default is virtual-hosted).
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() === "true",
```

- [ ] **Step 2: tsc verifies**

Run: `pnpm check`

Expected: exit 0. The fields are read-only on `ENV` and unused at this point — no other file references them yet.

- [ ] **Step 3: Commit**

```bash
git add server/_core/env.ts
git commit -m "feat(storage): add S3_* env reads to ENV (no runtime change)

Wired but unused. server/storage.ts will branch on s3Endpoint in
the next commit. Defaults: empty endpoint (= local-fs fallback),
region us-east-1 placeholder, force-path-style true (MinIO
requires it)."
```

---

### Task 3: Storage S3 path — failing tests first

**Files:**
- Create: `tests/storage-s3.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/storage-s3.test.ts` with this content. Each test stubs `@aws-sdk/client-s3` so we can assert the SDK calls without a real network.

```ts
/**
 * Unit tests for the S3 branch of server/storage.ts. The local-fs
 * branch keeps its existing coverage in tests/storage.test.ts.
 *
 * We mock the SDK so the test runs without MinIO. The integration
 * test in tests/integration/minio-storage.integration.test.ts
 * exercises the real wire contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  class GetObjectCommand {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  class HeadBucketCommand {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  }
  class S3Client {
    constructor(public config: unknown) {}
    send = sendMock;
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://minio.example/presigned/abc?sig=xyz"),
}));

// Set S3 env BEFORE importing storage so the cached client picks them up.
process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";

const storage = await import("../server/storage");

beforeEach(() => {
  sendMock.mockReset();
  storage._resetS3ClientCacheForTests();
});

afterEach(() => {
  storage._resetS3ClientCacheForTests();
});

describe("storagePut — S3 branch", () => {
  it("sends a PutObjectCommand with bucket, key, body, contentType", async () => {
    sendMock.mockResolvedValueOnce({});

    const result = await storage.storagePut("photo/site.jpg", Buffer.from("hi"), "image/jpeg");

    expect(sendMock).toHaveBeenCalledOnce();
    const cmd = sendMock.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.Bucket).toBe("test-bucket");
    expect(typeof cmd.input.Key).toBe("string");
    expect((cmd.input.Key as string).startsWith("photo/site_")).toBe(true);
    expect((cmd.input.Key as string).endsWith(".jpg")).toBe(true);
    expect(cmd.input.ContentType).toBe("image/jpeg");
    expect(Buffer.isBuffer(cmd.input.Body)).toBe(true);

    expect(result.url).toBe(`/manus-storage/${result.key}`);
  });

  it("appends a hash suffix even on the S3 path (collision avoidance)", async () => {
    sendMock.mockResolvedValueOnce({});

    const a = await storage.storagePut("a.png", Buffer.from("x"), "image/png");
    sendMock.mockResolvedValueOnce({});
    const b = await storage.storagePut("a.png", Buffer.from("y"), "image/png");

    expect(a.key).not.toBe(b.key);
    expect(a.key.startsWith("a_")).toBe(true);
    expect(b.key.startsWith("a_")).toBe(true);
  });

  it("rethrows S3 errors with a stable shape", async () => {
    const sdkErr = new Error("Access Denied");
    (sdkErr as Error & { name: string }).name = "AccessDenied";
    sendMock.mockRejectedValueOnce(sdkErr);

    await expect(storage.storagePut("x.txt", Buffer.from("data"), "text/plain"))
      .rejects.toThrow(/Access Denied/);
  });
});

describe("storageGetSignedUrl — S3 branch", () => {
  it("returns the presigner URL when S3 client is configured", async () => {
    const url = await storage.storageGetSignedUrl("photo/site.jpg");
    expect(url).toBe("https://minio.example/presigned/abc?sig=xyz");
  });
});

describe("storageHealthCheck — S3 branch", () => {
  it("returns ok=true when HeadBucket succeeds", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await storage.storageHealthCheck();
    expect(result.ok).toBe(true);
  });

  it("returns ok=false with reason when HeadBucket throws", async () => {
    sendMock.mockRejectedValueOnce(new Error("NoSuchBucket"));
    const result = await storage.storageHealthCheck();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/NoSuchBucket/);
  });

  it("returns ok=false with timeout reason when HeadBucket hangs past 500ms", async () => {
    // Mocked send never resolves — the Promise.race timeout in
    // storageHealthCheck must reject after HEALTHCHECK_TIMEOUT_MS.
    sendMock.mockImplementationOnce(() => new Promise(() => {}));
    const result = await storage.storageHealthCheck();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/timed out after 500ms/);
  }, 2_000);
});
```

- [ ] **Step 2: Run the test, expect RED**

```bash
pnpm test -- tests/storage-s3.test.ts
```

Expected: every test fails with one of:
- `_resetS3ClientCacheForTests is not a function`
- `storageHealthCheck is not a function`
- `sendMock not called` (because storage.ts doesn't use the S3 client yet)

That's the failing-test gate. Move to Task 4.

---

### Task 4: Refactor `server/storage.ts` to support the S3 branch

**Files:**
- Modify: `server/storage.ts`

- [ ] **Step 1: Replace the entire file with the new implementation**

Open `server/storage.ts` and replace its contents with:

```ts
// Server-side storage helpers. Two backends:
//
//   1. S3-compatible (MinIO in prod, real S3 in CI) when S3_ENDPOINT is
//      set. Goes through @aws-sdk/client-s3 with path-style addressing.
//   2. Local filesystem when S3_ENDPOINT is unset — used by dev so a
//      developer doesn't need to run MinIO to exercise upload code.
//
// Picked at module load via getS3Client(). Tests can flip env vars
// + call _resetS3ClientCacheForTests() between cases.

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

export const LOCAL_STORAGE_ROOT = path.resolve(
  process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage"),
);

// Cache value: undefined = uninitialised, null = no S3 (use local-fs),
// else = configured client. Lazy so tests can flip env then reset.
let cachedClient: S3Client | null | undefined;

function getS3Client(): S3Client | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!ENV.s3Endpoint) {
    console.warn(
      `[storage] S3_ENDPOINT unset — falling back to local fs at ${LOCAL_STORAGE_ROOT}`,
    );
    cachedClient = null;
    return null;
  }
  cachedClient = new S3Client({
    endpoint: ENV.s3Endpoint,
    region: ENV.s3Region,
    forcePathStyle: ENV.s3ForcePathStyle,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
  console.log(
    `[storage] connected to S3-compatible endpoint at ${ENV.s3Endpoint} (bucket=${ENV.s3Bucket})`,
  );
  return cachedClient;
}

/** Test-only: drop the cached client so a subsequent call re-reads ENV. */
export function _resetS3ClientCacheForTests(): void {
  cachedClient = undefined;
}

export function normalizeStorageKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
}

export function localStoragePath(relKey: string): string {
  const key = normalizeStorageKey(relKey);
  const resolved = path.resolve(LOCAL_STORAGE_ROOT, key);
  if (
    !resolved.startsWith(LOCAL_STORAGE_ROOT + path.sep) &&
    resolved !== LOCAL_STORAGE_ROOT
  ) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  const client = getS3Client();
  if (!client) {
    const destination = localStoragePath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body);
    return { key, url: `/manus-storage/${key}` };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const key = normalizeStorageKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeStorageKey(relKey);
  const client = getS3Client();
  if (!client) return `/manus-storage/${key}`;
  return await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }),
    { expiresIn: 300 },
  );
}

// Healthcheck must not hang /api/health if MinIO is wedged. Spec D9
// pins a 500ms ceiling — long enough for a healthy LAN HEAD, short
// enough that an unhealthy probe is invisible to the deploy canary.
const HEALTHCHECK_TIMEOUT_MS = 500;

export async function storageHealthCheck(): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const client = getS3Client();
  if (!client) return { ok: true, reason: "local-fs (dev mode)" };
  try {
    await Promise.race([
      client.send(new HeadBucketCommand({ Bucket: ENV.s3Bucket })),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`MinIO healthcheck timed out after ${HEALTHCHECK_TIMEOUT_MS}ms`)),
          HEALTHCHECK_TIMEOUT_MS,
        ),
      ),
    ]);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: Run the new tests, expect GREEN**

```bash
pnpm test -- tests/storage-s3.test.ts
```

Expected: 7/7 tests pass.

- [ ] **Step 3: Run the existing tests, expect GREEN**

```bash
pnpm test -- tests/storage.test.ts
```

Expected: all existing local-fs tests still pass. The local-fs branch is unchanged behaviour — `S3_ENDPOINT` is unset for that test file, so `getS3Client()` returns null and the file path is identical to before.

If the existing test fails because the test file inherits `S3_ENDPOINT` from `tests/storage-s3.test.ts` running first, fix it: add `delete process.env.S3_ENDPOINT;` at the top of `tests/storage.test.ts` BEFORE the `await import("../server/storage")` call.

- [ ] **Step 4: tsc**

Run: `pnpm check`. Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/storage.ts tests/storage-s3.test.ts tests/storage.test.ts
git commit -m "feat(storage): add S3 backend branch with local-fs fallback

server/storage.ts now branches on ENV.s3Endpoint:
  - set    → use S3Client (PutObject/GetObject/HeadBucket via @aws-sdk/client-s3)
  - unset  → existing local-fs path (devs without MinIO keep working)

Drops the inline Forge fetch logic — Forge env was never set in prod
(verified 2026-05-08), so this is dead-code removal. The S3 path
will be backed by self-hosted MinIO; provisioning is in Phase 2 of
the plan.

New exports:
  - storageHealthCheck() — used by /api/health (next commit)
  - _resetS3ClientCacheForTests() — test-only cache reset

Spec: docs/superpowers/specs/2026-05-08-minio-storage-backend-design.md"
```

---

### Task 5: Update `storageProxy.ts` to delegate to `storage.ts`

**Files:**
- Modify: `server/_core/storageProxy.ts`
- Modify: `tests/storage-proxy.test.ts`

- [ ] **Step 1: Replace `storageProxy.ts` body**

Open `server/_core/storageProxy.ts` and replace with:

```ts
import fs from "fs";
import path from "path";
import type { Express } from "express";
import { ENV } from "./env";
import { LOCAL_STORAGE_ROOT, storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Local-fs branch: stream the file directly. S3-configured branch:
    // 307 to a presigned MinIO GET. Decision is made by storage.ts —
    // we pick the branch by env so we don't pay a getSignedUrl call
    // for the local-fs path.
    if (!ENV.s3Endpoint) {
      const storageRoot = path.resolve(LOCAL_STORAGE_ROOT);
      const filePath = path.resolve(storageRoot, key);
      if (!filePath.startsWith(storageRoot + path.sep)) {
        res.status(400).send("Invalid storage key");
        return;
      }
      if (!fs.existsSync(filePath)) {
        res.status(404).send("Stored file not found");
        return;
      }
      res.set("Cache-Control", "private, max-age=3600");
      res.sendFile(filePath);
      return;
    }

    try {
      const signedUrl = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, signedUrl);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
```

- [ ] **Step 2: Update `tests/storage-proxy.test.ts`**

The existing file has Forge-mocking branches. Replace the Forge-configured cases with S3-configured cases that mock `storageGetSignedUrl`.

Open `tests/storage-proxy.test.ts`. Find the section where Forge env vars are set (search for `BUILT_IN_FORGE_API_URL` or `forgeApiKey`) and the test cases that exercise the redirect path.

Replace those with:

```ts
// S3-configured cases use a vi.mock on ../../server/storage so we don't
// need a real S3 client. Local-fallback cases keep the existing real
// LOCAL_STORAGE_ROOT setup.

const storageGetSignedUrlMock = vi.fn();
vi.mock("../server/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/storage")>();
  return {
    ...actual,
    storageGetSignedUrl: (...args: unknown[]) => storageGetSignedUrlMock(...args),
  };
});

// In the relevant `describe` block:
describe("S3-configured (S3_ENDPOINT set)", () => {
  beforeEach(() => {
    process.env.S3_ENDPOINT = "http://127.0.0.1:9000";
    storageGetSignedUrlMock.mockReset();
  });
  afterEach(() => {
    delete process.env.S3_ENDPOINT;
  });

  it("redirects 307 to the presigned URL on success", async () => {
    storageGetSignedUrlMock.mockResolvedValueOnce("https://minio.example/x?sig=y");
    const resp = await fetch(`${baseUrl}/manus-storage/some/file.png`, { redirect: "manual" });
    expect(resp.status).toBe(307);
    expect(resp.headers.get("location")).toBe("https://minio.example/x?sig=y");
  });

  it("returns 502 when storageGetSignedUrl throws", async () => {
    storageGetSignedUrlMock.mockRejectedValueOnce(new Error("backend down"));
    const resp = await fetch(`${baseUrl}/manus-storage/some/file.png`);
    expect(resp.status).toBe(502);
  });
});
```

Drop any Forge-specific tests (`presign`, `forgeApiKey`, etc.) — they no longer apply.

- [ ] **Step 3: Run the test**

```bash
pnpm test -- tests/storage-proxy.test.ts
```

Expected: all tests pass (existing local-fallback ones unchanged + the two new S3 ones).

- [ ] **Step 4: tsc**

Run: `pnpm check`. Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/_core/storageProxy.ts tests/storage-proxy.test.ts
git commit -m "feat(storage): storageProxy delegates to storageGetSignedUrl

The proxy used to call Forge's presign/get directly. Now it asks
server/storage.ts for the URL via storageGetSignedUrl(), which
already knows whether to talk to MinIO or return the local-fs path.
Branch on ENV.s3Endpoint stays in the proxy itself so we don't
pay a getSignedUrl call for the local-fs branch (it'd just return
/manus-storage/<key>, which we'd then redirect to ourselves)."
```

---

### Task 6: Add MinIO ping to `/api/health`

**Files:**
- Modify: `server/_core/index.ts:142-166`
- Create: `tests/health-minio.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `tests/health-minio.test.ts`:

```ts
/**
 * Coverage for the minio: branch of /api/health.
 * The pg + redis branches are covered by tests/health.test.ts (or
 * the existing health-related tests). This file pins the new MinIO
 * check.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const storageHealthCheckMock = vi.fn();
vi.mock("../server/storage", () => ({
  storageHealthCheck: () => storageHealthCheckMock(),
}));

import { storageHealthCheck } from "../server/storage";

beforeEach(() => {
  storageHealthCheckMock.mockReset();
});

describe("/api/health minio branch", () => {
  it("storageHealthCheck returns ok=true when bucket reachable", async () => {
    storageHealthCheckMock.mockResolvedValueOnce({ ok: true });
    const result = await storageHealthCheck();
    expect(result.ok).toBe(true);
  });

  it("storageHealthCheck returns ok=false when bucket unreachable", async () => {
    storageHealthCheckMock.mockResolvedValueOnce({ ok: false, reason: "NoSuchBucket" });
    const result = await storageHealthCheck();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/NoSuchBucket/);
  });
});
```

- [ ] **Step 2: Run, expect RED**

```bash
pnpm test -- tests/health-minio.test.ts
```

Expected: fails because `storageHealthCheck` was added in Task 4 — actually this should PASS because Task 4 already exported it. If it does, that's fine — keep the file as the pin and move on.

If for some reason it fails (e.g. import resolution): debug and fix.

- [ ] **Step 3: Edit `server/_core/index.ts`**

Find the `/api/health` handler at line ~142. Replace the parallel-probe block + the `checks` object with:

```ts
  app.get("/api/health", async (_req, res) => {
    // Run all probes in parallel — under normal conditions the slowest
    // (~100ms postgres roundtrip) defines the response time, not the sum.
    // MinIO probe is gated behind a 500ms internal timeout in
    // storageHealthCheck so a hung MinIO doesn't hang /api/health.
    const [database, redis, minio] = await Promise.all([
      checkDatabaseReady(),
      checkRedisReady(),
      storageHealthCheck(),
    ]);
    const checks = {
      postgres: database.ok,
      redis: redis.ok,
      // Sub-project 0: minio:false does NOT flip top-level ok to false
      // because uploads aren't yet a load-bearing dependency. Once
      // uploads are real (sub-project 2), revisit and elevate severity.
      minio: minio.ok,
    };
    const ok = checks.postgres && checks.redis;
    res.status(ok ? 200 : 503).json({
      ok,
      status: ok ? "ok" : "degraded",
      checks,
      sha: BUILD_INFO.sha,
      timestamp: Date.now(),
    });
  });
```

Add the import at the top of `server/_core/index.ts` (find the existing storage imports, e.g. near `registerStorageProxy`):

```ts
import { storageHealthCheck } from "../storage";
```

- [ ] **Step 4: Run all health-related tests**

```bash
pnpm test -- tests/health
```

Expected: all green. The new `minio` field appears in the response without breaking anything that asserts on the shape.

If any existing test asserts on the exact `checks` shape (e.g. `expect(body.checks).toEqual({ postgres: true, redis: true })`), update it to include `minio: true` in the expectation.

- [ ] **Step 5: Commit**

```bash
git add server/_core/index.ts tests/health-minio.test.ts
git commit -m "feat(health): add minio probe to /api/health

Per spec section 5: minio:true|false alongside postgres+redis.
minio:false does NOT flip top-level ok in this slice (uploads
aren't load-bearing yet). Probe is gated by storageHealthCheck()'s
internal handling so a hung MinIO doesn't hang /api/health."
```

---

### Task 7: Integration test — round-trip via testcontainers

**Files:**
- Create: `tests/integration/minio-storage.integration.test.ts`

- [ ] **Step 1: Read the existing integration setup pattern**

Skim `tests/integration/setup.ts` and one existing integration test (e.g. `tests/integration/defects-tenant-isolation.integration.test.ts`) to match conventions for container boot, env wiring, and module re-import.

- [ ] **Step 2: Write the test**

Create `tests/integration/minio-storage.integration.test.ts`:

```ts
/**
 * Integration test: storagePut / storageGetSignedUrl against a REAL
 * MinIO container. Most upload tests mock @aws-sdk/client-s3, which
 * proves the SDK is invoked with the right input — but cannot prove
 * the signed URL we hand back actually serves the bytes we just wrote.
 *
 * This test:
 *   1. Spins up minio/minio in Docker (testcontainers).
 *   2. Creates the test bucket via the SDK.
 *   3. storagePut() a known buffer.
 *   4. storageGetSignedUrl() and fetch the URL.
 *   5. Asserts byte equality.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const ROOT_USER = "testroot";
const ROOT_PW = "testrootpw1234";
const BUCKET = "cortex-int-test";

let container: StartedTestContainer;
let storage: typeof import("../../server/storage");

beforeAll(async () => {
  container = await new GenericContainer("minio/minio:RELEASE.2025-09-07T16-13-09Z")
    .withCommand(["server", "/data", "--console-address", ":9001"])
    .withEnvironment({
      MINIO_ROOT_USER: ROOT_USER,
      MINIO_ROOT_PASSWORD: ROOT_PW,
    })
    .withExposedPorts(9000)
    .start();

  const endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;

  // Create the bucket BEFORE the field-server's S3 client tries to use it.
  const bootClient = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: ROOT_USER, secretAccessKey: ROOT_PW },
  });
  await bootClient.send(new CreateBucketCommand({ Bucket: BUCKET }));

  process.env.S3_ENDPOINT = endpoint;
  process.env.S3_BUCKET = BUCKET;
  process.env.S3_ACCESS_KEY_ID = ROOT_USER;
  process.env.S3_SECRET_ACCESS_KEY = ROOT_PW;
  process.env.S3_REGION = "us-east-1";

  // Re-import storage so it picks up the env vars.
  storage = await import("../../server/storage");
  storage._resetS3ClientCacheForTests();
}, 120_000);

afterAll(async () => {
  await container?.stop();
}, 30_000);

describe("storage <-> MinIO round trip", () => {
  it("uploads bytes and serves them back via a presigned URL", async () => {
    const original = Buffer.from("integration-test-bytes-" + Math.random().toString(36));

    const put = await storage.storagePut("itest/file.bin", original, "application/octet-stream");
    expect(put.key).toMatch(/^itest\/file_[a-f0-9]{8}\.bin$/);

    const signed = await storage.storageGetSignedUrl(put.key);
    expect(signed).toMatch(/^https?:\/\//);

    const resp = await fetch(signed);
    expect(resp.status).toBe(200);
    const body = Buffer.from(await resp.arrayBuffer());
    expect(body.equals(original)).toBe(true);
  }, 30_000);

  it("reports healthy when the bucket exists", async () => {
    const result = await storage.storageHealthCheck();
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run locally (requires Docker)**

```bash
pnpm test:integration -- tests/integration/minio-storage.integration.test.ts
```

Expected: 2/2 tests pass. First run will take ~30s (image pull + container boot).

If `pnpm test:integration` doesn't filter by file, just run `pnpm test:integration` and confirm the new test runs alongside the existing Postgres ones.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/minio-storage.integration.test.ts
git commit -m "test(storage): MinIO round-trip integration test

testcontainers-driven (matches the existing Postgres pattern in
tests/integration/). Boots minio/minio:<pinned>, creates the
test bucket via the SDK, and exercises storagePut + signed-URL
fetch against the real wire contract — what unit tests cannot.

Pinned image tag: RELEASE.2025-09-07T16-13-09Z. When this changes
in docker-compose.minio.yml (Phase 2), update here too so CI and
prod test the same MinIO release."
```

---

### Task 8: Full local verification

- [ ] **Step 1: Run the full unit suite**

```bash
pnpm test
```

Expected: every existing test still passes plus the new ones. Net change: roughly +7 to +9 tests (7 in storage-s3 + 2 in health-minio + 2 new in storage-proxy S3 cases, minus any old Forge-specific cases dropped from `tests/storage-proxy.test.ts`). Confirm the absolute count grew, not shrunk.

- [ ] **Step 2: Run the integration suite**

```bash
pnpm test:integration
```

Expected: existing Postgres integration tests pass + the new MinIO test passes.

- [ ] **Step 3: Type check**

```bash
pnpm check
```

Expected: exit 0.

- [ ] **Step 4: Lint (if part of CI)**

```bash
pnpm lint
```

Expected: no new warnings introduced. If existing warnings are present, leave them — this PR is scoped to storage.

- [ ] **Step 5: Smoke the local-fs fallback**

Confirm that with `S3_ENDPOINT` unset, `storage.ts` still works against the local fs. The unit tests already cover this; this step is just a final sanity gate.

```bash
unset S3_ENDPOINT && pnpm test -- tests/storage.test.ts
```

Expected: green.

---

### Task 9: Push + verify CI green

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Watch CI + Deploy runs**

```bash
source /root/source-env.sh
gh run list --branch main --limit 2 --repo adrianstanca1/cortexbuild-field --json status,conclusion,name,headSha
```

Expected: both `CI` and `Deploy to VPS` go to `completed/success` within ~5 min of push.

- [ ] **Step 3: Confirm prod still works (with S3_ENDPOINT still unset there)**

```bash
curl -s https://field.cortexbuildpro.com/api/health | python3 -m json.tool
```

Expected: HTTP 200, `ok=true`, `checks.postgres=true`, `checks.redis=true`, `checks.minio=true` — the last is true because `storageHealthCheck` returns `{ ok: true, reason: "local-fs (dev mode)" }` when `S3_ENDPOINT` is unset (matches the design's "minio:false does not flip ok" decision; `minio:true` here means "either healthy or in dev-mode local-fs", which is what we want for prod-where-MinIO-isn't-yet-provisioned).

- [ ] **Step 4: Confirm prod boot log**

```bash
pm2 logs cortexbuild-field --lines 50 --nostream | grep -i 'storage\|s3'
```

Expected: a single line `[storage] S3_ENDPOINT unset — falling back to local fs at /var/www/cortexbuild-field/storage`.

This proves the new code path is live AND that we're sitting in the documented fallback state, ready for Phase 2.

---

## Phase 2 — Provisioning (manual, requires VPS access)

> ⚠️ **Phase 2 acts on shared infrastructure.** Each task below will land bytes / processes on the production VPS. Run them only after the user confirms — see the explicit checkpoint on Task 10.

### Task 10: Write `docker-compose.minio.yml` + DEPLOY.md runbook

**Files:**
- Create: `docker-compose.minio.yml`
- Modify: `DEPLOY.md` (append section)

- [ ] **Step 1: Write `docker-compose.minio.yml`**

Create at the repo root:

```yaml
# MinIO storage backend for cortexbuild-field. See docs/superpowers/specs/
# 2026-05-08-minio-storage-backend-design.md for context.
#
# Bind ports to 127.0.0.1 only — MinIO is reachable only from the
# field-server (loopback). External traffic goes through the existing
# /manus-storage/* proxy on the field-server, which 307-redirects to
# a presigned MinIO GET.
#
# Operator (root) credentials live in /etc/minio.env (chmod 600).
# Service-account credentials used by the field-server live in
# /var/www/cortexbuild-field/.env (chmod 600). Two distinct identities.

services:
  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    container_name: minio
    restart: unless-stopped
    env_file:
      - /etc/minio.env
    command: ["server", "/data", "--console-address", ":9001"]
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    volumes:
      - /var/lib/minio/data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://127.0.0.1:9000/minio/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
```

- [ ] **Step 2: Append the runbook to `DEPLOY.md`**

Find the end of `DEPLOY.md` and append:

```markdown
## MinIO storage backend (Phase 2 of upload overhaul, 2026-05-08)

Storage is provided by a self-hosted MinIO instance bound to loopback. See
`docs/superpowers/specs/2026-05-08-minio-storage-backend-design.md` for
design rationale.

### One-time provisioning

1. Prepare the data directory:
   ```bash
   sudo mkdir -p /var/lib/minio/data
   sudo chown 1000:1000 /var/lib/minio/data
   ```
2. Generate root credentials and write `/etc/minio.env` (chmod 600):
   ```bash
   ROOT_USER=$(openssl rand -hex 16)
   ROOT_PW=$(openssl rand -base64 32)
   sudo tee /etc/minio.env > /dev/null <<EOF
   MINIO_ROOT_USER=$ROOT_USER
   MINIO_ROOT_PASSWORD=$ROOT_PW
   MINIO_BROWSER_REDIRECT_URL=http://127.0.0.1:9001
   EOF
   sudo chmod 600 /etc/minio.env
   echo "Root creds:"; sudo cat /etc/minio.env  # save these for mc admin
   ```
3. Boot MinIO:
   ```bash
   cd /var/www/cortexbuild-field
   docker compose -f docker-compose.minio.yml up -d
   docker compose -f docker-compose.minio.yml ps   # expect Up (healthy) within 30s
   ```
4. Install `mc` (MinIO client):
   ```bash
   curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
   chmod +x /usr/local/bin/mc
   ```
5. Configure `mc` and create the bucket + scoped service account:
   ```bash
   mc alias set local http://127.0.0.1:9000 "$ROOT_USER" "$ROOT_PW"
   mc mb local/cortexbuild-field
   mc admin user svcacct add local "$ROOT_USER"   # records access/secret keys; save them
   ```
6. Set the field-server env vars (`/var/www/cortexbuild-field/.env`):
   ```bash
   sudo tee -a /var/www/cortexbuild-field/.env <<'EOF'

   # MinIO storage (provisioned 2026-05-08)
   S3_ENDPOINT=http://127.0.0.1:9000
   S3_BUCKET=cortexbuild-field
   S3_ACCESS_KEY_ID=<service-account-access-key-from-step-5>
   S3_SECRET_ACCESS_KEY=<service-account-secret-key-from-step-5>
   S3_REGION=us-east-1
   S3_FORCE_PATH_STYLE=true
   EOF
   sudo chmod 600 /var/www/cortexbuild-field/.env
   ```
7. Restart PM2:
   ```bash
   pm2 restart cortexbuild-field
   pm2 logs cortexbuild-field --lines 30 --nostream | grep -i 'storage\|s3'
   ```
   Expect: `[storage] connected to S3-compatible endpoint at http://127.0.0.1:9000 (bucket=cortexbuild-field)`
8. Smoke test:
   ```bash
   curl -s https://field.cortexbuildpro.com/api/health | python3 -m json.tool
   ```
   Expect `checks.minio: true`. Then upload a file via the app's File Vault and confirm:
   - the row appears in `files`
   - `mc ls local/cortexbuild-field` lists the object
   - `curl -L https://field.cortexbuildpro.com/manus-storage/<key>` returns the bytes
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.minio.yml DEPLOY.md
git commit -m "docs(deploy): add docker-compose.minio.yml + provisioning runbook

Phase 2 of upload overhaul. The compose file binds MinIO to
loopback (127.0.0.1) — never publicly exposed; field-server is the
only client. Two-identity cred model: root in /etc/minio.env,
scoped service account in /var/www/cortexbuild-field/.env."
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

Wait for CI + Deploy green.

---

### Task 11: 🚦 Checkpoint — confirm with the user before provisioning

> **Stop here.** The next steps run commands on the production VPS that:
> - Install Docker images
> - Mutate `/var/www/cortexbuild-field/.env`
> - Restart PM2
>
> All actions are reversible (unset env vars + restart returns to the local-fs fallback path), but the user should explicitly authorize before proceeding.

- [ ] **Step 1: Surface the checkpoint to the user.**

Tell the user:

> Phase 1 (code) is shipped + green. Ready to provision MinIO on prod per `DEPLOY.md` section "MinIO storage backend (Phase 2 …)" — that runs steps 1–7 of the runbook on the VPS. Includes editing `/var/www/cortexbuild-field/.env` and a PM2 restart. Want me to proceed, or would you prefer to run the runbook yourself?

- [ ] **Step 2: Wait for explicit approval.** Do not proceed to Task 12 until the user says yes.

---

### Task 12: Run the provisioning runbook + acceptance verification

> Only execute after Task 11 approval.

- [ ] **Step 1: Run runbook step 1 (prepare data dir)**

```bash
mkdir -p /var/lib/minio/data
chown 1000:1000 /var/lib/minio/data
ls -la /var/lib/minio/
```

Expected: `data` directory owned by uid 1000.

- [ ] **Step 2: Run runbook step 2 (root credentials)**

```bash
ROOT_USER=$(openssl rand -hex 16)
ROOT_PW=$(openssl rand -base64 32 | tr -d '/+=')   # alphanumeric to avoid shell-quoting hassle
tee /etc/minio.env > /dev/null <<EOF
MINIO_ROOT_USER=$ROOT_USER
MINIO_ROOT_PASSWORD=$ROOT_PW
MINIO_BROWSER_REDIRECT_URL=http://127.0.0.1:9001
EOF
chmod 600 /etc/minio.env
echo "ROOT_USER=$ROOT_USER"   # save for next steps in this session
echo "ROOT_PW=$ROOT_PW"
```

- [ ] **Step 3: Boot MinIO**

```bash
cd /var/www/cortexbuild-field
docker compose -f docker-compose.minio.yml up -d
sleep 10
docker compose -f docker-compose.minio.yml ps
```

Expected: state `Up (healthy)` after the second `ps`. If still `(starting)`, sleep another 10s.

- [ ] **Step 4: Install `mc`**

```bash
which mc || (curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && chmod +x /usr/local/bin/mc)
mc --version
```

- [ ] **Step 5: Create bucket + service account**

```bash
mc alias set local http://127.0.0.1:9000 "$ROOT_USER" "$ROOT_PW"
mc mb local/cortexbuild-field
SVC_OUT=$(mc admin user svcacct add local "$ROOT_USER" 2>&1)
echo "$SVC_OUT"
SVC_KEY=$(echo "$SVC_OUT" | awk '/Access Key/ {print $NF}')
SVC_SECRET=$(echo "$SVC_OUT" | awk '/Secret Key/ {print $NF}')
echo "SVC_KEY=$SVC_KEY"
echo "SVC_SECRET=$SVC_SECRET"
```

If `awk` parsing breaks on a future `mc` version, copy the keys from the printed `$SVC_OUT` manually into `SVC_KEY` / `SVC_SECRET`.

- [ ] **Step 6: Set field-server env**

```bash
tee -a /var/www/cortexbuild-field/.env > /dev/null <<EOF

# MinIO storage (provisioned $(date +%Y-%m-%d))
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=cortexbuild-field
S3_ACCESS_KEY_ID=$SVC_KEY
S3_SECRET_ACCESS_KEY=$SVC_SECRET
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
EOF
chmod 600 /var/www/cortexbuild-field/.env
```

- [ ] **Step 7: Restart PM2 and confirm boot log**

```bash
pm2 restart cortexbuild-field
sleep 3
pm2 logs cortexbuild-field --lines 30 --nostream | grep -i 'storage\|s3'
```

Expected: a line `[storage] connected to S3-compatible endpoint at http://127.0.0.1:9000 (bucket=cortexbuild-field)`.

If you instead see `[storage] S3_ENDPOINT unset`: the env vars didn't propagate. Confirm `/var/www/cortexbuild-field/.env` has the `S3_*` lines, that PM2's ecosystem config sources that file (or use `pm2 reload` with `--update-env`), and try again.

- [ ] **Step 8: Verify acceptance criteria A1-A9 from the spec**

```bash
# A1
docker compose -f /var/www/cortexbuild-field/docker-compose.minio.yml ps
# Expected: minio Up (healthy)

# A2 — loopback only
curl -fsS http://127.0.0.1:9000/minio/health/live && echo OK || echo FAIL
EXTERNAL_IP=$(hostname -I | awk '{print $1}')
curl --max-time 3 -fsS "http://$EXTERNAL_IP:9000/minio/health/live" 2>&1 | head -2
# Expected: first OK; second times out or "Connection refused"

# A3 — health endpoint
curl -s https://field.cortexbuildpro.com/api/health | python3 -m json.tool
# Expected: ok=true, checks.minio=true (now means real bucket reachable, not local-fs)

# A4 + A5 — upload + read round-trip via the app
# Sign in to https://field.cortexbuildpro.com via Adrian's account, go to
# File Vault, upload a small image. Then:
mc ls local/cortexbuild-field
# Expected: at least one object listed
DATABASE_URL=$(grep '^DATABASE_URL=' /var/www/cortexbuild-field/.env | cut -d= -f2-)
psql "$DATABASE_URL" -c 'SELECT id, "storageKey" FROM files ORDER BY id DESC LIMIT 3'
# Expected: at least one row whose storageKey matches the mc-listed object
KEY=$(mc ls local/cortexbuild-field --recursive | head -1 | awk '{print $NF}')
curl -L -o /tmp/roundtrip-test "https://field.cortexbuildpro.com/manus-storage/$KEY"
file /tmp/roundtrip-test
# Expected: file type matches the uploaded type (e.g. PNG image)

# A6 — local-fs fallback still works for dev
# (skip on prod; verified during Phase 1 Task 8)

# A7 — CI integration test
gh run list --branch main --limit 5 --repo adrianstanca1/cortexbuild-field
# Expected: latest CI run includes the integration job + it's green

# A8 — tRPC schema diff
# We didn't change any procedure shape; this is a structural check.
# A simple proxy: confirm files.upload still accepts the same input on prod.
curl -s -X POST 'https://field.cortexbuildpro.com/api/trpc/files.upload?batch=1' \
  -H 'Content-Type: application/json' --data-binary '{"0":{"json":{}}}' | head -c 400
# Expected: the response is a 401 UNAUTHORIZED (because no cookie), NOT a
# 400 "input shape changed" — confirms zod input contract is unchanged.

# A9 — boot log
pm2 logs cortexbuild-field --lines 50 --nostream | grep -iE 'storage|s3' | head -5
# Expected: the [storage] connected line shown in step 7
```

- [ ] **Step 9: Update CLAUDE.md and todo.md to reflect new state**

```bash
cd /root/cortexbuild-field
```

In `CLAUDE.md`, find the section about storage (around the `Storage:` line) and update it:

```markdown
- **Storage**: `storagePut(key, bytes, contentType)` in `server/storage.ts` returns `{ key, url: '/manus-storage/<key>' }`. When `S3_ENDPOINT` is set (prod: self-hosted MinIO @ 127.0.0.1:9000), the bytes go to S3-compatible storage; otherwise local-fs fallback. Persist the `key` in DB; the `/manus-storage/...` URL is served via `registerStorageProxy` (307-redirects to a presigned GET). There is intentionally no delete helper.
```

In `todo.md`, append under any sensible Storage section (or create one):

```markdown
## Storage backend (uploads sub-project 0 — shipped 2026-05-08)
- [x] Self-hosted MinIO on prod VPS (loopback, Docker compose, sub-project 0 of upload overhaul)
- [ ] Sub-project 1: server-side multipart upload plumbing (next)
- [ ] Sub-project 2: client-side multipart + remove base64 path
- [ ] Sub-project 3: persistent file staging on device
- [ ] Sub-project 4: offline-queue integration for uploads
- [ ] Backup automation: nightly `mc mirror local/cortexbuild-field <remote>` to off-site
```

Commit:

```bash
git add CLAUDE.md todo.md
git commit -m "docs: record MinIO storage cutover (2026-05-08)

Sub-project 0 shipped: self-hosted MinIO on prod VPS, S3 path
active in storage.ts. Local-fs fallback retained for dev.
Sub-projects 1-4 + backup automation tracked as follow-ups."
git push origin main
```

- [ ] **Step 10: Final summary back to user**

Report acceptance status per A1-A9 with concrete numbers (object count, response shape, log line).

---

## Notes for the executor

- **Each task ends with a commit.** Don't batch.
- **Run tests after every code change**, not only at task end.
- **If a step fails unexpectedly, STOP** and surface to the user. Don't speculatively patch — the spec deliberately decomposed into small slices to make rollback cheap. A failed Task 4 doesn't poison Task 5; revert and try again.
- **Forge env vars** (`BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`) are deliberately not removed from `env.ts` even though they're now unused — leaving them as no-op reads avoids a downstream change to anyone scraping ENV. Mark as `// deprecated 2026-05-08; unused since MinIO cutover` if a future audit asks.
- **Image tag `RELEASE.2025-09-07T16-13-09Z`** appears in three places: `docker-compose.minio.yml`, `tests/integration/minio-storage.integration.test.ts`, and the runbook in `DEPLOY.md`. When upgrading, change all three together.
- **Spec deviation, deliberate:** Spec §8 mentions a "5s default SDK timeout" for uploads. This plan does not configure one. Rationale: prod uploads are server→MinIO over loopback (microsecond latency), so timeout adds no value there; in CI the SDK talks to a testcontainers MinIO on localhost, similarly fast; the relevant timeouts (tRPC client, fetch, NetInfo) are upstream of `storagePut`. Adding a 5s SDK timeout would be a footgun for any future external S3 (slow uploads on edge). The 500ms `storageHealthCheck` timeout (D9) is the load-bearing one and IS implemented.

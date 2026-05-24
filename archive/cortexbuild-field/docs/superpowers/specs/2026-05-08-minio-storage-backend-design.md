# MinIO storage backend (uploads sub-project 0) — design

**Date:** 2026-05-08
**Status:** Approved (sub-project 0 of an upload-pipeline overhaul)
**Tracking:** Audit-followup to commit `a69c6e7` (polling-loop fix). The user asked to "fix and enhance upload capabilities + reliability"; brainstorming on 2026-05-08 decomposed that into 5 sub-projects (0..4). This spec covers only sub-project 0.

## Background

`server/storage.ts` exposes `storagePut(key, bytes, contentType)` as the single chokepoint for all server-side file writes. It has two modes:

1. **Forge S3** when `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` are set: presign-PUT via the Forge API, then a single PUT to the returned S3 URL.
2. **Local filesystem** fallback when those env vars are missing: writes to `process.cwd()/storage/<key>`.

Audit on 2026-05-08 found the prod VPS (`field.cortexbuildpro.com`, SHA `6d81dc9`) has **neither Forge env var set** and **no `storage/` directory** on disk. The `files` table is also empty. So:

- Today's prod is silently using the local-fs fallback path.
- No file has actually been uploaded yet (zero rows).
- The local-fs path is a single-disk, unreplicated, unbacked-up store — fine for dev, not acceptable for prod.

The wider upload overhaul (4 follow-up sub-projects: server multipart plumbing, client multipart, persistent file staging, offline queue integration) needs an S3-compatible backend underneath. **Sub-project 0 establishes that backend** — picking, provisioning, and wiring it into the existing `storagePut` contract — without changing any other behaviour.

## Problem statement

Two concrete problems and one structural one:

- **Problem A (capability):** No production-grade storage backend is configured. Any upload made today lands on the single VPS disk with no replication, no lifecycle, no off-site backup.
- **Problem B (reliability):** The current Forge fallback design depends on Manus Forge being reachable. The chosen direction (sub-projects 1-4) requires multipart upload, which Forge's documented API does not currently expose. We need a backend whose multipart support we control.
- **Problem C (structural):** The full upload overhaul is ~13-20 days of work. Designing it as one project risks late-discovered facts invalidating earlier slices. Per the user's direction on 2026-05-08, each sub-project gets its own design + plan + ship cycle. This spec is the first.

## 1. Goals

| | Goal | Verifiable? |
|---|---|---|
| G1 | Self-hosted, S3-compatible storage backend running on the VPS, addressable on loopback only. | `curl http://127.0.0.1:9000/minio/health/live` returns 200 from inside the VPS, fails from outside. |
| G2 | `storagePut` / `storageGetSignedUrl` keep the same TypeScript signature; only the inside changes. Existing `files.upload` procedure is byte-identical. | tRPC schema diff between pre- and post-deploy bundle = 0. |
| G3 | Local-fs fallback preserved for dev (`S3_ENDPOINT` unset). Unit tests + local Metro keep working with no infra. | `pnpm test` passes locally without MinIO running. |
| G4 | Public read URLs (`/manus-storage/<key>`) keep working — clients use the same URL contract. | After upload, GET `/manus-storage/<key>` returns the bytes (via 302 to a presigned MinIO GET). |
| G5 | Healthcheck reports MinIO bucket reachability alongside pg + redis. | `/api/health` JSON includes `"minio":true` when bucket is reachable. |
| G6 | CI exercises the real S3 path (not just stubs) before merge. | `.github/workflows/ci.yml` test job runs MinIO as a service container; one integration test uploads + reads back. |

Non-goals for this sub-project (in scope for later sub-projects):
- Multipart upload, chunked PUTs.
- Client-direct presigned PUT (clients still send base64 over tRPC; server is still the upload subject).
- Removing the base64 path on the client.
- File staging on the device, offline-queue integration.
- File deletion (intentionally absent per CLAUDE.md; revisit later).
- Backup automation (designed-to-enable, not implemented).

## 2. Decisions table

| # | Decision | Reason |
|---|---|---|
| D1 | **Backend**: MinIO self-hosted, single-node single-drive | Free, S3-compatible (sub-projects 1-4 plug in cleanly), full control, no vendor dependency. User-selected on 2026-05-08 over Cloudflare R2 / Backblaze B2 / AWS S3. |
| D2 | **Install method**: Docker compose | Reproducible, easy upgrades (`docker compose pull && up -d`), pinned version. User-selected on 2026-05-08 over binary+systemd. |
| D3 | **Networking**: loopback only (`127.0.0.1:9000` API, `127.0.0.1:9001` console) | No public exposure of S3 endpoint. Field-server is the only client. Public reads keep going through `registerStorageProxy`. |
| D4 | **Bucket**: single `cortexbuild-field` bucket; tenant scoping via key prefix (`<companyId>/<category>/<filename>`) | Keeps MinIO operationally simple; tenant isolation lives in the `files` table + procedure auth, not the bucket layer. Today's storage keys already use prefixes. |
| D5 | **SDK**: `@aws-sdk/client-s3` (lite) | Industry standard, well-maintained, 1:1 compatible with MinIO. Tree-shakeable so the server bundle doesn't bloat. |
| D6 | **Local-fs fallback retained** when `S3_ENDPOINT` unset | Devs without MinIO running locally still get a working `pnpm dev`. CI containers explicitly opt in via env. |
| D7 | **Region** value: `us-east-1` (a placeholder MinIO ignores) | The SDK requires a region string. MinIO doesn't care. Keep it boring; document why. |
| D8 | **Two distinct credential identities**, each in its own file: <br>(a) MinIO root creds in `/etc/minio.env` (chmod 600, root-only) — used only by the MinIO container at boot and by the operator for `mc admin`. <br>(b) A scoped service account ("field-app") in `/var/www/cortexbuild-field/.env` (chmod 600) — used by the field-server for day-to-day reads/writes. | Least privilege. The root creds never end up in the Node process; if the field-server is compromised the blast radius is bounded to the bucket the service account is scoped to. |
| D9 | **Healthcheck**: separate `headBucket` ping in `/api/health`, gated behind a 500ms timeout | Don't let a hung MinIO turn into a hung healthcheck. |
| D10 | **Backups**: out of scope for this sub-project, but the design must enable `mc mirror` to a remote target (B2 or Hostinger snapshot). MinIO's CLI supports this natively. | Backups are a follow-up ticket. The bucket layout makes it possible without rewriting anything. |

## 3. Architecture

### Process layout

```
[client]  ──base64-tRPC──>  [field-server :3005]  ──S3 PutObject──>  [MinIO :9000]
                                                                       │
                                                                       └─> /var/lib/minio/data/cortexbuild-field/<key>

[client]  <──302 to presigned GET──  [registerStorageProxy /manus-storage/*]  ──> MinIO presigned GET
```

PM2 keeps managing the field-server as today. Docker compose owns MinIO.

### Service-level layout

- **`docker compose service: minio`**:
  - Image: `minio/minio:RELEASE.2025-XX-XX` (pinned to a specific release tag at provision time)
  - Ports: `127.0.0.1:9000:9000` (S3 API), `127.0.0.1:9001:9001` (console). Note `127.0.0.1:` prefix — never bind 0.0.0.0.
  - Volume: `/var/lib/minio/data:/data`
  - Env: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BROWSER_REDIRECT_URL`
  - Healthcheck: `curl http://127.0.0.1:9000/minio/health/live` every 30s, 3 retries
  - Restart: `unless-stopped`

- **First-boot init (one-time, not automated in v0)**:
  1. `mc alias set local http://127.0.0.1:9000 <root> <pw>`
  2. `mc mb local/cortexbuild-field`
  3. `mc admin user svcacct add local <root>` to create a scoped service account; record its access/secret keys
  4. Set `S3_*` env vars in `/var/www/cortexbuild-field/.env`
  5. `pm2 restart cortexbuild-field`

- **`server/storage.ts`** (changed):
  - `getS3Client()`: lazy singleton, returns either an `S3Client` instance or `null` (for local-fs fallback). Cached per-process.
  - `storagePut(relKey, data, contentType)`:
    1. Sanitise key (existing `normalizeStorageKey` + `appendHashSuffix`).
    2. If S3 client null → existing local-fs fallback.
    3. Else → `PutObjectCommand({Bucket, Key, Body, ContentType})`. Catch errors and rethrow with a stable shape.
  - `storageGetSignedUrl(relKey)`:
    1. Sanitise key.
    2. If S3 client null → return `/manus-storage/<key>` (existing behaviour).
    3. Else → `getSignedUrl(GetObjectCommand)` with a 5-min TTL.
  - `storageGet(relKey)`: unchanged (just builds the URL).

- **`server/_core/index.ts` registerStorageProxy** (changed):
  - For each `/manus-storage/<key>` request, call `storageGetSignedUrl` and `res.redirect(302, signedUrl)`. Today's local-fs branch falls through to a static-file serve; new branch redirects.
  - Behaviour difference for clients: today, the response is the file body (200). Post-change, the response is a 302 → MinIO presigned GET → file body. Both work for `<img>`/`fetch` consumers. Mobile clients: `expo-image` handles 302 transparently.

### Boundary diagram (logical, not network)

```
┌─────────────────────────────────────────────┐
│ field-server (Node)                         │
│  - server/routers/files.ts upload procedure │
│  - server/storage.ts (changed)              │
│       └─> S3Client (or local-fs)            │
│  - server/_core/index.ts registerStorageProxy
│       └─> storageGetSignedUrl (changed)     │
└─────────────────────────────────────────────┘
              │ loopback HTTP
              ▼
┌─────────────────────────────────────────────┐
│ MinIO (Docker, single-node single-drive)    │
│  bucket: cortexbuild-field                  │
│  data:   /var/lib/minio/data                │
└─────────────────────────────────────────────┘
```

## 4. Data model

**No schema changes.**

The `files` table already stores `storageKey` and `mimeType`; both keep their meaning. Existing rows (zero today) would have local-fs keys; new rows after the cutover have keys that point into the MinIO bucket. There is no key-format change — just the resolver underneath.

## 5. Server contract

**No tRPC procedure changes.** `files.upload` keeps its current input/output shape exactly. The 14 MB base64 cap stays in zod (sub-project 1 will replace it with multipart, not this slice).

**New env vars (server only, never bundled to client):**

| Var | Purpose | Required? |
|---|---|---|
| `S3_ENDPOINT` | MinIO base URL, e.g. `http://127.0.0.1:9000` | Yes in prod; absence triggers local-fs fallback |
| `S3_BUCKET` | Bucket name. Single value, `cortexbuild-field`. | Yes when `S3_ENDPOINT` is set |
| `S3_ACCESS_KEY_ID` | Service-account access key | Yes when `S3_ENDPOINT` is set |
| `S3_SECRET_ACCESS_KEY` | Service-account secret key | Yes when `S3_ENDPOINT` is set |
| `S3_REGION` | SDK requires; MinIO ignores | Optional, defaults to `us-east-1` |
| `S3_FORCE_PATH_STYLE` | Required for MinIO (true) | Optional, defaults to `true` |

**`/api/health` response addition:**

```jsonc
{
  "ok": true,
  "checks": {
    "postgres": true,
    "redis": true,
    "minio": true   // ← new
  },
  // ...
}
```

`minio: false` does NOT flip top-level `ok` to false in this sub-project — uploads aren't a healthcheck-blocking dependency yet (uploads can fail in isolation). A follow-up may upgrade severity once uploads are load-bearing.

## 6. Client changes

**None in this sub-project.** The client continues to send base64 to `files.upload`; the URL contract for reads (`/manus-storage/<key>`) is unchanged. Sub-project 2 is the client refactor.

## 7. Operations

### Provisioning checklist (one-time, manual on the VPS)

1. **Disk prep**: `mkdir -p /var/lib/minio/data && chown 1000:1000 /var/lib/minio/data` (1000 = MinIO container user).
2. **Compose file**: drop `docker-compose.minio.yml` next to existing infra (alongside `nginx/` directory).
3. **Pin a release**: `image: minio/minio:RELEASE.<concrete-tag>`. Don't use `:latest`.
4. **Generate creds**: 32-char random for root user + password. Don't write them to docker-compose.yml — pull from `/etc/minio.env` (chmod 600).
5. **Boot**: `docker compose -f docker-compose.minio.yml up -d`. Wait for healthcheck.
6. **Bucket + service account**: run the four `mc` commands listed in section 3. Record service account creds.
7. **App env**: edit `/var/www/cortexbuild-field/.env` with the six `S3_*` vars; chmod 600.
8. **App restart**: `pm2 restart cortexbuild-field`.
9. **Smoke**: upload a 1 KB test file via `files.upload`; confirm row appears in `files`; confirm `mc ls local/cortexbuild-field` shows the object; confirm `curl https://field.cortexbuildpro.com/manus-storage/<key>` returns the bytes (after 302).
10. **Document**: append the install steps to `DEPLOY.md`.

### Backup hooks (out of scope to implement, in scope to enable)

- MinIO's `mc mirror local/cortexbuild-field <remote>` is the canonical backup primitive.
- Future ticket: nightly cron driving `mc mirror` to either Backblaze B2 (~$0.005/GB/mo + free 10 GB egress) or Hostinger snapshot.
- Bucket layout (`<companyId>/<category>/<filename>`) means tenant-scoped backups are possible if needed later.

### Capacity

- Current free disk: 323 GB. Sufficient for ~30,000 photos at 10 MB each, or several hundred site videos.
- No alerting in v0; PM2 logs `df -h` once a day via a cron line.

## 8. Error handling

| Failure mode | Behaviour | Tested? |
|---|---|---|
| MinIO unreachable (container stopped) | `storagePut` throws `S3 unavailable: <code>`; tRPC surface as `INTERNAL_SERVER_ERROR`. Client shows generic upload error. `/api/health` returns `minio: false`. | Yes — integration test stops MinIO container, asserts upload fails with a recognisable error. |
| Bucket missing | `headBucket` in healthcheck returns false → `minio: false`. `storagePut` throws on first PutObject. | Yes — unit test with stubbed S3 client. |
| Slow MinIO (network blip) | 5s default SDK timeout. Upload mutation fails; client retries through the existing tRPC retry path. | Partial — unit test with delayed promise. Not exercised in integration. |
| MinIO disk full | PutObject returns `Quota exceeded`-shaped error → tRPC `INTERNAL_SERVER_ERROR`. Operator sees PM2 log. | Out of scope to test (requires fault injection); documented runbook entry instead. |
| Service-account creds rotated/wrong | `Access denied` from PutObject → `INTERNAL_SERVER_ERROR`. Operator sees in PM2 log + healthcheck flips false. | Yes — unit test for 403 mapping. |
| Local-fs fallback hit unintentionally in prod (env vars missing) | Server boot logs a warning: `[storage] S3_ENDPOINT unset — falling back to local fs at <path>`. So a misconfigured prod is loud, not silent. | Yes — env-var detection unit test. |
| User uploads with mimetype not in zod allow list | Existing zod refusal — pre-MinIO behaviour preserved. | Yes — already covered. |

## 9. Testing strategy

### Unit (vitest)

- `tests/storage.test.ts` (update):
  - "uses S3Client when S3_ENDPOINT is set" — verifies `PutObjectCommand` invocation with correct bucket + key + content type
  - "falls back to local fs when S3_ENDPOINT is unset" — existing behaviour pin
  - "rethrows S3 errors with stable error shape" — covers Access denied, NoSuchBucket, etc.
  - "appends hash suffix even on S3 path" — preserves the dedupe/anti-collision contract
- `tests/storage-proxy.test.ts` (update):
  - "302-redirects to presigned GET when S3 client present"
  - "streams local file when S3 client absent"
- `tests/files-upload.test.ts` (no changes — already mocks `storagePut`)
- `tests/health.test.ts` (new or extend existing):
  - "minio:true when bucket headBucket succeeds"
  - "minio:false when bucket headBucket throws"

### Integration (CI service container)

Add a MinIO service container to `.github/workflows/ci.yml`:

```yaml
services:
  minio:
    image: minio/minio:RELEASE.<pinned>
    env:
      MINIO_ROOT_USER: testroot
      MINIO_ROOT_PASSWORD: testrootpw
    ports:
      - 9000:9000
    options: >-
      --health-cmd="curl -f http://localhost:9000/minio/health/live"
      --health-interval=10s
      --health-timeout=5s
      --health-retries=5
```

One new integration test (`tests/storage-minio-integration.test.ts`):

1. Boot — container is up before vitest starts.
2. Create bucket via `@aws-sdk/client-s3` (no `mc` in CI).
3. Upload a 1 KB buffer through `storagePut`.
4. Read it back via `storageGetSignedUrl` + fetch.
5. Compare bytes — must be byte-identical.
6. Tag the test with `@integration` so a future change can split it from unit tests if needed.

### Manual smoke

After deploy: section 7 step 9 (the provisioning smoke). Documented as a runbook entry, not automated.

## 10. Out of scope (sub-projects 1-4)

| | |
|---|---|
| Multipart upload (server + client) | Sub-project 1 (server) + 2 (client) |
| Client-direct presigned PUT | Sub-project 2 |
| Removing the base64 mutation | Sub-project 2 (after client migrates) |
| Persistent file staging on device | Sub-project 3 |
| Offline queue integration for uploads | Sub-project 4 |
| Backup automation (`mc mirror` cron) | Follow-up ticket post sub-project 0 |
| Lifecycle rules / object expiry | Follow-up |
| File deletion endpoint | Follow-up (intentionally absent today) |

## 11. Acceptance criteria (verifiable)

A1. `docker compose -f docker-compose.minio.yml ps` shows MinIO `Up (healthy)` on prod.
A2. `curl http://127.0.0.1:9000/minio/health/live` returns 200 from the VPS shell; the same call from any external IP fails (loopback bind).
A3. `curl -s https://field.cortexbuildpro.com/api/health | jq .checks.minio` returns `true`.
A4. Uploading a fresh PNG via `files.upload` (real prod cookie, real prod URL) creates one row in `files` AND one object visible in `mc ls local/cortexbuild-field`.
A5. `curl -L https://field.cortexbuildpro.com/manus-storage/<key>` (after upload) returns the original PNG bytes.
A6. `pnpm test` passes locally with no MinIO running (local-fs fallback path exercised).
A7. CI test workflow includes the MinIO service container; the integration test passes on a clean PR.
A8. tRPC schema diff between `main` pre-deploy and `main` post-deploy is empty (`@trpc/codegen` snapshot or equivalent).
A9. PM2 boot log on prod contains either `[storage] connected to MinIO at http://127.0.0.1:9000` (good path) or `[storage] S3_ENDPOINT unset — falling back to local fs` (sandbox path) — never silent.

## 12. Detailed sub-plan handoff

Implementation will be planned via the writing-plans skill after this design is approved. Expected plan shape (not binding):

1. Add `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` to `package.json` (lite, tree-shakeable).
2. `server/storage.ts` refactor: introduce `getS3Client()`, branch `storagePut` / `storageGetSignedUrl`, keep local-fs fallback.
3. `server/_core/env.ts`: add `S3_*` reads.
4. `server/_core/index.ts`: extend healthcheck with bucket ping.
5. `registerStorageProxy`: 302 path when S3 client present.
6. Tests (unit + integration) per section 9.
7. `.github/workflows/ci.yml`: add MinIO service container.
8. `docker-compose.minio.yml` + `DEPLOY.md` runbook entry.
9. Provision MinIO on prod VPS following section 7 checklist; record creds in `/var/www/cortexbuild-field/.env`.
10. Smoke per section 11; merge.

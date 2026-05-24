# Construction-platform consolidation — P0 + P1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `cortexbuild-field/docs/superpowers/specs/2026-05-10-buildtrack-consolidation-design.md`

**Goal:** Execute P0 (security: rotate exposed App Store Connect API key) and P1 (foundation: shed Manus OAuth/LLM, verify MinIO storage) so cortexbuild-field can run end-to-end with zero Manus dependencies on the server side.

**Architecture:** Inside `cortexbuild-field`, replace `_core/sdk.ts`'s Manus JWT verification with Supabase JWKS-based JWT verification; replace `_core/llm.ts`'s Manus Forge HTTP call with a TypeScript port of `cortexbuild-ultimate/server/lib/unified-ai-client-v2.js`; verify `server/storage.ts` (already MinIO-aware) is wired to the local MinIO at `127.0.0.1:9000`. Add a CI guard that fails on any new `manus` reference outside historical migrations.

**Tech stack:** Node 22, TypeScript 5.9, pnpm 9, Express + tRPC v11, Drizzle 0.45, postgres-js, Supabase (`@supabase/supabase-js` for JWKS), `jose` (already a dep), `@aws-sdk/client-s3` (already a dep), Vitest.

**Phase scope: P0 + P1 only.** P2 (schema absorption), P3 (client unification), P4 (native iOS + WhatsApp) are outlined at the bottom and will get their own `writing-plans` passes at phase boundaries — informed by what we learn here.

---

## Phase shape

| Phase | Status | Plan |
|---|---|---|
| **P0** Security: rotate p8, scrub history | THIS DOC | Below, §P0 |
| **P1** Shed Manus from cortexbuild-field server | THIS DOC | Below, §P1 |
| P2 Schema absorption (BuildTrack + ultimate domains) | Deferred | New plan at start of P2 |
| P3 Client unification (Expo+web, retire siblings) | Deferred | New plan at start of P3 |
| P4 Native iOS repointing + WhatsApp ingestion | Deferred | New plan at start of P4 |

---

## §P0 — Security: rotate cortexbuildpro App Store Connect API key

**Why this phase is independent and out-of-band:** the `.p8` private key and `credentials.json` are committed in `cortexbuildpro/`. They give anyone with repo read access full ASC API access for app `6768035036`. This must be rotated before any consolidation work.

**Pre-requisite — manual step Adrian must do (cannot be done from CLI):**
- Go to App Store Connect → Users and Access → Integrations → App Store Connect API → revoke key `LCB69UH9WU` and generate a new one. Note the new Key ID + Issuer ID. Download the new `.p8` file to `~/Downloads/AuthKey_<NEW_ID>.p8` (or wherever).

**The rest is automatable.** All steps run inside `/root/cortexbuildpro`.

### P0.T1 — Confirm the exposed files exist and capture key IDs

**Files:** read-only.

- [ ] **Step 1:** Confirm exposed files

```bash
cd /root/cortexbuildpro
ls -la AuthKey_*.p8 credentials.json 2>/dev/null
git log --oneline --all -- AuthKey_LCB69UH9WU.p8 credentials.json | head -5
```

Expected: both files exist; git log shows at least one commit touching each.

- [ ] **Step 2:** Capture the exposed key ID (for revocation tracking)

```bash
cd /root/cortexbuildpro
grep -E '"key_id"|"issuer_id"|"app_id"' credentials.json 2>/dev/null
```

Note the values for the audit log.

- [ ] **Step 3:** Verify revocation by Adrian

Do not proceed until Adrian confirms via ASC console that key `LCB69UH9WU` is revoked. Once revoked, the .p8 file is useless even if it leaks further — but we still scrub history because credentials in repos are bad hygiene regardless.

### P0.T2 — Add `.gitignore` to prevent re-commit

**Files:** modify `/root/cortexbuildpro/.gitignore`.

- [ ] **Step 1:** Read current .gitignore

```bash
cat /root/cortexbuildpro/.gitignore | head -30
```

- [ ] **Step 2:** Append secret-file patterns

Add to the bottom of `/root/cortexbuildpro/.gitignore`:

```gitignore

# App Store Connect API credentials — never commit
AuthKey_*.p8
credentials.json
.fastlane/credentials/
*.mobileprovision
*.cer
*.p12
```

- [ ] **Step 3:** Commit the gitignore change first (so the sweep doesn't accidentally re-add)

```bash
cd /root/cortexbuildpro
git add .gitignore
git commit -m "chore: ignore ASC API keys + signing materials"
```

### P0.T3 — Move the live files out of the repo, prove untracked

**Files:** delete from working tree, preserve to a secure location.

- [ ] **Step 1:** Move (don't delete) the files to `~/credentials-backup/` outside the repo

```bash
mkdir -p ~/credentials-backup
chmod 700 ~/credentials-backup
mv /root/cortexbuildpro/AuthKey_*.p8 ~/credentials-backup/
mv /root/cortexbuildpro/credentials.json ~/credentials-backup/
chmod 600 ~/credentials-backup/*
```

- [ ] **Step 2:** Stage the deletions and commit

```bash
cd /root/cortexbuildpro
git add -A
git status -s
git commit -m "chore(security): remove ASC API key + credentials from tree"
```

Expected: status shows the .p8 and credentials.json deleted; commit succeeds.

### P0.T4 — Scrub the files from git history with git-filter-repo

**Files:** rewrite history.

- [ ] **Step 1:** Verify git-filter-repo is available

```bash
which git-filter-repo || pip install --user git-filter-repo
```

If pip install runs, restart shell so `git-filter-repo` is on PATH.

- [ ] **Step 2:** Make a backup ref before the destructive operation

```bash
cd /root/cortexbuildpro
git tag pre-scrub-backup
git branch -a | head -5
```

- [ ] **Step 3:** Run the scrub

```bash
cd /root/cortexbuildpro
git filter-repo --invert-paths \
  --path AuthKey_LCB69UH9WU.p8 \
  --path credentials.json \
  --force
```

Expected: rewrites history; the two paths no longer appear in any commit.

- [ ] **Step 4:** Verify they're gone

```bash
cd /root/cortexbuildpro
git log --oneline --all -- AuthKey_LCB69UH9WU.p8 credentials.json
```

Expected: empty output.

- [ ] **Step 5:** Re-add the origin remote (filter-repo strips it for safety)

```bash
cd /root/cortexbuildpro
git remote -v
# If empty:
git remote add origin git@github.com:adrianstanca1/cortexbuildpro.git
git remote -v
```

### P0.T5 — Force-push and notify

**Files:** none — push only.

- [ ] **Step 1:** Force-push the rewritten history (DESTRUCTIVE — confirm with Adrian first)

```bash
cd /root/cortexbuildpro
git push origin --force --all
git push origin --force --tags
```

- [ ] **Step 2:** Open a GitHub issue or note documenting the rotation

```bash
cat <<'EOF' > /tmp/rotation-note.md
ASC API key LCB69UH9WU was committed to the cortexbuildpro repo.
Rotated: 2026-05-10. New key: <NEW_KEY_ID>.
History rewritten via git-filter-repo. Force-pushed origin/main.
Anyone with prior clones must re-clone or run `git fetch origin --all && git reset --hard origin/main`.
EOF
cat /tmp/rotation-note.md
```

- [ ] **Step 3:** Verify the GitHub-side history is scrubbed

```bash
cd /tmp
rm -rf cortexbuildpro-verify
git clone --depth 1 git@github.com:adrianstanca1/cortexbuildpro.git cortexbuildpro-verify
cd cortexbuildpro-verify
git log --all -- AuthKey_LCB69UH9WU.p8 credentials.json
```

Expected: empty.

**P0 exit criteria:**
- New ASC API key generated, old key revoked.
- Working tree contains no `.p8` or `credentials.json` (moved to `~/credentials-backup/`).
- Git history (origin) contains no `.p8` or `credentials.json`.
- `.gitignore` blocks future commits.

---

## §P1 — Shed Manus from cortexbuild-field server

**Why this phase, why now:** The whole consolidation hinges on cortexbuild-field being self-sufficient (no Manus OAuth, no Manus LLM, no Manus Forge storage). Once this is true, every later phase is straightforward porting.

**The three swaps are independent of each other and run in parallel as separate subagents.** A fourth integration task wires them together and adds the CI guard.

```
P1.A (oauth swap) ─┐
P1.B (llm swap)   ─┼─→ P1.D (integration + CI guard) ─→ P1 exit
P1.C (storage)    ─┘
```

### Working tree

All P1 work happens in `/root/cortexbuild-field` on a feature branch:

```bash
cd /root/cortexbuild-field
git checkout -b feat/p1-shed-manus
```

---

### P1.A — Replace Manus OAuth with Supabase JWT verification

**Goal:** `sdk.authenticateRequest()` accepts a Supabase JWT (RS256, signed by Supabase) and resolves to the Drizzle `User` row keyed by Supabase `sub` claim. The Manus token-exchange dance disappears entirely — the Expo / web client uses Supabase Auth client-side, then sends the resulting JWT as a Bearer header.

**Files:**
- Create: `cortexbuild-field/server/_core/supabase-auth.ts` (~120 lines)
- Modify: `cortexbuild-field/server/_core/sdk.ts:235-283` (replace `authenticateRequest` body)
- Modify: `cortexbuild-field/server/_core/oauth.ts` (delete `/api/oauth/callback`, `/api/oauth/mobile`; keep `/api/auth/me`, `/api/auth/logout`, `/api/auth/session`)
- Modify: `cortexbuild-field/server/_core/env.ts` (add `supabaseUrl`, `supabaseJwtSecret`, `supabaseAnonKey`; deprecate `oAuthServerUrl`, `appId`, `cookieSecret` *uses*)
- Modify: `cortexbuild-field/drizzle/schema.ts` `users` table — `openId` semantically becomes "Supabase user UUID" (no schema migration needed; just documentation comment)
- Test: `cortexbuild-field/tests/auth-supabase.test.ts` (new)

#### Tasks

- [x] **Step A1: Read the Supabase JWT format**

A Supabase user JWT (RS256, default) includes:
```json
{ "iss": "https://<project>.supabase.co/auth/v1", "sub": "<uuid>", "email": "user@example.com", "aud": "authenticated", "role": "authenticated", "exp": 1234567890 }
```

The JWKS endpoint is at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. We use `jose`'s `createRemoteJWKSet` for caching.

- [x] **Step A2: Write the failing test**

Create `cortexbuild-field/tests/auth-supabase.test.ts`:

```ts
import { describe, expect, it, beforeAll, vi } from "vitest";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import type { Request } from "express";

// We import lazily so the test can stub fetch for JWKS.
let verifySupabaseJwt: typeof import("../server/_core/supabase-auth").verifySupabaseJwt;

const SUPABASE_URL = "https://test.supabase.test";

describe("verifySupabaseJwt", () => {
  let privateKey: CryptoKey;
  let publicJwk: any;

  beforeAll(async () => {
    const kp = await generateKeyPair("RS256", { extractable: true });
    privateKey = kp.privateKey;
    publicJwk = await exportJWK(kp.publicKey);
    publicJwk.kid = "test-key";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    // Stub the JWKS fetch
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.endsWith("/.well-known/jwks.json")) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    process.env.SUPABASE_URL = SUPABASE_URL;
    ({ verifySupabaseJwt } = await import("../server/_core/supabase-auth"));
  });

  async function makeJwt(claims: Record<string, unknown>) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  it("accepts a valid token and returns the sub + email", async () => {
    const token = await makeJwt({ sub: "uuid-1", email: "ada@example.com", role: "authenticated" });
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const result = await verifySupabaseJwt(req);
    expect(result).toEqual({ sub: "uuid-1", email: "ada@example.com", role: "authenticated" });
  });

  it("rejects a token with wrong issuer", async () => {
    const token = await new SignJWT({ sub: "uuid-1" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://evil.example/auth/v1")
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    await expect(verifySupabaseJwt(req)).rejects.toThrow();
  });

  it("rejects when no Authorization header and no cookie", async () => {
    const req = { headers: {} } as unknown as Request;
    await expect(verifySupabaseJwt(req)).rejects.toThrow();
  });
});
```

- [x] **Step A3: Run the test, expect it to fail**

```bash
cd /root/cortexbuild-field
pnpm test -- tests/auth-supabase.test.ts
```

Expected: FAIL with "Cannot find module '../server/_core/supabase-auth'".

- [x] **Step A4: Create `supabase-auth.ts`**

Create `cortexbuild-field/server/_core/supabase-auth.ts`:

```ts
import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
if (!SUPABASE_URL) {
  console.warn("[auth] SUPABASE_URL is not set — Supabase JWT verification will fail at request time");
}

const ISSUER = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : "";
const JWKS_URL = SUPABASE_URL ? new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) : null;

const jwks = JWKS_URL ? createRemoteJWKSet(JWKS_URL, { cooldownDuration: 30_000 }) : null;

export type SupabaseClaims = {
  sub: string;
  email: string | null;
  role: string;
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const cookies = parseCookieHeader(req.headers.cookie || "");
  return cookies[COOKIE_NAME] ?? null;
}

export async function verifySupabaseJwt(req: Request): Promise<SupabaseClaims> {
  if (!jwks) throw ForbiddenError("Supabase auth not configured");
  const token = extractToken(req);
  if (!token) throw ForbiddenError("No bearer token or session cookie");

  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: "authenticated",
    algorithms: ["RS256"],
  });

  const sub = payload.sub;
  if (typeof sub !== "string" || !sub) throw ForbiddenError("JWT missing sub claim");

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : null,
    role: typeof payload.role === "string" ? payload.role : "authenticated",
  };
}
```

- [x] **Step A5: Run the test, expect it to pass**

```bash
cd /root/cortexbuild-field
pnpm test -- tests/auth-supabase.test.ts
```

Expected: 3 tests pass.

- [x] **Step A6: Update `_core/env.ts`**

Read `cortexbuild-field/server/_core/env.ts`. Add `supabaseUrl`, `supabaseJwksUrl` to the `ENV` export (next to existing entries). The Manus-specific keys (`oAuthServerUrl`, `appId`) are kept for now (deletion is part of P1.D's CI-guard step).

- [x] **Step A7: Modify `_core/sdk.ts`'s `authenticateRequest` (the keystone change)**

In `cortexbuild-field/server/_core/sdk.ts`, replace the body of `authenticateRequest` (currently lines 235–283) with a Supabase-claims-based flow:

```ts
async authenticateRequest(req: Request): Promise<User> {
    const claims = await verifySupabaseJwt(req);
    const signedInAt = new Date();

    // We continue to use users.openId as the stable identity column —
    // its semantics shift from "Manus openId" to "Supabase sub UUID".
    let user = await db.getUserByOpenId(claims.sub);

    if (!user) {
      await db.upsertUser({
        openId: claims.sub,
        name: null,
        email: claims.email,
        loginMethod: "supabase",
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(claims.sub);
    }

    if (!user) throw ForbiddenError("User upsert failed");

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
```

Also add the import at the top of `sdk.ts`:

```ts
import { verifySupabaseJwt } from "./supabase-auth";
```

- [x] **Step A8: Delete the Manus token-exchange routes from `_core/oauth.ts`**

In `cortexbuild-field/server/_core/oauth.ts`, delete the `/api/oauth/callback` and `/api/oauth/mobile` route registrations (lines 129-188). Keep `/api/auth/logout`, `/api/auth/me`, `/api/auth/session` — they continue to work because `authenticateRequest` now uses Supabase. Also delete the `syncUser` helper (no longer called).

After the edit, `registerOAuthRoutes` should only register the three remaining routes.

- [x] **Step A9: Run the existing tenant-isolation + auth tests**

```bash
cd /root/cortexbuild-field
pnpm test -- tests/tenant-isolation.test.ts
pnpm test -- tests/auth-supabase.test.ts
```

Expected: both pass.

- [x] **Step A10: Commit P1.A** — `5ec81d7`, pushed to origin

```bash
cd /root/cortexbuild-field
git add server/_core/supabase-auth.ts server/_core/sdk.ts server/_core/oauth.ts server/_core/env.ts tests/auth-supabase.test.ts
git commit -m "feat(auth): replace Manus OAuth with Supabase JWT verification

authenticateRequest now verifies RS256 JWTs against Supabase JWKS;
users.openId stores Supabase sub UUIDs going forward (no schema change,
just semantic). /api/oauth/callback and /api/oauth/mobile removed —
clients use Supabase Auth directly and pass the JWT as bearer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### P1.B — Replace Manus LLM with ported `unified-ai-client-v2`

**Goal:** `invokeLLM(params: InvokeParams): Promise<InvokeResult>` (the existing public signature) routes through a TypeScript port of cortexbuild-ultimate's `unified-ai-client-v2.js`. Provider order: Ollama (local) → Gemini → OpenRouter → fallback.

**Files:**
- Create: `cortexbuild-field/server/_core/unified-ai/index.ts` (~250 lines, the orchestrator)
- Create: `cortexbuild-field/server/_core/unified-ai/providers/ollama.ts` (~60 lines)
- Create: `cortexbuild-field/server/_core/unified-ai/providers/gemini.ts` (~60 lines)
- Create: `cortexbuild-field/server/_core/unified-ai/providers/openrouter.ts` (~60 lines)
- Create: `cortexbuild-field/server/_core/unified-ai/circuit-breaker.ts` (~60 lines)
- Modify: `cortexbuild-field/server/_core/llm.ts` — replace `invokeLLM`'s body to delegate to the orchestrator. **Keep the existing `InvokeParams`/`InvokeResult` types unchanged** so callers don't need to be touched.
- Modify: `cortexbuild-field/server/_core/env.ts` — add `ollamaBaseUrl`, `geminiApiKey`, `openrouterApiKey`.
- Test: `cortexbuild-field/tests/unified-ai.test.ts`

#### Tasks

- [ ] **Step B1: Read the source we're porting**

```bash
sed -n '1,50p;500,540p' /root/cortexbuild-ultimate/server/lib/unified-ai-client-v2.js | head -120
```

Note: cortexbuild-ultimate's client is JavaScript; we're TS-porting selectively. We preserve: the provider-routing decision tree, the per-provider circuit breaker, the JSON request shapes. We drop: the LRU cache (premature for our use), the streaming variants (we'll add later if needed), and the agent orchestrator (out of P1 scope).

- [ ] **Step B2: Write circuit breaker + test it**

Create `cortexbuild-field/server/_core/unified-ai/circuit-breaker.ts`:

```ts
type State = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private state: State = "closed";
  private failureCount = 0;
  private nextAttemptAt = 0;

  constructor(
    public readonly name: string,
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  canAttempt(now = Date.now()): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open" && now >= this.nextAttemptAt) {
      this.state = "half_open";
      return true;
    }
    return this.state === "half_open";
  }

  onSuccess(): void {
    this.state = "closed";
    this.failureCount = 0;
  }

  onFailure(now = Date.now()): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = "open";
      this.nextAttemptAt = now + this.cooldownMs;
    }
  }

  status() {
    return { name: this.name, state: this.state, failureCount: this.failureCount };
  }
}
```

- [ ] **Step B3: Test the circuit breaker**

Create the relevant section of `cortexbuild-field/tests/unified-ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../server/_core/unified-ai/circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after threshold failures", () => {
    const cb = new CircuitBreaker("test", 3, 1000);
    expect(cb.canAttempt(0)).toBe(true);
    cb.onFailure(0); cb.onFailure(0); cb.onFailure(0);
    expect(cb.canAttempt(500)).toBe(false);
    expect(cb.canAttempt(1500)).toBe(true); // half-open after cooldown
  });

  it("recovers on success", () => {
    const cb = new CircuitBreaker("test", 2, 1000);
    cb.onFailure(0); cb.onFailure(0);
    expect(cb.canAttempt(0)).toBe(false);
    expect(cb.canAttempt(2000)).toBe(true);
    cb.onSuccess();
    cb.onFailure(2000);
    expect(cb.canAttempt(2000)).toBe(true);
  });
});
```

Run: `pnpm test -- tests/unified-ai.test.ts`

Expected: 2 tests pass.

- [ ] **Step B4: Write the Ollama provider**

Create `cortexbuild-field/server/_core/unified-ai/providers/ollama.ts`:

```ts
import type { InvokeParams, InvokeResult, Message } from "../../llm";

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:latest";
const DEFAULT_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

function toOllamaMessages(messages: Message[]) {
  return messages.map(m => ({
    role: m.role === "tool" ? "user" : m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
}

export async function ollamaInvoke(params: InvokeParams): Promise<InvokeResult> {
  const url = `${DEFAULT_BASE.replace(/\/$/, "")}/api/chat`;
  const body = {
    model: DEFAULT_MODEL,
    messages: toOllamaMessages(params.messages),
    stream: false,
    options: { num_predict: params.max_tokens ?? params.maxTokens ?? 2048 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ollama: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  const now = Date.now();
  return {
    id: `ollama-${now}`,
    created: Math.floor(now / 1000),
    model: data.model ?? DEFAULT_MODEL,
    choices: [{
      index: 0,
      message: { role: "assistant", content: data.message?.content ?? "" },
      finish_reason: data.done ? "stop" : "length",
    }],
  };
}
```

- [ ] **Step B5: Write Gemini and OpenRouter providers**

Create `cortexbuild-field/server/_core/unified-ai/providers/gemini.ts` and `openrouter.ts` following the same shape — request to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=…` and `https://openrouter.ai/api/v1/chat/completions` respectively. The OpenRouter API is OpenAI-compatible so the JSON shape is essentially the same as Gemini-flash's chat completions; for Gemini's `generateContent`, see the existing JS source at `/root/cortexbuild-ultimate/server/lib/unified-ai-client-v2.js` (read it directly — that's the reference implementation we're porting).

Both providers must:
- Read API keys from `process.env.GEMINI_API_KEY` / `process.env.OPENROUTER_API_KEY`.
- Throw with a clear error if the key is missing.
- Return an `InvokeResult` with the same shape as the Ollama provider above.

- [ ] **Step B6: Write the orchestrator**

Create `cortexbuild-field/server/_core/unified-ai/index.ts`:

```ts
import type { InvokeParams, InvokeResult } from "../llm";
import { CircuitBreaker } from "./circuit-breaker";
import { ollamaInvoke } from "./providers/ollama";
import { geminiInvoke } from "./providers/gemini";
import { openrouterInvoke } from "./providers/openrouter";

const ollamaBreaker = new CircuitBreaker("ollama");
const geminiBreaker = new CircuitBreaker("gemini");
const openrouterBreaker = new CircuitBreaker("openrouter");

export async function unifiedInvoke(params: InvokeParams): Promise<InvokeResult> {
  const errors: string[] = [];

  // Ordered fallback: Ollama → Gemini → OpenRouter
  const providers = [
    { name: "ollama", fn: ollamaInvoke, cb: ollamaBreaker, available: true },
    { name: "gemini", fn: geminiInvoke, cb: geminiBreaker, available: !!process.env.GEMINI_API_KEY },
    { name: "openrouter", fn: openrouterInvoke, cb: openrouterBreaker, available: !!process.env.OPENROUTER_API_KEY },
  ];

  for (const p of providers) {
    if (!p.available) continue;
    if (!p.cb.canAttempt()) { errors.push(`${p.name}: circuit open`); continue; }
    try {
      const result = await p.fn(params);
      p.cb.onSuccess();
      return result;
    } catch (e) {
      p.cb.onFailure();
      errors.push(`${p.name}: ${(e as Error).message}`);
    }
  }
  throw new Error(`unified-ai: all providers failed: ${errors.join(" | ")}`);
}

export function unifiedAiHealth() {
  return [ollamaBreaker, geminiBreaker, openrouterBreaker].map(cb => cb.status());
}
```

- [ ] **Step B7: Modify `_core/llm.ts` to delegate**

Replace the body of `invokeLLM` in `cortexbuild-field/server/_core/llm.ts` (lines 301-362). Keep all type exports unchanged. New body:

```ts
import { unifiedInvoke } from "./unified-ai";

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  try {
    return await unifiedInvoke(params);
  } catch (e) {
    console.error("[llm] all providers failed:", e);
    return fallbackResult(params);
  }
}
```

Keep `fallbackResult` and all the helper functions (`normalizeMessage`, `normalizeToolChoice`, etc.) — they may be reused later when we wire tool-calling through the providers.

- [ ] **Step B8: Write an integration test (skipped in CI without keys)**

Add to `cortexbuild-field/tests/unified-ai.test.ts`:

```ts
import { invokeLLM } from "../server/_core/llm";

describe.skipIf(!process.env.OLLAMA_BASE_URL && !process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY)(
  "invokeLLM (integration)",
  () => {
    it("returns text from at least one provider", async () => {
      const r = await invokeLLM({
        messages: [{ role: "user", content: "Reply with the single word 'pong'." }],
        max_tokens: 10,
      });
      expect(r.choices[0].message.content).toBeTruthy();
    });
  }
);
```

- [ ] **Step B9: Run the unit tests**

```bash
cd /root/cortexbuild-field
pnpm test -- tests/unified-ai.test.ts
pnpm check
```

Expected: tests pass; tsc clean.

- [ ] **Step B10: Commit P1.B**

```bash
cd /root/cortexbuild-field
git add server/_core/unified-ai/ server/_core/llm.ts server/_core/env.ts tests/unified-ai.test.ts
git commit -m "feat(llm): port unified-ai-client (Ollama→Gemini→OpenRouter)

invokeLLM keeps its public types but delegates to a new orchestrator with
per-provider circuit breakers (5 failures → 30s cooldown). Removes the
direct dependency on https://forge.manus.im. Falls back to the existing
fallbackResult on total failure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### P1.C — Verify MinIO storage wiring

**Goal:** Confirm `cortexbuild-field/server/storage.ts` (already MinIO-aware) talks to the local MinIO instance running on `127.0.0.1:9000`. Set env vars; smoke-test upload/download/presign; remove any Manus-Forge URL rewriting if present.

**Files:**
- Modify: `cortexbuild-field/.env` (local dev config, not committed) — add `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
- Modify: `cortexbuild-field/.env.example` — document the new keys.
- Test: `cortexbuild-field/tests/storage-minio.test.ts` (new, integration-tagged)

#### Tasks

- [ ] **Step C1: Get MinIO credentials and bucket**

```bash
docker exec cortexbuild-minio mc ls local/ 2>/dev/null || \
  docker exec cortexbuild-minio mc alias list 2>/dev/null
```

Expected: a list of buckets, or alias info we can use. If a `cortexbuild-field` bucket doesn't exist, create one:

```bash
docker exec cortexbuild-minio mc mb local/cortexbuild-field 2>&1 || true
docker exec cortexbuild-minio mc ls local/cortexbuild-field
```

Capture the access key + secret key (likely in MinIO container env or `~/.mc/config.json`):

```bash
docker exec cortexbuild-minio printenv | grep -iE 'minio_root_user|access_key|secret_key' | head -5
```

- [ ] **Step C2: Set env vars in `cortexbuild-field/.env`**

Add (or update) these lines in `/root/cortexbuild-field/.env`:

```dotenv
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=cortexbuild-field
S3_ACCESS_KEY=<from-step-C1>
S3_SECRET_KEY=<from-step-C1>
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

- [ ] **Step C3: Update `.env.example`**

Add to `/root/cortexbuild-field/.env.example` (commit this) the same keys with placeholder values + a comment:

```dotenv
# MinIO / S3-compatible storage. Replaces Manus Forge.
# Local dev: http://127.0.0.1:9000 with the cortexbuild-minio container.
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

- [ ] **Step C4: Verify `getS3Client()` returns a working client**

Quick verification script (run, don't commit):

```bash
cd /root/cortexbuild-field
node --import tsx -e 'import("./server/storage.js").then(m => console.log("client:", m.getS3Client() ? "OK" : "null"))'
```

Expected: `client: OK`.

- [ ] **Step C5: Write storage integration test**

Create `cortexbuild-field/tests/storage-minio.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { storagePut, storageGet, getS3Client } from "../server/storage";

describe.skipIf(!process.env.S3_ENDPOINT)("MinIO integration", () => {
  beforeAll(() => {
    if (!getS3Client()) throw new Error("S3 client not configured");
  });

  it("can put and get a small object", async () => {
    const key = `test/p1/${Date.now()}-roundtrip.txt`;
    const bytes = Buffer.from("hello minio");
    const putResult = await storagePut(key, bytes, "text/plain");
    expect(putResult.key).toBe(key);

    const getResult = await storageGet(key);
    const text = getResult ? Buffer.from(await getResult.arrayBuffer()).toString("utf8") : null;
    expect(text).toBe("hello minio");
  });
});
```

(If `storageGet` doesn't already exist on `storage.ts`, add it as part of this task — it's a thin wrapper over `GetObjectCommand`. Read `storage.ts` first to confirm its public surface.)

- [ ] **Step C6: Run the test**

```bash
cd /root/cortexbuild-field
pnpm test -- tests/storage-minio.test.ts
```

Expected: pass.

- [ ] **Step C7: Search for any leftover Manus-Forge URL prefixing**

```bash
cd /root/cortexbuild-field
grep -rn "manus-storage\|forge\.manus\.im\|FORGE_API" server/ shared/ lib/ 2>/dev/null
```

If matches, either delete them (if they're forge-specific) or rename `manus-storage` to `storage` in URL paths. Update any referenced clients accordingly.

- [ ] **Step C8: Commit P1.C**

```bash
cd /root/cortexbuild-field
git add .env.example tests/storage-minio.test.ts server/storage.ts
git commit -m "feat(storage): wire to local MinIO; remove Forge references

storage.ts was already MinIO-capable via @aws-sdk/client-s3. This wires
it to the local MinIO container (127.0.0.1:9000) and removes any
remaining 'manus-storage' / forge.manus.im strings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### P1.D — Integration + CI guard

**Goal:** Run the existing test suite end-to-end with the three swaps merged. Add a CI guard that fails on any new `manus` reference outside historical migrations. Update `.env.example` and `CLAUDE.md`.

**Files:**
- Create: `cortexbuild-field/tests/no-manus-references.test.ts`
- Modify: `cortexbuild-field/CLAUDE.md` (auth/llm/storage sections)
- Modify: `cortexbuild-field/.env.example` (drop Manus keys, add Supabase keys)
- Modify: `cortexbuild-field/server/_core/env.ts` (delete `oAuthServerUrl`, `appId`, `cookieSecret` if no other consumer)

#### Tasks

- [ ] **Step D1: Write the no-manus-references CI guard**

Create `cortexbuild-field/tests/no-manus-references.test.ts`. Note: uses `execFileSync` (not `execSync`) so no shell is invoked — arguments are passed as an array. The `git grep` command exits non-zero when no matches are found, so we wrap in try/catch and treat the non-zero-no-output case as "no offenders":

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

// Allow-list: directories where historical Manus references can survive.
// drizzle/ holds applied migrations (immutable history); the test file itself.
const ALLOWED_PATH_PREFIXES = [
  "drizzle/",
  "tests/no-manus-references.test.ts",
];

function gitGrep(args: string[]): string {
  try {
    return execFileSync("git", ["grep", ...args], { encoding: "utf8" });
  } catch (e: any) {
    // Exit code 1 means "no matches"; that's success here.
    if (e.status === 1) return "";
    throw e;
  }
}

describe("no Manus references in active source", () => {
  it("server/, shared/, lib/, app/ contain no 'manus' or 'forge.manus' strings", () => {
    const result = gitGrep([
      "-nIi",
      "-e", "manus",
      "-e", "forge\\.manus",
      "--",
      "server", "shared", "lib", "app",
    ]);
    const lines = result
      .split("\n")
      .filter(Boolean)
      .filter(line => !ALLOWED_PATH_PREFIXES.some(prefix => line.startsWith(prefix)));
    expect(lines, `unexpected manus references:\n${lines.join("\n")}`).toEqual([]);
  });

  it("the bundle ID 'space.manus.cortexbuild.field.t20260425152033' is the only allowed manus reference in app.config.ts", () => {
    const grep = gitGrep(["-ni", "manus", "--", "app.config.ts"]);
    const lines = grep.split("\n").filter(Boolean);
    const offenders = lines.filter(l => !l.includes("space.manus.cortexbuild.field"));
    expect(offenders, `unexpected manus refs in app.config.ts:\n${offenders.join("\n")}`).toEqual([]);
  });
});
```

- [ ] **Step D2: Run the guard**

```bash
cd /root/cortexbuild-field
pnpm test -- tests/no-manus-references.test.ts
```

If this fails, the failures are the cleanup list. Fix each one (remove imports, delete dead helpers, etc.) and re-run. The test passes when all references are gone except the locked bundle ID.

- [ ] **Step D3: Update `.env.example`**

Edit `cortexbuild-field/.env.example`:
- DELETE: `OAUTH_SERVER_URL`, `APP_ID`, `COOKIE_SECRET` lines.
- ADD: `SUPABASE_URL`, `OLLAMA_BASE_URL`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` lines (commented with brief docs).

- [ ] **Step D4: Update `CLAUDE.md`**

In `cortexbuild-field/CLAUDE.md`, update the "Auth flow" section to describe Supabase JWT verification (not Manus token exchange). Update "LLM" / "Storage" bullets to reference the new providers. Note that the bundle ID `space.manus.cortexbuild.field.t20260425152033` is intentionally retained as an immutable artefact.

- [ ] **Step D5: Run the full server test suite**

```bash
cd /root/cortexbuild-field
pnpm check
pnpm test
```

Expected: all green. If `tests/migration-journal-completeness.test.ts` or `tests/tenant-isolation.test.ts` fail, those need attention before commit — they enforce the discipline we want to keep.

- [ ] **Step D6: Smoke test end-to-end (manual)**

With cortexbuild-field running locally:

```bash
cd /root/cortexbuild-field
pnpm dev:server &
sleep 3

# Simulate a request with a Supabase JWT (you can grab one from your Supabase project's anon login)
curl -s -H "Authorization: Bearer <SUPABASE_JWT>" http://localhost:3000/api/auth/me | jq .
```

Expected: returns `{user: {…}}` with the Supabase user resolved. If returns 401, verify SUPABASE_URL is reachable and the JWT is valid.

- [ ] **Step D7: Commit P1.D and merge the feature branch**

```bash
cd /root/cortexbuild-field
git add tests/no-manus-references.test.ts .env.example CLAUDE.md server/_core/env.ts
git commit -m "feat(p1): integrate Manus shed + add no-manus-references guard

CI guard greps server/shared/lib/app for 'manus' / 'forge.manus' strings
and fails on any match outside the locked bundle ID + drizzle migration
history. Closes P1 of the consolidation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

# Push for CI before merging to main.
git push -u origin feat/p1-shed-manus
```

**P1 exit criteria:**
- `pnpm test` is green (including `migration-journal-completeness`, `tenant-isolation`, `no-manus-references`, `auth-supabase`, `unified-ai`, `storage-minio`).
- `pnpm check` is green.
- `git grep -i manus -- server shared lib app | grep -v "space.manus.cortexbuild.field"` is empty.
- Hitting `/api/auth/me` with a valid Supabase JWT returns the user.
- Hitting any tRPC procedure that previously called `invokeLLM` works without a Manus key configured (assuming Ollama is reachable, or providers gracefully fall back to `fallbackResult`).
- Cortexbuild-field runs end-to-end with zero outbound calls to `forge.manus.im` or any Manus host.

---

## Outline: P2 / P3 / P4 (own plans at phase boundary)

### P2 — Schema absorption (~2 weeks, separate plan)

Drizzle migrations adding tables from sister apps. Tenant-scoped procedures + tests. Exit when union schema is in place and all CI guards green.

Tasks (high-level):
- Migrations for: drawing pins, submittals, change orders, purchase orders, equipment, materials, site photos, delay notes (port from BuildTrack/buildtrack-api).
- Migrations for: pgvector extension, `bim_models` table, `rag_embeddings` table (port from cortexbuild-ultimate).
- New tRPC routers under `server/routers/` for each domain, all using `companyScopedProcedure`.
- Update push event registry (`shared/notification-events.ts`) for new event types.
- Update `tests/migration-journal-completeness.test.ts` baseline.

### P3 — Client unification (~2 weeks, separate plan)

Mobile + web client absorption.

Tasks (high-level):
- Port BuildTrack mobile screens for the new domains into `cortexbuild-field/app/`.
- Port `buildtrack-web/`'s PWA manifest, service worker, IndexedDB offline queue into the cortexbuild-field web export.
- Port `cortexbuild-ultimate/`'s BIM 4D viewer routes (three.js + web-ifc), RAG UI, agentic chat — only the surfaces not already in cortexbuild-field.
- Switch cortexbuild-field's Expo client from Manus OAuth flow to Supabase Auth (`@supabase/supabase-js` + `expo-auth-session`).
- Retire `BuildTrack`, `buildtrack-web`, `cortexbuildpro`, `cortexbuild-ultimate` repos: archive default branches, kill PM2 processes, remove nginx vhosts, write redirect README.

### P4 — Native iOS + WhatsApp ingestion + cleanup (~1.5 weeks, separate plan)

Tasks (high-level):
- BuildTrack-iOS: swap its current Supabase/REST mix for unified-backend REST adapter; add the REST adapter generator on the server side.
- New endpoint `/api/ingest/whatsapp` in cortexbuild-field; reconfigure cortexbuild-web to post into it.
- Cleanup: archive retired repos, write the migration runbook, finalise CLAUDE.md.

---

## Plan self-review

**Spec coverage check:**
- D1 cortexbuild-field as base ✓ (P1)
- D2 Supabase Auth replaces Manus ✓ (P1.A)
- D2a unified-ai-client port ✓ (P1.B)
- D2b MinIO replaces Forge ✓ (P1.C — found to be already-wired, simplifies the work)
- D3 BuildTrack-iOS retained ✓ (P4)
- D4 4 phase-PRs ✓ (this is one PR per phase, current plan covers P0+P1)
- D5 pilot-only state ✓ (assumed throughout)
- D6 cortexbuild-web standalone ✓ (P4)
- R1 Manus deep-link risk → spike during P1.A integration (manual smoke test in D6)
- R2 cortexbuildpro p8 ✓ (P0)
- R3 cortexbuild-ultimate doc/code drift → noted in P1.B Step B1 (read source, not docs)

**Placeholder scan:** No "TBD"/"TODO"/"implement appropriate" found. Step B5 references the engineer reading the existing JS source — that's a directive to read a specific 639-line file (path given), not a placeholder.

**Type consistency:** `InvokeParams`/`InvokeResult` types kept identical between current `llm.ts` and the orchestrator port. `User` type from Drizzle schema unchanged. `SupabaseClaims` is new; only used internally.

**Scope check:** P0 is independent of P1; P1's three sub-tasks (A/B/C) are independent of each other and merge in P1.D. Each is a self-contained, testable unit.

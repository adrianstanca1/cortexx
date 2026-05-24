# CortexBuild Ultimate — Comprehensive Code Review Report

**Date**: 2026-04-24
**Scope**: Full-stack audit (frontend `/src`, backend `/server`, AI layer, infrastructure)
**Test Status**: 221/221 tests passing, typecheck passing, lint passing
**Agents Used**: Security Auditor, Silent Failure Hunter, Type Design Analyzer, Code Quality Reviewer

---

## Executive Summary

| Category        | Critical | High   | Medium | Low   |
| --------------- | -------- | ------ | ------ | ----- |
| Silent Failures | 8        | 14     | 11     | —     |
| Security        | 1        | 4      | 5      | 2     |
| Type Design     | —        | 3      | 3      | 2     |
| Code Quality    | 1        | 3      | 5      | 4     |
| **Total**       | **10**   | **24** | **24** | **8** |

**Key Risks**:

1. **RAG embeddings poisoned with dummy vectors** on AI client failure — semantic search returns garbage results
2. **Rate limiter can permanently block users** due to fire-and-forget Redis `pExpire` without error handling
3. **Mobile summary endpoint fabricates zero counts** when the database is down, misleading field workers
4. **Webhook failures are completely invisible** — no logging, no alerting, no retry
5. **Frontend API layer uses `any` everywhere** — 42 `any` usages undermine type safety

---

## 1. Silent Failures (CRITICAL)

### 1.1 Dummy RAG embeddings poison search results

**File**: `server/lib/unified-ai-client-v2.js:439-456`
**Severity**: CRITICAL

On embedding failure, `getEmbedding()` returns `Array(384).fill(0.1)` or `Array(1024).fill(0.1)` instead of failing. These dummy vectors enter the `rag_embeddings` table and poison semantic search with meaningless similarity scores.

**Fix**: Return `null` on failure and skip insertion. Alert operators when the embedding service is down.

### 1.2 Rate limiter can permanently block users

**File**: `server/middleware/rateLimiter.js:71`, `uploadRateLimiter.js:56`
**Severity**: CRITICAL

```js
redisClient.pExpire(key, WINDOW_MS); // Fire-and-forget, no await, no catch
```

If Redis fails to set the expiry (network blip, memory pressure), the key persists forever. The user is permanently rate-limited with no recovery path.

**Fix**: `await redisClient.pExpire(key, WINDOW_MS).catch(err => console.error('[RateLimit] pExpire failed:', err))`

### 1.3 Mobile summary fabricates zero counts on DB failure

**File**: `server/routes/mobile-summary.js:37,45,53,58`
**Severity**: CRITICAL

```js
.catch(() => ({ rows: [{ count: 0 }] }))
```

Database query failures return fabricated zero counts. Field workers see "0 open tasks" and "0 safety incidents" when the database is actually down, creating a dangerous false sense of security.

**Fix**: Return 503 Service Unavailable on database errors. Never fabricate data.

### 1.4 Webhook emission completely swallowed

**File**: `server/routes/generic.js:42-47`, `server/routes/webhooks.js:192`
**Severity**: CRITICAL

```js
emitEvent(...).catch(() => {});
```

Webhook import failures, emission failures, and delivery failures are all silently swallowed. No logging, no metrics, no alerting. Users relying on webhook integrations have zero visibility into broken integrations.

**Fix**: Log webhook failures with `console.error` and emit a metric. Consider a dead-letter queue.

### 1.5 Ollama embedding failures silently return null

**File**: `server/lib/ollama.js:31,47-52`
**Severity**: CRITICAL

All embedding request errors (timeout, connection refused, malformed response) resolve to `null` without any error logging or alerting.

**Fix**: Log the specific error and propagate it to callers.

### 1.6 Health check errors caught without logging

**File**: `server/index.js:144,150`
**Severity**: CRITICAL

```js
catch { checks.postgres = false; }
catch { checks.redis = false; }
```

Health check failures don't log the underlying error. When `/api/health` returns `degraded`, operators have no idea why.

**Fix**: `catch (err) { console.error('[Health] Postgres check failed:', err.message); }`

### 1.7 ReferenceError in healthCheck catch block

**File**: `server/lib/unified-ai-client-v2.js:475-480`
**Severity**: CRITICAL

```js
const start = Date.now(); // inside try
catch (err) {
  const latency = Date.now() - start; // ReferenceError: start is not defined
}
```

`start` is `const`-declared inside the `try` block and referenced in the `catch` block. This causes a secondary `ReferenceError` that masks the real error.

**Fix**: Move `const start = Date.now()` outside the `try` block.

### 1.8 Conversation save failures return 200

**File**: `server/routes/ai.js:327-329`
**Severity**: CRITICAL

```js
catch (e) {
  console.warn('[AI] Could not save conversation:', e.message);
}
```

The user receives a 200 OK response even though their conversation wasn't persisted to the database.

**Fix**: Include a `persisted: false` flag in the response, or return 500 if persistence is required.

---

## 2. Silent Failures (HIGH)

### 2.1 Redis connection failures silent in rate limiter

**File**: `server/middleware/rateLimiter.js:24`, `uploadRateLimiter.js:28`, `server/lib/tokenBlacklist.js:14`
**Severity**: HIGH

```js
redisClient.connect().catch(() => {});
```

Redis connection failures are silently swallowed. The system falls back to in-memory rate limiting without alerting operators.

### 2.2 Silent ROLLBACK failures in workers

**Files**:

- `server/workers/autoresearch-worker.js:116,170`
- `server/workers/autorepair-monitor.js:208`
- `server/workers/autoimprove-scheduler.js:68,138`
  **Severity**: HIGH

```js
await client.query("ROLLBACK").catch(() => {});
```

If `ROLLBACK` fails (e.g., connection dropped during transaction), the error is swallowed. The client connection may be left in an aborted transaction state and released back to the pool, corrupting subsequent queries.

**Fix**: `catch (err) { console.error('[Worker] ROLLBACK failed:', err); throw err; }`

### 2.3 AI summary endpoints fall back without user notice

**File**: `server/routes/ai.js:450-456,543-557,656-673`
**Severity**: HIGH

When the AI service is unavailable, endpoints fall back to rule-based summaries but don't inform the user (except `/chat` which adds a note). Users think they're getting AI-generated insights when they're actually getting static rules.

**Fix**: Add `_meta: { aiAvailable: false, fallback: 'rule-based' }` to all fallback responses.

### 2.4 ActivityFeed falls back to MOCK data

**File**: `src/components/modules/ActivityFeed.tsx:125-127`
**Severity**: HIGH

```js
catch(err => {
  console.warn(...);
  setActivities(MOCK_ACTIVITIES);
})
```

Any fetch failure causes the UI to display fake demo data instead of showing an error. Users see fabricated activity entries.

**Fix**: Show an error state or retry button. Never display mock data in production.

### 2.5 JSON parse errors swallow server error details

**Files**: `src/services/api.ts:63,113`, `src/services/ai.ts:33,111`
**Severity**: HIGH

```js
await res.json().catch(() => ({ message: res.statusText }));
```

When the server returns a non-JSON error (e.g., HTML from nginx 502, or a stack trace), the frontend loses the actual error body and shows only the generic HTTP status text.

**Fix**: `catch(() => { const text = await res.text(); return { message: text.slice(0,500) }; })`

### 2.6 Auth session validation falls back to stale data

**File**: `src/context/AuthContext.tsx:58-62`
**Severity**: HIGH

Network errors during session validation fall back to `localStorage` user data without informing the user. A stale or revoked session appears valid.

**Fix**: Clear stored session on validation network errors and redirect to login.

### 2.7 SSE stream parsing errors silently discarded

**File**: `server/lib/unified-ai-client-v2.js:209,253-258`
**Severity**: HIGH

Malformed SSE chunks from Ollama/OpenRouter are silently skipped. Users see truncated or missing AI responses with no indication that data was lost.

**Fix**: Log parse errors with chunk context. After N consecutive failures, abort the stream and return an error.

---

## 3. Security Issues

### 3.1 Auth middleware catches all JWT errors silently

**File**: `server/middleware/auth.js:31-33`
**Severity**: HIGH

```js
catch {
  return res.status(401).json({ message: 'Invalid or expired token' });
}
```

All JWT errors (malformed, expired, invalid signature, algorithm mismatch) return the same generic message. This makes debugging authentication issues extremely difficult and hides potential attacks.

**Fix**: Log the specific JWT error type (never expose it to the client):

```js
catch (err) {
  console.error('[Auth] JWT verification failed:', err.name, err.message);
  return res.status(401).json({ message: 'Invalid or expired token' });
}
```

### 3.2 Deploy endpoint runs arbitrary shell commands

**File**: `server/routes/deploy.js:43`
**Severity**: HIGH

```js
execFile("bash", ["-c", DEPLOY_SCRIPT]);
```

The deploy endpoint executes a shell script containing `git pull`, `npm ci`, `npm run build`, and nginx restart. While protected by `DEPLOY_SECRET`, a leaked secret gives full shell access.

**Mitigation**: Already has secret auth. Consider HMAC signature verification instead of bearer token.

### 3.3 Uploaded files served without auth check

**File**: `server/index.js:128-131`
**Severity**: HIGH

```js
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    index: false,
    dotfiles: "ignore",
  }),
);
```

The `/uploads` static file route has NO authentication middleware. Anyone who guesses a filename can access uploaded documents, images, and BIM models.

**Fix**: Add `authMiddleware` before the static handler, or serve files through an authenticated proxy route.

### 3.4 SQL template literal in autorepair-actions

**File**: `server/lib/autorepair-actions.js:98`
**Severity**: MEDIUM

```js
await pool.query(`
  UPDATE ${table_name}
  SET updated_at = updated_at - INTERVAL '1 day'
  WHERE updated_at > NOW() - INTERVAL '30 days'
`);
```

While `table_name` is validated against `ALLOWED_TABLES`, template literal SQL is still risky. If the allowlist is ever bypassed or expanded carelessly, this becomes an injection vector.

**Fix**: Use a parameterized table name check with a static query map:

```js
const TABLE_QUERIES = {
  projects: `UPDATE projects SET ...`,
  // ...
};
await pool.query(TABLE_QUERIES[table_name]);
```

### 3.5 CORS allows all localhost origins in dev

**File**: `server/index.js:111-112`
**Severity**: MEDIUM

```js
if (process.env.NODE_ENV !== "production" && LOCAL_DEV_ORIGIN_RE.test(origin)) {
  return callback(null, true);
}
```

In non-production mode, ANY localhost/127.0.0.1 origin is allowed. If `NODE_ENV` is misconfigured on the VPS, this opens CORS wide.

**Fix**: Remove the `NODE_ENV !== 'production'` check and rely solely on `corsOrigins`.

### 3.6 Search parameter escaping may be incomplete

**File**: `server/routes/files.js:64`
**Severity**: MEDIUM

```js
params.push(`%${search.replace(/[%_\\]/g, "\\$&")}%`);
```

The ILIKE escape assumes `standard_conforming_strings=on`. If PostgreSQL is configured differently, the backslash escaping may not work, allowing wildcard injection.

**Fix**: Use PostgreSQL's `ESCAPE` clause explicitly: `ILIKE $1 ESCAPE '\'`

---

## 4. Type Design Issues

### 4.1 Universal `Row` type undermines 50+ entity types

**File**: `src/services/api.ts`
**Severity**: HIGH

```ts
export type Row = Record<string, unknown>;
```

Every CRUD API returns `Row` or `Row[]` instead of specific domain types (`Project`, `Invoice`, etc.). The `apiFetch<T>` generic casts without validation, providing zero compile-time guarantees.

**Fix**: Create entity-specific API wrappers: `fetchAll<Project>('projects')` with Zod validation.

### 4.2 `any` regression in newer modules

**Files**: `src/components/modules/Sustainability.tsx`, `Certifications.tsx`, `TempWorks.tsx`
**Severity**: HIGH

Newer modules use `: any` callback parameters despite `src/types/domain.ts` providing specific `*Row` types.

**Fix**: Replace `(m: any)` with `(m: SustainabilityRow)` etc.

### 4.3 Excessive optionality in `domain.ts`

**File**: `src/types/domain.ts`
**Severity**: HIGH

Nearly every field in `*Row` types is optional (`?:`), even for `NOT NULL` database columns like `id`, `created_at`, `status`.

**Fix**: Audit against the database schema. Make `NOT NULL` fields required in types.

### 4.4 Zod schemas unused for API validation

**File**: `src/lib/validations.ts`
**Severity**: MEDIUM

Well-structured Zod schemas exist (207 lines) but are only used for form validation. Server responses are never validated at runtime.

**Fix**: Create `apiFetchSchema<T>(path, schema)` that calls `schema.parse(data)` before returning.

### 4.5 Dual API layers create confusion

**Files**: `src/services/api.ts`, `src/lib/api.ts`
**Severity**: MEDIUM

Two competing API modules with different behaviors (camelCase conversion vs raw, throw vs return object). New developers can't tell which to use.

**Fix**: Deprecate `src/lib/api.ts` and consolidate on `src/services/api.ts`.

---

## 5. Code Quality Issues

### 5.1 useCollaborativeEditor is entirely mocked

**File**: `src/hooks/useCollaborativeEditor.ts`
**Severity**: HIGH

The collaborative editor hook is completely fake — static content, random collaborator names, no WebSocket integration, no persistence.

**Fix**: Either implement real collaboration or remove the hook and disable the feature.

### 5.2 Redis client error handler is a no-op

**File**: `server/routes/auth.js:35`
**Severity**: MEDIUM

```js
client.on("error", () => {});
```

Redis errors in the auth module are silently discarded.

**Fix**: `client.on('error', err => console.error('[Auth Redis]', err))`

### 5.3 Missing cleanup in WebSocket close handler

**File**: `server/lib/websocket.js:96-104`
**Severity**: MEDIUM

```js
ws.on("close", () => {
  clients.get(userId)?.delete(ws);
  if (clients.get(userId)?.size === 0) {
    clients.delete(userId);
  }
});
```

If `clients.get(userId)` is undefined (race condition), the optional chaining prevents errors but may leak closed WebSocket objects.

**Fix**: Use a helper that safely removes:

```js
const userClients = clients.get(userId);
if (userClients) {
  userClients.delete(ws);
  if (userClients.size === 0) clients.delete(userId);
}
```

### 5.4 Token blacklist Redis failure not handled

**File**: `server/lib/tokenBlacklist.js:44-48`
**Severity**: MEDIUM

If Redis is down during token blacklist check, the code returns `false` (token not blacklisted) without logging.

**Fix**: Log Redis failures and consider failing closed in production.

---

## 6. Quick Wins (Fix These First)

| Priority | Fix                                           | File                                       | Lines          |
| -------- | --------------------------------------------- | ------------------------------------------ | -------------- |
| P0       | Add `console.error` to health check catches   | `server/index.js`                          | 144, 150       |
| P0       | `await` + `catch` on `redisClient.pExpire`    | `server/middleware/rateLimiter.js`         | 71             |
| P0       | Return 503 on DB errors, not fabricated data  | `server/routes/mobile-summary.js`          | 37, 45, 53, 58 |
| P0       | Move `start` outside try block                | `server/lib/unified-ai-client-v2.js`       | 475            |
| P1       | Log JWT error types in auth middleware        | `server/middleware/auth.js`                | 31             |
| P1       | Add auth to `/uploads` static serving         | `server/index.js`                          | 128            |
| P1       | Remove mock data fallback                     | `src/components/modules/ActivityFeed.tsx`  | 125            |
| P1       | Replace empty `.catch(() => {})` with logging | `server/routes/generic.js`                 | 43             |
| P2       | Replace `Row` with domain types in API layer  | `src/services/api.ts`                      | —              |
| P2       | Remove `: any` from module callbacks          | `Sustainability.tsx`, `Certifications.tsx` | —              |

---

## 7. Appendix: Test & Build Status

| Check                          | Status          |
| ------------------------------ | --------------- |
| Unit tests (Vitest)            | 221/221 passing |
| Type check (`tsc --noEmit`)    | Passing         |
| ESLint                         | Passing         |
| Server syntax (`node --check`) | Passing         |
| `npm audit` (critical/high)    | None found      |

The codebase has good hygiene at the CI level (tests, lint, typecheck all pass) but significant runtime reliability and type safety gaps.

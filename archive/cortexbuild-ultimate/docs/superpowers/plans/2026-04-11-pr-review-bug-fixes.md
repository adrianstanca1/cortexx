# PR Review Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical and important bugs identified in the PR review: OAuth token leakage, fake bulk actions, UUID display names, silent error swallowing, and unlogged catch blocks.

**Architecture:** Seven targeted fixes across three files. No new files needed except the OAuth exchange endpoint (added inline to `oauth.js`). Fixes are ordered by severity — security first, then correctness, then observability.

**Tech Stack:** Node.js/Express (backend), React 19/TypeScript (frontend), Redis (one-time OAuth code store)

---

## File Map

| File                                                | Change                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `server/routes/oauth.js`                            | Replace JWT-in-URL redirect with one-time code; add `GET /oauth/exchange` endpoint                  |
| `src/components/auth/OAuthCallback.tsx`             | Exchange code for token via API; fix UUID fallback; add catch error binding                         |
| `server/routes/auth.js`                             | Add `console.error` to 9 silent catch blocks                                                        |
| `server/routes/company.js`                          | Accept `is_active` in `PUT /company/users/:id`                                                      |
| `src/services/api.ts`                               | Add `usersApi.setActive()`                                                                          |
| `src/components/admin-dashboard/users/UsersTab.tsx` | Implement bulk activate/deactivate API calls; add error feedback to `loadUsers` and companies fetch |

---

### Task 1: Fix OAuth token leakage — replace JWT-in-URL with one-time code

**Files:**

- Modify: `server/routes/oauth.js` (Google callback ~line 265, Microsoft callback ~line 347)

The two OAuth callbacks currently redirect `?oauth_token=<7-day-JWT>` exposing the JWT in Nginx logs, browser history, and Referer headers. Replace with a 60-second one-time opaque code stored in Redis.

- [ ] **Step 1: Add `setOAuthCode` / `getAndDeleteOAuthCode` helpers in `oauth.js`**

Add after the existing `deleteOAuthState` function (after line ~31):

```javascript
// One-time OAuth code exchange — replaces JWT-in-URL pattern
// Code is valid for 60 seconds and deleted on first use
async function setOAuthCode(code, token) {
  await redisClient.setEx(`oauth:code:${code}`, 60, token);
}

async function getAndDeleteOAuthCode(code) {
  const token = await redisClient.get(`oauth:code:${code}`);
  if (token) await redisClient.del(`oauth:code:${code}`);
  return token;
}
```

- [ ] **Step 2: Replace JWT-in-URL redirect in Google callback (~line 263-265)**

Replace:

```javascript
// Redirect to callback page with token in URL — frontend stores it in localStorage
const redirectUri = storedState.redirectUri;
res.redirect(`${redirectUri}?oauth_token=${token}`);
```

With:

```javascript
// Use one-time code to avoid JWT appearing in URL, logs, or Referer headers
const code = crypto.randomBytes(16).toString("hex");
await setOAuthCode(code, token);
const redirectUri = storedState.redirectUri;
res.redirect(`${redirectUri}?code=${code}`);
```

- [ ] **Step 3: Replace JWT-in-URL redirect in Microsoft callback (~line 344-347)**

Replace:

```javascript
// Redirect to callback page with token in URL — frontend stores it in localStorage
const redirectUri = storedState.redirectUri;
res.redirect(`${redirectUri}?oauth_token=${token}`);
```

With:

```javascript
// Use one-time code to avoid JWT appearing in URL, logs, or Referer headers
const code = crypto.randomBytes(16).toString("hex");
await setOAuthCode(code, token);
const redirectUri = storedState.redirectUri;
res.redirect(`${redirectUri}?code=${code}`);
```

- [ ] **Step 4: Add `GET /oauth/exchange` endpoint at end of `oauth.js` (before `module.exports`)**

```javascript
// GET /api/oauth/exchange?code=xxx
// Exchanges a one-time code (60s TTL) for a JWT. Code is deleted on first use.
// This avoids placing the JWT in a redirect URL where it leaks into logs and history.
router.get("/exchange", async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code parameter" });
  }
  try {
    const token = await getAndDeleteOAuthCode(code);
    if (!token) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    // Decode user info from token (already verified by jwt.sign above — no re-verify needed here
    // since it was stored by us seconds ago, but verify anyway for defence in depth)
    const payload = require("jsonwebtoken").verify(
      token,
      process.env.JWT_SECRET,
    );
    const { rows } = await db.query(
      "SELECT id,name,email,role,phone,avatar,organization_id,company_id,created_at FROM users WHERE id = $1",
      [payload.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ token, user: rows[0] });
  } catch (err) {
    console.error("[OAuth exchange]", err);
    res.status(500).json({ error: "Exchange failed" });
  }
});
```

- [ ] **Step 5: Commit**

```bash
cd /root/cortexbuild-work
git add server/routes/oauth.js
git commit -m "fix: replace JWT-in-URL OAuth redirect with one-time code exchange"
```

---

### Task 2: Fix OAuthCallback — exchange code for token, fix UUID fallback, add catch binding

**Files:**

- Modify: `src/components/auth/OAuthCallback.tsx`

Three bugs in one file:

1. Callback now receives `?code=xxx` not `?oauth_token=jwt` — must exchange via API
2. `payload.company_id` (UUID) was falling back as the display company name
3. `catch` block had no error binding — security-relevant decode failures silently dropped

- [ ] **Step 1: Rewrite the `oauthToken` branch to handle both `code` param (new) and keep `oauth_token` (fallback for dev)**

Replace the entire `useEffect` body in `OAuthCallback.tsx` with:

```typescript
useEffect(() => {
  const errorParam = searchParams.get("error");
  const stateParam = searchParams.get("state");
  const code = searchParams.get("code");
  const oauthToken = searchParams.get("oauth_token"); // legacy fallback (dev only)

  // ── New: exchange one-time code for JWT ───────────────────────────────────
  if (code) {
    apiFetch<{ token: string; user: Record<string, unknown> }>(
      `/oauth/exchange?code=${encodeURIComponent(code)}`,
    )
      .then(({ token, user }) => {
        setToken(token);
        setStoredUser({
          id: String(user.id ?? ""),
          name: String(user.name || user.email),
          email: String(user.email ?? ""),
          role: (user.role as string) || "field_worker",
          company: "", // never use company_id UUID as display name — resolve via /companies
          phone: null,
          avatar: null,
          organization_id: (user.organization_id as string | null) ?? null,
          company_id: (user.company_id as string | null) ?? null,
          effectiveOrganizationId: (user.organization_id ??
            user.company_id ??
            null) as string | null,
        });
        setStatus("success");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      })
      .catch((err: unknown) => {
        console.error("[OAuthCallback] code exchange failed:", err);
        setStatus("error");
        setError("Failed to complete sign-in. Please try again.");
      });
    return;
  }

  // ── Legacy: direct JWT in URL (dev / backward compat) ─────────────────────
  if (oauthToken) {
    try {
      const payload = JSON.parse(
        atob(oauthToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      const user = {
        id: payload.id,
        name: payload.name || payload.email,
        email: payload.email,
        role: payload.role || "field_worker",
        company: "", // company_id is a UUID, not a display name
        phone: null,
        avatar: null,
        organization_id: payload.organization_id ?? null,
        company_id: payload.company_id ?? null,
        effectiveOrganizationId:
          payload.organization_id ?? payload.company_id ?? null,
      };
      setToken(oauthToken);
      setStoredUser(user);
      setStatus("success");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (err) {
      console.error("[OAuthCallback] failed to decode JWT payload:", err);
      setStatus("error");
      setError("Failed to process authentication. Please try again.");
    }
    return;
  }

  // ── CSRF state validation ─────────────────────────────────────────────────
  if (stateParam) {
    const storedState = sessionStorage.getItem("oauth_state");
    if (!storedState || storedState !== stateParam) {
      setStatus("error");
      setError("Invalid OAuth state. Please try again.");
      console.error("[OAuth] State mismatch - possible CSRF attack");
      return;
    }
    sessionStorage.removeItem("oauth_state");
  }

  // ── OAuth provider returned an error ───────────────────────────────────────
  if (errorParam) {
    setStatus("error");
    switch (errorParam) {
      case "invalid_state":
        setError("OAuth state expired. Please try again.");
        break;
      case "google_auth_failed":
      case "microsoft_auth_failed":
        setError("Authentication failed. Please try again.");
        break;
      case "google_not_configured":
      case "microsoft_not_configured":
        setError("OAuth provider is not configured on this server.");
        break;
      case "state_expired":
        setError("OAuth session expired. Please try again.");
        break;
      default:
        setError("OAuth authentication failed. Please try again.");
    }
    return;
  }

  // ── No token and no error ─────────────────────────────────────────────────
  setStatus("error");
  setError("Invalid authentication response.");
}, [searchParams, navigate]);
```

- [ ] **Step 2: Add `apiFetch` import at top of `OAuthCallback.tsx`**

The current imports are:

```typescript
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { setToken, setStoredUser } from "../../lib/auth-storage";
```

Add `apiFetch` import:

```typescript
import { apiFetch } from "../../services/api";
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/OAuthCallback.tsx
git commit -m "fix: exchange OAuth code for JWT via API; remove UUID company fallback; log decode errors"
```

---

### Task 3: Fix 9 silent catch blocks in `auth.js`

**Files:**

- Modify: `server/routes/auth.js` (lines 147, 160, 181, 194, 207, 222, 267, 286, 300, 322)

Nine routes return 500 without logging `err`. A single DB error produces an untraceable response.

- [ ] **Step 1: Fix `GET /me` catch (line ~147)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/profile
```

With:

```javascript
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/profile
```

- [ ] **Step 2: Fix `PUT /profile` catch (line ~160)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/password
```

With:

```javascript
  } catch (err) {
    console.error('[auth/profile]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/password
```

- [ ] **Step 3: Fix `PUT /password` catch (line ~181)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/preferences
```

With:

```javascript
  } catch (err) {
    console.error('[auth/password]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/preferences
```

- [ ] **Step 4: Fix `GET /preferences` catch (line ~194)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/preferences
```

With:

```javascript
  } catch (err) {
    console.error('[auth/preferences GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/preferences
```

- [ ] **Step 5: Fix `PUT /preferences` catch (line ~207)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/users
```

With:

```javascript
  } catch (err) {
    console.error('[auth/preferences PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/users
```

- [ ] **Step 6: Fix `GET /users` catch (line ~222)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/users
```

With:

```javascript
  } catch (err) {
    console.error('[auth/users GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/users
```

- [ ] **Step 7: Fix `DELETE /users/:id` catch (line ~267)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/avatar
```

With:

```javascript
  } catch (err) {
    console.error('[auth/users DELETE]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/avatar
```

- [ ] **Step 8: Fix `PUT /avatar` catch (line ~286)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/settings
```

With:

```javascript
  } catch (err) {
    console.error('[auth/avatar]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/settings
```

- [ ] **Step 9: Fix `GET /settings` catch (line ~300)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

const VALID_SETTING_KEYS
```

With:

```javascript
  } catch (err) {
    console.error('[auth/settings GET]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const VALID_SETTING_KEYS
```

- [ ] **Step 10: Fix `PUT /settings` catch (line ~322)**

Replace:

```javascript
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/logout
```

With:

```javascript
  } catch (err) {
    console.error('[auth/settings PUT]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/logout
```

- [ ] **Step 11: Commit**

```bash
git add server/routes/auth.js
git commit -m "fix: add console.error logging to all silent catch blocks in auth routes"
```

---

### Task 4: Fix fake bulk activate/deactivate — add backend support and wire up API calls

**Files:**

- Modify: `server/routes/company.js` — accept `is_active` in `PUT /users/:id`
- Modify: `src/services/api.ts` — add `usersApi.setActive()`
- Modify: `src/components/admin-dashboard/users/UsersTab.tsx` — implement bulk actions

- [ ] **Step 1: Update `PUT /company/users/:id` to accept `is_active` field**

In `server/routes/company.js`, replace:

```javascript
const { role, phone } = req.body;
```

With:

```javascript
const { role, phone, is_active } = req.body;
```

Then replace the query (around line 285):

```javascript
const { rows } = await pool.query(
  `UPDATE users SET
        role = COALESCE($1, role),
        phone = COALESCE($2, phone)
       WHERE id = $3 AND company_id = $4
       RETURNING id, email, name, role, phone`,
  [role, phone, req.params.id, req.user.company_id],
);
```

With:

```javascript
const { rows } = await pool.query(
  `UPDATE users SET
        role = COALESCE($1, role),
        phone = COALESCE($2, phone),
        is_active = COALESCE($3, is_active)
       WHERE id = $4 AND company_id = $5
       RETURNING id, email, name, role, phone, is_active`,
  [
    role || null,
    phone || null,
    is_active !== undefined ? is_active : null,
    req.params.id,
    req.user.company_id,
  ],
);
```

Also update the audit log to include `is_active`:

```javascript
logAudit({
  auth: req.user,
  action: "update",
  entityType: "users",
  entityId: req.params.id,
  newData: { role, is_active },
});
```

- [ ] **Step 2: Add `usersApi.setActive()` to `src/services/api.ts`**

Find the `usersApi` object (line ~381) and add the method:

```typescript
export const usersApi = {
  getAll: () => apiFetch<Row[]>("/company/users"),
  create: (data: Row) =>
    apiFetch<Row>("/company/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Row) =>
    apiFetch<Row>(`/company/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiFetch<void>(`/company/users/${id}`, { method: "DELETE" }),
  setActive: (id: string, isActive: boolean) =>
    apiFetch<Row>(`/company/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    }),
};
```

- [ ] **Step 3: Implement bulk activate/deactivate in `UsersTab.tsx`**

Replace the fake activate/deactivate branches in `handleBulkAction` (lines ~167-173):

```typescript
    } else if (action === 'activate') {
      toast.success(`Activated ${ids.length} users`);
      clearSelection();
    } else if (action === 'deactivate') {
      toast.success(`Deactivated ${ids.length} users`);
      clearSelection();
    }
```

With:

```typescript
    } else if (action === 'activate' || action === 'deactivate') {
      const isActive = action === 'activate';
      try {
        await Promise.all(ids.map(id => usersApi.setActive(id, isActive)));
        toast.success(`${isActive ? 'Activated' : 'Deactivated'} ${ids.length} user${ids.length !== 1 ? 's' : ''}`);
        onRefresh?.(); loadUsers();
        clearSelection();
      } catch {
        toast.error(`Failed to ${action} users`);
      }
    }
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/company.js src/services/api.ts src/components/admin-dashboard/users/UsersTab.tsx
git commit -m "fix: implement bulk activate/deactivate with real API calls; add is_active to company users endpoint"
```

---

### Task 5: Fix error feedback in UsersTab — `loadUsers` failure and silent companies fetch

**Files:**

- Modify: `src/components/admin-dashboard/users/UsersTab.tsx`

- [ ] **Step 1: Fix `loadUsers` error handler — change warn to error + show toast**

Replace (line ~66):

```typescript
      .catch(e => console.warn('[UsersTab] failed to load:', e))
```

With:

```typescript
      .catch((e: unknown) => {
        console.error('[UsersTab] failed to load users:', e);
        toast.error('Failed to load users. Please refresh the page.');
      })
```

- [ ] **Step 2: Fix silent companies fetch — add console.warn with context**

Replace (line ~64):

```typescript
          .catch(() => {/* non-critical */});
```

With:

```typescript
          .catch((e: unknown) => {
            console.warn('[UsersTab] failed to load company names — company column will show IDs:', e);
          });
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin-dashboard/users/UsersTab.tsx
git commit -m "fix: add error feedback to loadUsers failure; log company name fetch errors"
```

---

### Task 6: Register `/oauth/exchange` route in `server/index.js`

The new exchange endpoint lives in `oauth.js` which is already mounted. Verify the mount path so the frontend can call it at `/api/oauth/exchange`.

- [ ] **Step 1: Check oauth route mount in `server/index.js`**

```bash
grep -n oauth /root/cortexbuild-work/server/index.js
```

Expected output should include something like:

```
app.use('/api/oauth', require('./routes/oauth'));
```

If the route is mounted at `/api/oauth`, then `GET /api/oauth/exchange` is already reachable. No change needed.

If it's mounted elsewhere, adjust the `apiFetch` call in `OAuthCallback.tsx` accordingly.

- [ ] **Step 2: Confirm exchange endpoint works**

```bash
cd /root/cortexbuild-work/server && node -e "
const r = require('./routes/oauth');
console.log('oauth router loaded OK');
"
```

Expected: `oauth router loaded OK`

- [ ] **Step 3: Final build verification**

```bash
cd /root/cortexbuild-work && npm run build 2>&1 | tail -20
```

Expected: `✓ built in X.XXs`

- [ ] **Step 4: Final commit if any index.js changes were needed**

```bash
git add server/index.js
git commit -m "fix: ensure oauth exchange route is reachable at /api/oauth/exchange"
```

---

## Self-Review

**Spec coverage:**

- ✅ JWT-in-URL token leakage → Tasks 1, 2, 6
- ✅ Fake bulk activate/deactivate → Task 4
- ✅ UUID as company display name → Task 2
- ✅ 9 silent catch blocks in auth.js → Task 3
- ✅ `loadUsers` failure shows empty table with no feedback → Task 5
- ✅ Silent companies fetch → Task 5
- ✅ OAuthCallback catch binding loses original error → Task 2

**Placeholder scan:** All code blocks contain complete implementations. No "TODO" or "TBD" markers.

**Type consistency:** `apiFetch` signature is consistent between Task 2 (OAuthCallback) and existing usage. `usersApi.setActive` added in Task 4 Step 2 matches usage in Task 4 Step 3.

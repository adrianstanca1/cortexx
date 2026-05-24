# Google OAuth Setup

End-to-end guide for wiring "Continue with Google" on the CortexBuild login page.
The backend (Passport `passport-google-oauth20` strategy) and frontend
(`OAuthButton` + `OAuthCallback`) are already implemented — this doc covers the
operator steps required to make it actually work in each environment.

---

## 1. Create the OAuth client

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `CortexBuild — Production` (and create separate clients for `Staging`
     and `Local Dev` if you want isolation)

### Authorised JavaScript origins

| Environment | Origin                                |
| ----------- | ------------------------------------- |
| Production  | `https://www.cortexbuildpro.com`      |
| Production  | `https://cortexbuildpro.com` (apex)   |
| Staging     | `https://cortex-build.vercel.app`     |
| Local dev   | `http://localhost:5173`               |
| Local dev   | `http://localhost:3001`               |

### Authorised redirect URIs

These must match `GOOGLE_CALLBACK_URL` **exactly** — scheme, host, path. No
trailing slash. The backend normalises trailing slashes defensively, but Google
will still reject mismatched redirects with `redirect_uri_mismatch`.

| Environment | Redirect URI                                                  |
| ----------- | ------------------------------------------------------------- |
| Production  | `https://www.cortexbuildpro.com/api/auth/google/callback`     |
| Production  | `https://cortexbuildpro.com/api/auth/google/callback` (apex)  |
| Staging     | `https://cortex-build.vercel.app/api/auth/google/callback`    |
| Local dev   | `http://localhost:3001/api/auth/google/callback`              |

3. Save and copy the **Client ID** + **Client Secret**.

---

## 2. Set environment variables

### Production (VPS / `docker-compose`)

In `.env` on the VPS — **never commit secrets**:

```env
GOOGLE_CLIENT_ID=<paste from Google Cloud>
GOOGLE_CLIENT_SECRET=<paste from Google Cloud>
GOOGLE_CALLBACK_URL=https://www.cortexbuildpro.com/api/auth/google/callback
FRONTEND_URL=https://www.cortexbuildpro.com
CORS_ORIGIN=https://cortexbuildpro.com,https://www.cortexbuildpro.com
```

Reload the API container:

```bash
cd /opt/cortexbuild
docker compose up -d --force-recreate api
```

### Staging (Vercel preview / `cortex-build.vercel.app`)

Vercel → Project Settings → Environment Variables → add the same four keys with
staging URLs, then redeploy.

### Local dev

In `.env.local` (loaded by the API server):

```env
GOOGLE_CLIENT_ID=<staging client id>
GOOGLE_CLIENT_SECRET=<staging client secret>
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

The frontend `OAuthButton` reads `VITE_OAUTH_API_ORIGIN` so it can call a
different API host than the Vite dev server:

```env
# In .env / .env.local for the Vite dev server
VITE_OAUTH_API_ORIGIN=http://localhost:3001
```

---

## 3. Verify the flow

1. Open the login page (`/login`).
2. Click **Continue with Google**. Browser navigates to
   `<API>/api/auth/google?return_origin=<SPA origin>`.
3. Google consent screen appears. Approve.
4. Google redirects back to `GOOGLE_CALLBACK_URL` (the API).
5. API issues a one-time `code`, redirects browser to `<SPA>/auth/callback?code=…`.
6. SPA calls `/api/auth/exchange?code=…`, receives a JWT (set in httpOnly
   cookie) plus the user record, then routes to `/dashboard`.

If anything fails, the SPA receives one of these `error` codes (see
`OAuthCallback.tsx`):

| Code                       | Meaning                                                |
| -------------------------- | ------------------------------------------------------ |
| `google_not_configured`    | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` is empty   |
| `google_auth_failed`       | Passport rejected the Google profile (logs in API)     |
| `invalid_state`            | Cookie state cookie is missing/expired (CSRF)          |
| `state_expired`            | OAuth state TTL exceeded                               |

---

## 4. Common gotchas

- **`redirect_uri_mismatch`**: the redirect registered in Google Cloud doesn't
  match `GOOGLE_CALLBACK_URL` byte-for-byte. Compare scheme, host, port, path.
- **www vs apex**: register both. The API does *not* redirect www→apex (or vice
  versa) so the SPA must hit whichever host matches the registered URI.
- **Cookies dropped behind a proxy**: ensure `TRUST_PROXY=true` and
  `COOKIE_SECURE=true` in production so Express trusts `X-Forwarded-Proto`.
- **`return_origin` rejected**: the SPA origin must match `FRONTEND_URL` or be
  in `CORS_ORIGIN` (or be a localhost in non-production). See
  `resolveFrontendCallbackBase()` in `server/routes/oauth.js`.

---

## 5. Rotating credentials

If a `GOOGLE_CLIENT_SECRET` leaks (e.g. committed accidentally):

1. In Google Cloud Console → Credentials → reset secret on the client.
2. Update `.env` on every environment.
3. Restart the API container so the new secret is picked up.
4. Existing user sessions remain valid (they use server-issued JWTs, not the
   Google secret directly).

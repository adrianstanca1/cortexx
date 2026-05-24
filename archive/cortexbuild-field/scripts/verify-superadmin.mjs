#!/usr/bin/env node
/**
 * scripts/verify-superadmin.mjs
 *
 * End-to-end smoke test for the email + password login flow.
 *
 *   1. POSTs to /api/trpc/auth.login with { email, password }
 *   2. Asserts the response contains a sessionToken and a user with role:'admin'
 *   3. Asserts the response does NOT include passwordHash anywhere
 *   4. Calls /api/trpc/auth.me with the JWT cookie returned by step 1
 *   5. Asserts auth.me returns the same user, again without passwordHash
 *
 * Exits 0 on success, 1 on any failure with a clear diagnostic.
 *
 * Usage:
 *   VERIFY_HOST=https://field.cortexbuildpro.com \
 *   VERIFY_EMAIL=adrian.stanca1@gmail.com \
 *   VERIFY_PASSWORD='your-password' \
 *   node scripts/verify-superadmin.mjs
 *
 * Or with positional args:
 *   node scripts/verify-superadmin.mjs https://field.cortexbuildpro.com \
 *     adrian.stanca1@gmail.com 'your-password'
 *
 * No npm dependencies — uses native fetch.
 */

import 'dotenv/config';

const args = process.argv.slice(2);
const host = process.env.VERIFY_HOST ?? args[0];
const email = process.env.VERIFY_EMAIL ?? args[1];
const password = process.env.VERIFY_PASSWORD ?? args[2];

function fail(message) {
  console.error(`[verify-superadmin] FAIL — ${message}`);
  process.exit(1);
}

if (!host || !email || !password) {
  console.error('Usage: VERIFY_HOST=<host> VERIFY_EMAIL=<email> VERIFY_PASSWORD=<password> node scripts/verify-superadmin.mjs');
  console.error('   or: node scripts/verify-superadmin.mjs <host> <email> <password>');
  process.exit(2);
}

// Strip any trailing slash from host so we can join paths safely.
const baseUrl = host.replace(/\/+$/, '');

function findResponseCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  // Set-Cookie can be a single string or an array of strings depending on the
  // runtime. Normalize to an array.
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const header of headers) {
    const [pair] = header.split(';');
    const [name, value] = pair.split('=');
    if (name && value && /session/i.test(name)) {
      return `${name.trim()}=${value.trim()}`;
    }
  }
  return null;
}

function deepHasKey(obj, key) {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(item => deepHasKey(item, key));
  return Object.entries(obj).some(([k, v]) => k === key || deepHasKey(v, key));
}

async function main() {
  console.log(`[verify-superadmin] Target: ${baseUrl}`);
  console.log(`[verify-superadmin] Email:  ${email}`);

  // 1. POST /api/trpc/auth.login (single-request, superjson-wrapped).
  // tRPC v11 with the superjson transformer expects the input wrapped as
  // { "json": <input> }. Sending the raw input gives back a 400 BAD_REQUEST
  // with "Invalid input: expected object, received undefined".
  const loginResp = await fetch(`${baseUrl}/api/trpc/auth.login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { email, password } }),
  });

  const loginBody = await loginResp.json().catch(() => ({}));

  if (!loginResp.ok) {
    const code = loginBody?.error?.json?.data?.code ?? 'UNKNOWN';
    const message = loginBody?.error?.json?.message ?? loginResp.statusText;
    fail(`auth.login HTTP ${loginResp.status}: ${code} — ${message}`);
  }

  const loginData = loginBody?.result?.data?.json;
  if (!loginData) fail(`auth.login returned an unexpected envelope: ${JSON.stringify(loginBody)}`);
  if (typeof loginData.sessionToken !== 'string' || loginData.sessionToken.length < 20) {
    fail('auth.login did not return a plausible sessionToken');
  }
  if (!loginData.user || loginData.user.role !== 'admin') {
    fail(`auth.login returned a user with role=${loginData.user?.role ?? '<missing>'} — expected 'admin'`);
  }
  if (deepHasKey(loginData, 'passwordHash')) {
    fail('auth.login response includes passwordHash — security regression');
  }
  console.log('[verify-superadmin]   ✓ auth.login → role=admin, sessionToken returned, passwordHash absent');

  // 2. Use the cookie (or fall back to bearer header) to call auth.me
  const cookie = findResponseCookie(loginResp.headers.get('set-cookie'));
  const meHeaders = { 'Content-Type': 'application/json' };
  if (cookie) {
    meHeaders['Cookie'] = cookie;
  } else {
    // Native-style fallback: use the JWT as a bearer token (matches the
    // mobile client which keeps the token in expo-secure-store).
    meHeaders['Authorization'] = `Bearer ${loginData.sessionToken}`;
  }

  const meResp = await fetch(`${baseUrl}/api/trpc/auth.me`, { method: 'GET', headers: meHeaders });
  const meBody = await meResp.json().catch(() => ({}));

  if (!meResp.ok) {
    const code = meBody?.error?.json?.data?.code ?? 'UNKNOWN';
    fail(`auth.me HTTP ${meResp.status}: ${code}`);
  }

  const meUser = meBody?.result?.data?.json;
  if (!meUser) fail(`auth.me returned an unexpected envelope: ${JSON.stringify(meBody)}`);
  if (meUser.role !== 'admin') fail(`auth.me returned role=${meUser.role} — expected 'admin'`);
  if (meUser.openId !== loginData.user.openId) {
    fail(`auth.me identity mismatch (login.user.openId=${loginData.user.openId} vs me.openId=${meUser.openId})`);
  }
  if (deepHasKey(meBody, 'passwordHash')) {
    fail('auth.me response includes passwordHash — security regression');
  }
  console.log('[verify-superadmin]   ✓ auth.me → identity matches login, role=admin, passwordHash absent');

  console.log('[verify-superadmin] PASS — login flow verified end-to-end.');
}

main().catch(err => {
  console.error('[verify-superadmin] Unhandled error:', err.message);
  process.exit(1);
});

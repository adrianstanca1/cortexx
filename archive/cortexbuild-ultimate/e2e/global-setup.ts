/**
 * Global setup for E2E tests
 * Logs in via API (same contract as AuthContext) and seeds localStorage keys from src/lib/auth-storage.ts.
 */

import { chromium, type FullConfig } from '@playwright/test';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const outPath = storageState as string;
  mkdirSync(dirname(outPath), { recursive: true });

  const apiOrigin = process.env.PLAYWRIGHT_API_ORIGIN || 'http://localhost:3001';
  const email = process.env.TEST_USER_EMAIL || 'test@cortexbuild.local';
  const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

  let loginRes: Response;
  try {
    loginRes = await fetch(`${apiOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `E2E global setup: could not reach ${apiOrigin}/api/auth/login (${msg}). Start the API (cd server && npm start) on port 3001.`,
    );
  }

  const data = (await loginRes.json().catch(() => ({}))) as {
    token?: string;
    user?: Record<string, unknown>;
    message?: string;
  };

  if (!loginRes.ok || !data.token || !data.user) {
    if (
      loginRes.status === 429 &&
      existsSync(outPath) &&
      statSync(outPath).size > 80
    ) {
      console.warn(
        `E2E global setup: login rate-limited (429); reusing existing storage at ${outPath}`,
      );
      return;
    }
    throw new Error(
      `E2E global setup: API login failed HTTP ${loginRes.status}: ${JSON.stringify(data)}. Ensure DATABASE_URL, seed a user for ${email}, or set TEST_USER_EMAIL / TEST_USER_PASSWORD. If you see 429, wait for the login rate limit or reuse a valid e2e/.auth/storage-state.json.`,
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const origin = new URL(baseURL ?? 'http://localhost:5173').origin;

  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('cortexbuild_token', t);
      localStorage.setItem('cortexbuild_user', JSON.stringify(u));
    },
    [data.token, data.user] as [string, Record<string, unknown>],
  );

  const meResponse = page.waitForResponse(
    (r) => r.url().includes('/auth/me') && r.request().method() === 'GET',
    { timeout: 25_000 },
  );
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  const meRes = await meResponse;
  if (!meRes.ok()) {
    throw new Error(
      `E2E global setup: GET /auth/me returned ${meRes.status()} after login — token or API_BASE may be wrong.`,
    );
  }

  await page.locator('#root').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(500);

  await page.context().storageState({ path: outPath });
  await browser.close();

  console.log(`E2E global setup: storage state saved for ${email} at ${outPath}`);
}

export default globalSetup;

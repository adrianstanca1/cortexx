const express    = require('express');
const passport   = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: MicrosoftStrategy } = require('passport-microsoft');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const redis      = require('redis');
const db         = require('../db');
const { createOAuthUserWithTenant } = require('../lib/bootstrap-tenant');
const authMiddleware = require('../middleware/auth');
const { setAuthTokenCookie, createUserSession } = require('../lib/authSessionCookie');
const router     = express.Router();

/**
 * OAuth redirect URIs must match the provider console exactly (scheme + host + path).
 * Trailing slashes are stripped. Production defaults use https://www.cortexbuildpro.com
 * for GOOGLE_CALLBACK_URL / MICROSOFT_CALLBACK_URL (see deploy workflows and .env examples).
 * Register that exact URI in Google Cloud / Entra; add the apex URL too if you ever
 * point callbacks at cortexbuildpro.com without www.
 */
function normalizeProviderCallbackUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let u = url.trim();
  while (u.endsWith('/')) u = u.slice(0, -1);
  // Keep www. prefix to match Google Cloud Console redirect URIs
  // u = u.replace('://www.cortexbuildpro.com', '://cortexbuildpro.com');
  return u;
}

/**
 * SPA origin for post-OAuth redirect (/auth/callback). Prefer ?return_origin= from the
 * browser so any Vite dev port works; validate against FRONTEND_URL / CORS_ORIGIN in production.
 */
function resolveFrontendCallbackBase(req) {
  const raw = req.query.return_origin;
  if (typeof raw === 'string' && raw.length > 0 && raw.length < 512) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol');
      const h = u.hostname.toLowerCase();
      const isLocal =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '[::1]' ||
        /^10\.\d+\.\d+\.\d+$/.test(h) ||
        /^192\.168\.\d+\.\d+$/.test(h);
      if (process.env.NODE_ENV !== 'production' && isLocal) {
        return u.origin;
      }
      const allow = (process.env.FRONTEND_URL || '').trim();
      if (allow) {
        try {
          if (new URL(allow).origin === u.origin) return u.origin;
        } catch { /* ignore */ }
      }
      const corsList = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const c of corsList) {
        try {
          if (new URL(c).origin === u.origin) return u.origin;
        } catch { /* ignore */ }
      }
    } catch (e) {
      console.warn('[OAuth] Ignoring invalid return_origin:', e.message);
    }
  }
  const def = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  try {
    return new URL(def).origin;
  } catch {
    return 'http://localhost:5173';
  }
}

/** Prefer SPA origin saved in OAuth state; otherwise FRONTEND_URL / return_origin on req. */
function loginErrorUrl(storedState, req, errorCode) {
  const q = encodeURIComponent(errorCode);
  if (storedState?.redirectUri) {
    try {
      return `${new URL(storedState.redirectUri).origin}/login?error=${q}`;
    } catch { /* ignore */ }
  }
  return `${resolveFrontendCallbackBase(req)}/login?error=${q}`;
}

// Redis client for OAuth state storage (distributed, survives restarts)
const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(err => console.error('[OAuth Redis]', err.message));

const STATE_TTL = 600; // 10 minutes

async function setOAuthState(state, data) {
  await redisClient.setEx(`oauth:state:${state}`, STATE_TTL, JSON.stringify(data));
}

async function getOAuthState(state) {
  const data = await redisClient.get(`oauth:state:${state}`);
  return data ? JSON.parse(data) : null;
}

async function deleteOAuthState(state) {
  await redisClient.del(`oauth:state:${state}`);
}

// One-time OAuth code exchange — replaces JWT-in-URL pattern
// Code is valid for 60 seconds and deleted on first use
async function setOAuthCode(code, token) {
  await redisClient.setEx(`oauth:code:${code}`, 60, token);
}

async function getAndDeleteOAuthCode(code) {
  return await redisClient.getDel(`oauth:code:${code}`);
}

// Rate limiter for OAuth callbacks (prevent brute force attacks)
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many OAuth attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Copy-paste helper when Google shows `redirect_uri_mismatch` (no secrets). */
router.get('/oauth-redirect-help', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const g = (process.env.GOOGLE_CALLBACK_URL || '').trim();
  const m = (process.env.MICROSOFT_CALLBACK_URL || '').trim();
  const flipHost = (u) => {
    if (!u) return null;
    if (u.includes('127.0.0.1')) return u.replace(/127\.0\.0\.1/g, 'localhost');
    if (u.includes('localhost')) return u.replace(/localhost/g, '127.0.0.1');
    return null;
  };
  res.json({
    error: 'redirect_uri_mismatch',
    explanation:
      'Google compares the redirect_uri parameter to your OAuth client’s "Authorized redirect URIs" with an exact string match (http vs https, localhost vs 127.0.0.1, path, and trailing slash all count).',
    google_redirect_uri_this_server_sends: g || null,
    also_try_registering_this_alternate_host: flipHost(g),
    microsoft_redirect_uri_this_server_sends: m || null,
    also_try_registering_this_alternate_host_microsoft: flipHost(m),
    where_to_add:
      'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → your Web client → Authorized redirect URIs',
    verify_endpoint: '/api/auth/oauth-redirect-help',
  });
});

// Configure Google OAuth strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: normalizeProviderCallbackUrl(process.env.GOOGLE_CALLBACK_URL),
    scope: ['profile', 'email'],
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName || profile.emails?.[0]?.value?.split('@')[0];
      const avatar = profile.photos?.[0]?.value;

      if (!email) {
        console.error('[OAuth] No email found from Google for profile:', profile.id);
        return done(null, false, { message: 'No email found from Google' });
      }

      // Check if user exists
      const existingUser = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      let user;
      if (existingUser.rows.length > 0) {
        user = existingUser.rows[0];
      } else {
        user = await createOAuthUserWithTenant(
          db,
          { email, name, avatarUrl: avatar ?? null },
          { orgName: `${name}'s organization`, companyName: name },
          {
            provider: 'google',
            providerUserId: profile.id,
            accessToken,
            refreshToken,
            email,
          }
        );
      }

      // Link OAuth provider if not already linked
      const providerCheck = await db.query(
        'SELECT * FROM oauth_providers WHERE user_id = $1 AND provider = $2',
        [user.id, 'google']
      );

      if (providerCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO oauth_providers (user_id, provider, provider_user_id, access_token, refresh_token, email)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, 'google', profile.id, accessToken, refreshToken, email]
        );
      } else {
        // Update tokens
        await db.query(
          'UPDATE oauth_providers SET access_token = $1, refresh_token = $2 WHERE user_id = $3 AND provider = $4',
          [accessToken, refreshToken, user.id, 'google']
        );
      }

      done(null, user);
    } catch (err) {
      console.error('[OAuth] Google strategy error:', err);
      done(err);
    }
  }));
  console.log(
    '[OAuth] Google OAuth callbackURL (must match Google Console redirect URI exactly):',
    normalizeProviderCallbackUrl(process.env.GOOGLE_CALLBACK_URL)
  );
}

// Configure Microsoft OAuth strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: normalizeProviderCallbackUrl(process.env.MICROSOFT_CALLBACK_URL),
    scope: ['user.read'],
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName || profile.emails?.[0]?.value?.split('@')[0];

      if (!email) {
        console.error('[OAuth] No email found from Microsoft for profile:', profile.id);
        return done(null, false, { message: 'No email found from Microsoft' });
      }

      // Check if user exists
      const existingUser = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      let user;
      if (existingUser.rows.length > 0) {
        user = existingUser.rows[0];
      } else {
        user = await createOAuthUserWithTenant(
          db,
          { email, name, avatarUrl: null },
          { orgName: `${name}'s organization`, companyName: name },
          {
            provider: 'microsoft',
            providerUserId: profile.id,
            accessToken,
            refreshToken,
            email,
          }
        );
      }

      // Link OAuth provider if not already linked
      const providerCheck = await db.query(
        'SELECT * FROM oauth_providers WHERE user_id = $1 AND provider = $2',
        [user.id, 'microsoft']
      );

      if (providerCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO oauth_providers (user_id, provider, provider_user_id, access_token, refresh_token, email)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, 'microsoft', profile.id, accessToken, refreshToken, email]
        );
      } else {
        // Update tokens
        await db.query(
          'UPDATE oauth_providers SET access_token = $1, refresh_token = $2 WHERE user_id = $3 AND provider = $4',
          [accessToken, refreshToken, user.id, 'microsoft']
        );
      }

      done(null, user);
    } catch (err) {
      console.error('[OAuth] Microsoft strategy error:', err);
      done(err);
    }
  }));
}

// Serialize/deserialize user
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || false);
  } catch (err) {
    done(err);
  }
});

// Initialize Google OAuth with CSRF-protected state
router.get('/google', async (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
    });
  }
  // Generate cryptographically random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  const frontendRedirect = `${resolveFrontendCallbackBase(req)}/auth/callback`;

  // Store state with expiry (10 minutes) and intended redirect
  await setOAuthState(state, {
    createdAt: Date.now(),
    redirectUri: frontendRedirect
  });

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state
  })(req, res, next);
});

// Google OAuth callback (rate limited)
router.get('/google/callback', oauthLimiter, async (req, res, next) => {
  const { state } = req.query;

  // Validate state parameter (CSRF protection)
  if (!state) {
    console.warn('[OAuth] Invalid or missing state parameter - possible CSRF attack');
    return res.redirect(loginErrorUrl(null, req, 'invalid_state'));
  }

  const storedState = await getOAuthState(state);
  if (!storedState) {
    console.warn('[OAuth] Invalid or missing state parameter - possible CSRF attack');
    return res.redirect(loginErrorUrl(null, req, 'invalid_state'));
  }

  await deleteOAuthState(state); // One-time use

  // Check if state has expired (10 minute window)
  if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
    console.warn('[OAuth] State parameter expired');
    return res.redirect(loginErrorUrl(storedState, req, 'state_expired'));
  }

  passport.authenticate('google', { session: false }, async (err, user, info) => {
    try {
      if (err || !user) {
        console.error('[OAuth] Google callback authentication failed:', err || info);
        return res.redirect(loginErrorUrl(storedState, req, 'google_auth_failed'));
      }

      // Generate JWT token — include name/company for consistency with regular login
      const token = jwt.sign(
        {
          id: user.id,
          jti: crypto.randomUUID(),
          email: user.email,
          name: user.name || null,
          role: user.role || 'field_worker',
          organization_id: user.organization_id || null,
          company_id: user.company_id || null,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Use one-time code to avoid JWT appearing in URL, logs, or Referer headers
      const code = crypto.randomBytes(16).toString('hex');
      await setOAuthCode(code, token);
      const redirectUri = storedState.redirectUri;
      res.redirect(`${redirectUri}?code=${code}`);
    } catch (e) {
      console.error('[OAuth] Google callback error:', e);
      res.redirect(loginErrorUrl(storedState, req, 'google_auth_failed'));
    }
  })(req, res, next);
});

// Initialize Microsoft OAuth with CSRF-protected state
router.get('/microsoft', async (req, res, next) => {
  // Guard: Microsoft OAuth must be configured
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return res.redirect(loginErrorUrl(null, req, 'microsoft_not_configured'));
  }
  // Generate cryptographically random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  const frontendRedirect = `${resolveFrontendCallbackBase(req)}/auth/callback`;

  // Store state with expiry (10 minutes) and intended redirect
  await setOAuthState(state, {
    createdAt: Date.now(),
    redirectUri: frontendRedirect
  });

  passport.authenticate('microsoft', {
    scope: ['user.read'],
    state: state
  })(req, res, next);
});

// Microsoft OAuth callback (rate limited)
router.get('/microsoft/callback', oauthLimiter, async (req, res, next) => {
  // Guard: Microsoft OAuth must be configured
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return res.redirect(loginErrorUrl(null, req, 'microsoft_not_configured'));
  }
  const { state } = req.query;

  // Validate state parameter (CSRF protection)
  if (!state) {
    console.warn('[OAuth] Invalid or missing state parameter - possible CSRF attack');
    return res.redirect(loginErrorUrl(null, req, 'invalid_state'));
  }

  const storedState = await getOAuthState(state);
  if (!storedState) {
    console.warn('[OAuth] Invalid or missing state parameter - possible CSRF attack');
    return res.redirect(loginErrorUrl(null, req, 'invalid_state'));
  }

  await deleteOAuthState(state); // One-time use

  // Check if state has expired (10 minute window)
  if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
    console.warn('[OAuth] State parameter expired');
    return res.redirect(loginErrorUrl(storedState, req, 'state_expired'));
  }

  passport.authenticate('microsoft', { session: false }, async (err, user, info) => {
    try {
      if (err || !user) {
        console.error('[OAuth] Microsoft callback authentication failed:', err || info);
        return res.redirect(loginErrorUrl(storedState, req, 'microsoft_auth_failed'));
      }

      // Generate JWT token — include name/company for consistency with regular login
      const token = jwt.sign(
        {
          id: user.id,
          jti: crypto.randomUUID(),
          email: user.email,
          name: user.name || null,
          role: user.role || 'field_worker',
          organization_id: user.organization_id || null,
          company_id: user.company_id || null,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Use one-time code to avoid JWT appearing in URL, logs, or Referer headers
      const code = crypto.randomBytes(16).toString('hex');
      await setOAuthCode(code, token);
      const redirectUri = storedState.redirectUri;
      res.redirect(`${redirectUri}?code=${code}`);
    } catch (e) {
      console.error('[OAuth] Microsoft callback error:', e);
      res.redirect(loginErrorUrl(storedState, req, 'microsoft_auth_failed'));
    }
  })(req, res, next);
});

// Link Google account to existing user (requires JWT auth)
router.post('/google/link', authMiddleware, async (req, res) => {
  try {
    const { accessToken, refreshToken, profile } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if already linked
    const existing = await db.query(
      'SELECT * FROM oauth_providers WHERE user_id = $1 AND provider = $2',
      [userId, 'google']
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Google account already linked' });
    }

    // Link the account
    await db.query(
      `INSERT INTO oauth_providers (user_id, provider, provider_user_id, access_token, refresh_token, email)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'google', profile?.id, accessToken, refreshToken, req.user?.email]
    );

    res.json({ success: true, message: 'Google account linked successfully' });
  } catch (err) {
    console.error('Failed to link Google account:', err);
    res.status(500).json({ error: 'Failed to link Google account' });
  }
});

// Unlink Google account (requires JWT auth)
router.delete('/google/unlink', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db.query(
      'DELETE FROM oauth_providers WHERE user_id = $1 AND provider = $2',
      [userId, 'google']
    );

    res.json({ success: true, message: 'Google account unlinked successfully' });
  } catch (err) {
    console.error('Failed to unlink Google account:', err);
    res.status(500).json({ error: 'Failed to unlink Google account' });
  }
});

// Get OAuth providers for current user
router.get('/oauth/providers', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      'SELECT provider, email, created_at FROM oauth_providers WHERE user_id = $1',
      [userId]
    );

    res.json({ providers: result.rows });
  } catch (err) {
    console.error('Failed to get OAuth providers:', err);
    res.status(500).json({ error: 'Failed to get OAuth providers' });
  }
});

// GET /api/auth/exchange?code=xxx
// Exchanges a one-time code (60s TTL) for a JWT. Code is deleted on first use.
// This avoids placing the JWT in a redirect URL where it leaks into logs and history.
router.get('/exchange', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code parameter' });
  }
  try {
    const token = await getAndDeleteOAuthCode(code);
    if (!token) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT id,name,email,role,phone,avatar,organization_id,company_id,created_at FROM users WHERE id = $1',
      [payload.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    await createUserSession(rows[0].id, token, req);
    setAuthTokenCookie(res, token);
    // Token also returned for older clients; httpOnly cookie is the primary session for apiFetch.
    res.json({ token, user: rows[0] });
  } catch (err) {
    console.error('[OAuth exchange]', err);
    res.status(500).json({ error: 'Exchange failed' });
  }
});

module.exports = router;

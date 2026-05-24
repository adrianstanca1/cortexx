const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");
const { logAudit } = require("./audit-helper");
const { insertOrgAndCompany } = require("../lib/bootstrap-tenant");
const {
  blacklistToken,
  revokeAllUserTokens,
} = require("../lib/tokenBlacklist");
const {
  buildTenantFilter,
  isSuperAdmin,
  isCompanyOwner,
} = require("../middleware/tenantFilter");
const {
  setAuthTokenCookie,
  createUserSession,
} = require("../lib/authSessionCookie");
const {
  safeParse,
  loginSchema,
  registerSchema,
  twoFactorVerifySchema,
  twoFactorDisableSchema,
  twoFactorValidateSchema,
  updateProfileSchema,
  updatePasswordSchema,
  avatarSchema,
  settingSchema,
  inviteSchema,
  inviteAcceptSchema,
  createUserSchema,
} = require("../lib/zod-validation");
const {
  generateSecret,
  generateQRDataUrl,
  verifyToken,
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
} = require("../lib/mfa");

const router = express.Router();

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error("[SECURITY] JWT_SECRET environment variable is not set!");
  process.exit(1);
}

function redisConnectionUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = process.env.REDIS_PORT || "6379";
  return `redis://${host}:${port}`;
}

const redis = (() => {
  try {
    const { createClient } = require("redis");
    const client = createClient({ url: redisConnectionUrl() });
    client.on("error", (err) => {
      console.error("[Auth Redis] Connection error:", err.message);
    });
    return client;
  } catch {
    return null;
  }
})();

const VALID_ROLES = [
  "super_admin",
  "company_owner",
  "admin",
  "project_manager",
  "field_worker",
  "client",
];
const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!PASSWORD_POLICY.test(password)) {
    return "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&*)";
  }
  return null;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const mfaChallengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 challenge attempts per 15 min per IP. Generous (room for typos)
  // but stops 6-digit brute force (1M codes / 10 per 15min => 28+ years).
  message: {
    message: "Too many MFA attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many password reset attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

async function getFailedAttemptsKey(email, ip) {
  if (redis) {
    try {
      if (!redis.isOpen) await redis.connect();
      const key = `login_fail:${email}:${ip}`;
      const attempts = await redis.get(key);
      return { key, attempts: parseInt(attempts || "0", 10) };
    } catch {
      return null;
    }
  }
  return null;
}

async function incrementFailedAttempts(email, ip) {
  let redisAttempts = null;
  if (redis) {
    try {
      if (!redis.isOpen) await redis.connect();
      const key = `login_fail:${email}:${ip}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, 15 * 60);
      }
      redisAttempts = current;
    } catch {
      // Redis failed, fall through to DB-only
    }
  }

  // Always update DB as fallback/primary record
  try {
    const { rows } = await pool.query(
      "UPDATE users SET failed_attempts = failed_attempts + 1 WHERE email = $1 RETURNING failed_attempts",
      [email.toLowerCase().trim()],
    );
    if (rows[0] && rows[0].failed_attempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await pool.query(
        "UPDATE users SET locked_until = $1 WHERE email = $2",
        [lockedUntil, email.toLowerCase().trim()],
      );
    }
  } catch (err) {
    console.error("[incrementFailedAttempts] DB error:", err.message);
  }

  return redisAttempts;
}

async function clearFailedAttempts(email, ip) {
  if (redis) {
    try {
      if (!redis.isOpen) await redis.connect();
      await redis.del(`login_fail:${email}:${ip}`);
      await redis.del(`login_lockout:${email}:${ip}`);
    } catch {}
  }

  // Always clear DB columns
  try {
    await pool.query(
      "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE email = $1",
      [email.toLowerCase().trim()],
    );
  } catch (err) {
    console.error("[clearFailedAttempts] DB error:", err.message);
  }
}

async function checkLockout(email, ip) {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check DB first (fallback when Redis is down)
  try {
    const { rows } = await pool.query(
      "SELECT failed_attempts, locked_until FROM users WHERE email = $1",
      [normalizedEmail],
    );
    if (rows[0] && rows[0].locked_until) {
      const lockedUntil = new Date(rows[0].locked_until);
      if (lockedUntil > new Date()) {
        const retryAfter = Math.ceil((lockedUntil - Date.now()) / 1000);
        return { locked: true, retryAfter: Math.max(retryAfter, 1) };
      }
      // Lock expired — reset counters so user gets a fresh start (matches Redis TTL expiry)
      await pool.query(
        "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE email = $1",
        [normalizedEmail],
      );
    }
  } catch (err) {
    console.error("[checkLockout] DB error:", err.message);
  }

  // 2. Check Redis (primary)
  if (redis) {
    try {
      if (!redis.isOpen) await redis.connect();
      const lockKey = `login_lockout:${email}:${ip}`;
      const locked = await redis.get(lockKey);
      if (locked) {
        const ttl = await redis.ttl(lockKey);
        return { locked: true, retryAfter: ttl > 0 ? ttl : 900 };
      }
      const failKey = `login_fail:${email}:${ip}`;
      const attempts = parseInt((await redis.get(failKey)) || "0", 10);
      if (attempts >= 5) {
        await redis.set(lockKey, "1", { EX: 15 * 60 });
        await redis.del(failKey);
        return { locked: true, retryAfter: 900 };
      }
    } catch {}
  }

  // 3. If no Redis and DB has >= 5 failed_attempts but no locked_until yet, lock now
  try {
    const { rows } = await pool.query(
      "SELECT failed_attempts FROM users WHERE email = $1",
      [normalizedEmail],
    );
    if (rows[0] && rows[0].failed_attempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await pool.query(
        "UPDATE users SET locked_until = $1 WHERE email = $2",
        [lockedUntil, normalizedEmail],
      );
      return { locked: true, retryAfter: 900 };
    }
  } catch {}

  return { locked: false };
}

async function invalidateSessionByTokenHash(tokenHash) {
  try {
    await pool.query("DELETE FROM user_sessions WHERE token_hash = $1", [
      tokenHash,
    ]);
  } catch (err) {
    console.error("[invalidateSession]", err.message);
  }
}

async function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /api/auth/register
router.post("/register", registerLimiter, async (req, res) => {
  const validation = safeParse(registerSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { name, email, password, company, phone } = validation.data;

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    if (existing.rows.length) {
      return res
        .status(409)
        .json({ message: "An account with that email already exists" });
    }

    const hash = await bcrypt.hash(password, 12);
    const companyName = company.trim();
    const client = await pool.connect();
    let newUser;
    try {
      await client.query("BEGIN");
      const { organizationId, companyId } = await insertOrgAndCompany(client, {
        orgName: companyName,
        companyName: companyName,
      });
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, phone, organization_id, company_id)
         VALUES ($1, $2, $3, 'company_owner', $4, $5, $6)
         RETURNING id, name, email, role, phone, organization_id, company_id, created_at`,
        [
          name.trim(),
          email.toLowerCase().trim(),
          hash,
          phone || null,
          organizationId,
          companyId,
        ],
      );
      newUser = rows[0];
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    logAudit({
      auth: {
        userId: newUser.id,
        organization_id: newUser.organization_id,
        company_id: newUser.company_id,
      },
      action: "create",
      entityType: "users",
      entityId: newUser.id,
      newData: { email: newUser.email, role: newUser.role, name: newUser.name },
    });

    const token = jwt.sign(
      {
        id: newUser.id,
        jti: crypto.randomUUID(),
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        organization_id: newUser.organization_id,
        company_id: newUser.company_id,
      },
      SECRET,
      { expiresIn: "7d" },
    );

    await createUserSession(newUser.id, token, req);

    setAuthTokenCookie(res, token);

    const { password_hash, totp_secret, totp_enabled, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser });
  } catch (err) {
    console.error("[auth/register]", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  const validation = safeParse(loginSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { email, password } = validation.data;

  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const lockout = await checkLockout(email, ip);
  if (lockout.locked) {
    return res
      .status(429)
      .json({ locked: true, retryAfter: lockout.retryAfter });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    const user = rows[0];
    if (!user) {
      await incrementFailedAttempts(email, ip);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await incrementFailedAttempts(email, ip);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await clearFailedAttempts(email, ip);

    // Check both legacy totp_enabled and new mfa_enabled
    if (user.totp_enabled || user.mfa_enabled) {
      const tempToken = jwt.sign(
        {
          id: user.id,
          // Dedicated claim distinct from session JWTs so a stolen session
          // token can never be replayed as an MFA temp token, and vice versa.
          token_type: "mfa_temp",
          temp: true, // legacy field kept for backwards compat with old SPAs
          jti: crypto.randomUUID(),
          email: user.email,
          role: user.role,
          name: user.name,
          organization_id: user.organization_id,
          company_id: user.company_id,
        },
        SECRET,
        { expiresIn: "5m" },
      );
      return res.json({ requires2FA: true, tempToken });
    }

    const token = jwt.sign(
      {
        id: user.id,
        jti: crypto.randomUUID(),
        email: user.email,
        role: user.role,
        name: user.name,
        organization_id: user.organization_id,
        company_id: user.company_id,
      },
      SECRET,
      { expiresIn: "7d" },
    );

    await createUserSession(user.id, token, req);

    setAuthTokenCookie(res, token);

    const { password_hash, totp_secret, totp_enabled, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/mfa/enrol - TOTP enrollment, returns secret + QR code
router.post("/mfa/enrol", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT mfa_enabled, email FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    if (rows[0].mfa_enabled) {
      return res
        .status(400)
        .json({
          message: "MFA is already enabled. Disable it first to reset.",
        });
    }

    const secret = generateSecret();
    const qrDataUrl = await generateQRDataUrl(secret, rows[0].email);
    const recoveryCodes = generateRecoveryCodes();

    // Store secret unverified; not enabled until verify endpoint is called
    await pool.query("UPDATE users SET mfa_secret = $1 WHERE id = $2", [
      secret,
      req.user.id,
    ]);

    res.json({
      secret,
      qrDataUrl,
      otpauthUrl: `otpauth://totp/CortexBuild:${rows[0].email}?secret=${secret}&issuer=CortexBuild`,
      recoveryCodes,
    });
  } catch (err) {
    console.error("[auth/mfa/enrol]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/mfa/verify - Verify TOTP code and enable MFA
router.post("/mfa/verify", authMiddleware, async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT mfa_secret FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!rows[0] || !rows[0].mfa_secret) {
      return res
        .status(400)
        .json({
          message: "MFA enrollment not initiated. Call /mfa/enrol first.",
        });
    }

    if (!verifyToken(rows[0].mfa_secret, token)) {
      return res.status(400).json({ message: "Invalid TOTP code" });
    }

    // Get recovery codes that were shown during enrol, hash them, and store
    // For now, generate fresh codes during verify (user should have saved them from enrol)
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(recoveryCodes);

    await pool.query(
      "UPDATE users SET mfa_enabled = TRUE, mfa_recovery_codes_hash = $1 WHERE id = $2",
      [hashedCodes, req.user.id],
    );
    logAudit({
      auth: req.user,
      action: "update",
      entityType: "users",
      entityId: req.user.id,
      newData: { mfa_enabled: true },
    });

    // Return recovery codes one more time for user to save
    res.json({
      message: "MFA has been enabled successfully",
      recoveryCodes,
    });
  } catch (err) {
    console.error("[auth/mfa/verify]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Mark an MFA temp token's jti as consumed (single-use).
 * Backed by Redis when available; falls back to a no-op if Redis is down so
 * MFA still works during incidents (the rate limiter still caps attempts).
 */
async function consumeMfaTempJti(jti) {
  if (!jti) return;
  try {
    if (!redis.isOpen) await redis.connect();
    // 5min TTL matches the JWT lifetime; key naturally expires
    await redis.set(`mfa_temp_used:${jti}`, "1", { EX: 300, NX: true });
  } catch (err) {
    console.warn("[mfa/challenge] Redis unavailable for jti tracking:", err.message);
  }
}

async function isMfaTempJtiConsumed(jti) {
  if (!jti) return false;
  try {
    if (!redis.isOpen) await redis.connect();
    return Boolean(await redis.get(`mfa_temp_used:${jti}`));
  } catch (err) {
    console.warn("[mfa/challenge] Redis unavailable for jti check:", err.message);
    return false;
  }
}

// POST /api/auth/mfa/challenge - Verify TOTP or recovery code during login
router.post("/mfa/challenge", mfaChallengeLimiter, async (req, res) => {
  const { tempToken, token, recoveryCode } = req.body;
  if (!tempToken) {
    return res.status(400).json({ message: "Missing temporary token" });
  }
  if (!token && !recoveryCode) {
    return res
      .status(400)
      .json({ message: "Provide either TOTP token or recovery code" });
  }

  try {
    const payload = jwt.verify(tempToken, SECRET);
    // Strict type check: only mfa_temp tokens may be exchanged here. The
    // legacy `temp: true` flag is accepted for transitional compatibility,
    // but new tokens always carry token_type.
    if (payload.token_type !== "mfa_temp" && !payload.temp) {
      return res.status(400).json({ message: "Invalid token type" });
    }

    // Single-use: reject if this jti has already been spent. Stops replay.
    if (await isMfaTempJtiConsumed(payload.jti)) {
      return res
        .status(401)
        .json({ message: "This challenge has already been used. Please login again." });
    }

    const { rows } = await pool.query(
      "SELECT mfa_secret, mfa_recovery_codes_hash FROM users WHERE id = $1",
      [payload.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!rows[0].mfa_secret) {
      return res
        .status(400)
        .json({ message: "MFA is not enabled for this account" });
    }

    let mfaValid = false;

    // Check TOTP token
    if (token) {
      mfaValid = verifyToken(rows[0].mfa_secret, token);
    }

    // Check recovery code (if TOTP wasn't valid).
    // Atomicity: consumeRecoveryCode validates against the current array, then
    // we apply the update with a WHERE-clause guard requiring the array to
    // still contain the consumed hash. This prevents two concurrent challenges
    // from both succeeding with the same recovery code.
    if (!mfaValid && recoveryCode) {
      const { valid, remainingCodes, consumedHash } = await consumeRecoveryCode(
        recoveryCode,
        rows[0].mfa_recovery_codes_hash,
      );
      if (valid) {
        const result = await pool.query(
          `UPDATE users
              SET mfa_recovery_codes_hash = $1
            WHERE id = $2
              AND $3 = ANY(mfa_recovery_codes_hash)`,
          [remainingCodes, payload.id, consumedHash],
        );
        // rowCount=0 means another request already consumed this code.
        mfaValid = result.rowCount === 1;
      }
    }

    if (!mfaValid) {
      // Failed attempt — still consume the jti so a single tempToken can't
      // be used as a 6-digit brute-force oracle. User must login again.
      await consumeMfaTempJti(payload.jti);
      return res.status(401).json({ message: "Invalid TOTP code or recovery code" });
    }

    // Successful challenge — burn the jti so this token can't be replayed.
    await consumeMfaTempJti(payload.jti);

    // Issue full session token
    const sessionToken = jwt.sign(
      {
        id: payload.id,
        jti: crypto.randomUUID(),
        email: payload.email,
        role: payload.role,
        name: payload.name,
        organization_id: payload.organization_id,
        company_id: payload.company_id,
      },
      SECRET,
      { expiresIn: "7d" },
    );

    await createUserSession(payload.id, sessionToken, req);
    setAuthTokenCookie(res, sessionToken);

    res.json({ message: "MFA challenge passed" });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }
    console.error("[auth/mfa/challenge]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/mfa/disable - Disable MFA after TOTP verification
router.post("/mfa/disable", authMiddleware, async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT mfa_secret FROM users WHERE id = $1",
      [req.user.id],
    );
    const user = rows[0];
    if (!user || !user.mfa_secret) {
      return res
        .status(400)
        .json({ message: "MFA is not enabled for this account" });
    }

    if (!verifyToken(user.mfa_secret, token)) {
      return res.status(400).json({ message: "Invalid TOTP code" });
    }

    await pool.query(
      "UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE, mfa_recovery_codes_hash = NULL WHERE id = $1",
      [req.user.id],
    );
    logAudit({
      auth: req.user,
      action: "update",
      entityType: "users",
      entityId: req.user.id,
      newData: { mfa_enabled: false },
    });

    res.json({ message: "MFA has been disabled" });
  } catch (err) {
    console.error("[auth/mfa/disable]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/2fa/setup
router.post("/2fa/setup", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT totp_enabled, email FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    if (rows[0].totp_enabled) {
      return res
        .status(400)
        .json({
          message: "2FA is already enabled. Disable it first to reset.",
        });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      rows[0].email,
      "CortexBuild",
      secret,
    );
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await pool.query("UPDATE users SET totp_secret = $1 WHERE id = $2", [
      secret,
      req.user.id,
    ]);

    res.json({ secret, qrCode: qrCodeDataUrl });
  } catch (err) {
    console.error("[auth/2fa/setup]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/2fa/verify
router.post("/2fa/verify", authMiddleware, async (req, res) => {
  const validation = safeParse(twoFactorVerifySchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { code } = validation.data;

  try {
    const { rows } = await pool.query(
      "SELECT totp_secret FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!rows[0] || !rows[0].totp_secret) {
      return res
        .status(400)
        .json({
          message: "2FA setup has not been initiated. Call /2fa/setup first.",
        });
    }

    const isValid = authenticator.verify({
      token: code,
      secret: rows[0].totp_secret,
    });
    if (!isValid) {
      return res.status(400).json({ message: "Invalid TOTP code" });
    }

    await pool.query("UPDATE users SET totp_enabled = TRUE WHERE id = $1", [
      req.user.id,
    ]);
    logAudit({
      auth: req.user,
      action: "update",
      entityType: "users",
      entityId: req.user.id,
      newData: { totp_enabled: true },
    });

    res.json({ message: "2FA has been enabled successfully" });
  } catch (err) {
    console.error("[auth/2fa/verify]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/2fa/disable
router.post("/2fa/disable", authMiddleware, async (req, res) => {
  const validation = safeParse(twoFactorDisableSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { password, code } = validation.data;

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);
    const user = rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(400).json({ message: "Current password is incorrect" });

    if (
      !user.totp_secret ||
      !authenticator.verify({ token: code, secret: user.totp_secret })
    ) {
      return res.status(400).json({ message: "Invalid TOTP code" });
    }

    await pool.query(
      "UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1",
      [req.user.id],
    );
    logAudit({
      auth: req.user,
      action: "update",
      entityType: "users",
      entityId: req.user.id,
      newData: { totp_enabled: false },
    });

    res.json({ message: "2FA has been disabled" });
  } catch (err) {
    console.error("[auth/2fa/disable]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/2fa/validate
router.post("/2fa/validate", async (req, res) => {
  const validation = safeParse(twoFactorValidateSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { tempToken, code } = validation.data;

  try {
    const payload = jwt.verify(tempToken, SECRET);
    if (!payload.temp) {
      return res.status(400).json({ message: "Invalid token type" });
    }

    const { rows } = await pool.query(
      "SELECT totp_secret FROM users WHERE id = $1",
      [payload.id],
    );
    if (!rows[0] || !rows[0].totp_secret) {
      return res
        .status(400)
        .json({ message: "2FA is not enabled for this account" });
    }

    const isValid = authenticator.verify({
      token: code,
      secret: rows[0].totp_secret,
    });
    if (!isValid) {
      return res.status(401).json({ message: "Invalid TOTP code" });
    }

    const token = jwt.sign(
      {
        id: payload.id,
        jti: payload.jti,
        email: payload.email,
        role: payload.role,
        name: payload.name,
        organization_id: payload.organization_id,
        company_id: payload.company_id,
      },
      SECRET,
      { expiresIn: "7d" },
    );

    await createUserSession(payload.id, token, req);

    setAuthTokenCookie(res, token);

    res.json({ message: "2FA validated successfully" });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }
    console.error("[auth/2fa/validate]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id,name,email,role,phone,avatar,organization_id,company_id,created_at,totp_enabled FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    const { password_hash, totp_secret, ...safeUser } = rows[0];
    res.json(safeUser);
  } catch (err) {
    console.error("[auth/me]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/auth/profile
router.put("/profile", authMiddleware, async (req, res) => {
  const validation = safeParse(updateProfileSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { name, phone } = validation.data;
  try {
    const { rows } = await pool.query(
      "UPDATE users SET name=$1, phone=$2 WHERE id=$3 RETURNING id,name,email,role,phone,avatar,organization_id,company_id",
      [name, phone, req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("[auth/profile]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/auth/password
router.put("/password", authMiddleware, async (req, res) => {
  const validation = safeParse(updatePasswordSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { currentPassword, newPassword } = validation.data;

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);
    const user = rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid)
      return res.status(400).json({ message: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      hash,
      req.user.id,
    ]);
    logAudit({
      auth: req.user,
      action: "update",
      entityType: "users",
      entityId: req.user.id,
      newData: { password_changed: true },
    });
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("[auth/password]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/preferences
router.get("/preferences", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT notification_preferences FROM users WHERE id = $1",
      [req.user.id],
    );
    res.json(rows[0]?.notification_preferences ?? null);
  } catch (err) {
    console.error("[auth/preferences GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/auth/preferences
router.put("/preferences", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET notification_preferences = $1 WHERE id = $2 RETURNING notification_preferences",
      [JSON.stringify(req.body), req.user.id],
    );
    res.json(rows[0].notification_preferences);
  } catch (err) {
    console.error("[auth/preferences PUT]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── UI preferences (cross-device sync for tabs/views/filters) ──────────────
// Modules call PUT /api/auth/ui-preferences/<key> with the value, GET to read.
// Keys are arbitrary strings the client picks (e.g. 'dashboard.activeTab').
// Values must be JSON-serialisable; size guarded at 256KB to stop runaway blobs.

const UI_PREF_KEY_RE = /^[a-zA-Z][\w.\-]{0,63}$/;

router.get("/ui-preferences", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT ui_preferences FROM users WHERE id = $1",
      [req.user.id],
    );
    res.json(rows[0]?.ui_preferences ?? {});
  } catch (err) {
    console.error("[auth/ui-preferences GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/ui-preferences/:key", authMiddleware, async (req, res) => {
  const { key } = req.params;
  if (!UI_PREF_KEY_RE.test(key)) {
    return res
      .status(400)
      .json({ message: "Invalid key (alphanumeric, underscore, dot, hyphen; max 64 chars)" });
  }
  let serialized;
  try {
    serialized = JSON.stringify(req.body);
  } catch {
    return res.status(400).json({ message: "Value must be JSON-serialisable" });
  }
  if (serialized.length > 256 * 1024) {
    return res.status(413).json({ message: "Preference value too large (256KB max)" });
  }
  try {
    // jsonb_set patches a single key without overwriting unrelated module
    // preferences — important when two devices write different keys at once.
    const { rows } = await pool.query(
      `UPDATE users
          SET ui_preferences = jsonb_set(
            COALESCE(ui_preferences, '{}'::jsonb),
            ARRAY[$1]::text[],
            $2::jsonb,
            true
          )
        WHERE id = $3
        RETURNING ui_preferences`,
      [key, serialized, req.user.id],
    );
    res.json(rows[0]?.ui_preferences ?? {});
  } catch (err) {
    console.error("[auth/ui-preferences PUT]", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/ui-preferences/:key", authMiddleware, async (req, res) => {
  const { key } = req.params;
  if (!UI_PREF_KEY_RE.test(key)) {
    return res.status(400).json({ message: "Invalid key" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users
          SET ui_preferences = ui_preferences - $1
        WHERE id = $2
        RETURNING ui_preferences`,
      [key, req.user.id],
    );
    res.json(rows[0]?.ui_preferences ?? {});
  } catch (err) {
    console.error("[auth/ui-preferences DELETE]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/users
router.get("/users", authMiddleware, async (req, res) => {
  if (!["super_admin", "company_owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  try {
    const { clause, params } = buildTenantFilter(req, "WHERE");
    const query = `SELECT id,name,email,role,phone,avatar,organization_id,company_id,created_at FROM users${clause || ""} ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("[auth/users GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/users
router.post("/users", authMiddleware, async (req, res) => {
  if (!["super_admin", "company_owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  const validation = safeParse(createUserSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { name, email, password, role = "project_manager", phone } = validation.data;
  if (!VALID_ROLES.includes(role))
    return res
      .status(400)
      .json({
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      "INSERT INTO users (name,email,password_hash,role,phone,organization_id,company_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role,phone,organization_id,company_id,created_at",
      [
        name,
        email.toLowerCase().trim(),
        hash,
        role,
        phone || null,
        req.user.organization_id,
        req.user.company_id,
      ],
    );
    const newUser = rows[0];
    logAudit({
      auth: req.user,
      action: "create",
      entityType: "users",
      entityId: newUser.id,
      newData: { email: newUser.email, role: newUser.role, name: newUser.name },
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ message: "Email already in use" });
    console.error("[auth/users POST]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/auth/users/:id
router.delete("/users/:id", authMiddleware, async (req, res) => {
  if (!["super_admin", "company_owner"].includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  if (String(req.params.id) === String(req.user.id))
    return res.status(400).json({ message: "Cannot delete your own account" });

  try {
    const oldRows = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND company_id = $2",
      [req.params.id, req.user.company_id],
    );
    if (!oldRows.rowCount)
      return res.status(404).json({ message: "User not found" });
    await pool.query("DELETE FROM users WHERE id = $1 AND company_id = $2", [
      req.params.id,
      req.user.company_id,
    ]);
    logAudit({
      auth: req.user,
      action: "delete",
      entityType: "users",
      entityId: req.params.id,
      oldData: oldRows.rows[0],
    });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("[auth/users DELETE]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/auth/avatar
router.put("/avatar", authMiddleware, async (req, res) => {
  const validation = safeParse(avatarSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { avatar } = validation.data;
  try {
    const { rows } = await pool.query(
      "UPDATE users SET avatar=$1 WHERE id=$2 RETURNING id,name,email,role,phone,avatar",
      [avatar, req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("[auth/avatar]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/settings
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM app_settings WHERE user_id=$1",
      [req.user.id],
    );
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(settings);
  } catch (err) {
    console.error("[auth/settings GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

const VALID_SETTING_KEYS = [
  "notifications",
  "theme",
  "company",
  "language",
  "timezone",
  "dashboard",
  "alerts",
  "reports",
  "integrations",
  "security",
];

router.put("/settings", authMiddleware, async (req, res) => {
  const validation = safeParse(settingSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { key, value } = validation.data;
  if (!VALID_SETTING_KEYS.includes(key)) {
    return res
      .status(400)
      .json({
        message: `Invalid setting key. Allowed: ${VALID_SETTING_KEYS.join(", ")}`,
      });
  }
  try {
    await pool.query(
      `INSERT INTO app_settings (user_id, key, value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, key) DO UPDATE SET value=$3::jsonb, updated_at=now()`,
      [req.user.id, key, JSON.stringify(value)],
    );
    res.json({ key, value });
  } catch (err) {
    console.error("[auth/settings PUT]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/invite
router.post("/invite", authMiddleware, async (req, res) => {
  const validation = safeParse(inviteSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { email, role = "project_manager" } = validation.data;
  if (!VALID_ROLES.includes(role))
    return res
      .status(400)
      .json({
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });
  if (!["super_admin", "company_owner", "admin"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Insufficient permissions to invite users" });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    if (existingUser.rows.length) {
      return res
        .status(409)
        .json({ message: "A user with this email already exists" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO invitations (email, organization_id, company_id, role, token, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        email.toLowerCase().trim(),
        req.user.organization_id,
        req.user.company_id,
        role,
        token,
        expiresAt,
        req.user.id,
      ],
    );

    const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/invite/${token}`;

    if (process.env.NODE_ENV === "production") {
      console.log(`[INVITE] Sending invite email to ${email}: ${inviteLink}`);
    } else {
      console.log(`[INVITE] Dev invite link for ${email}: ${inviteLink}`);
    }

    res
      .status(201)
      .json({
        message: "Invitation sent",
        inviteLink:
          process.env.NODE_ENV !== "production" ? inviteLink : undefined,
      });
  } catch (err) {
    console.error("[auth/invite]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/invite/:token
router.get("/invite/:token", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, u.name as inviter_name
       FROM invitations i
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.token = $1`,
      [req.params.token],
    );
    if (!rows[0])
      return res.status(404).json({ message: "Invalid invitation" });
    const invite = rows[0];
    if (new Date(invite.expires_at) < new Date()) {
      await pool.query("DELETE FROM invitations WHERE id = $1", [invite.id]);
      return res.status(410).json({ message: "Invitation has expired" });
    }
    res.json({
      email: invite.email,
      role: invite.role,
      organizationId: invite.organization_id,
      inviterName: invite.inviter_name || "Unknown",
      expiresAt: invite.expires_at,
    });
  } catch (err) {
    console.error("[auth/invite GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/invite/accept
router.post("/invite/accept", async (req, res) => {
  const validation = safeParse(inviteAcceptSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.error });
  }
  const { token, name, password } = validation.data;

  try {
    const { rows } = await pool.query(
      "SELECT * FROM invitations WHERE token = $1",
      [token],
    );
    if (!rows[0])
      return res.status(404).json({ message: "Invalid invitation" });
    const invite = rows[0];

    if (new Date(invite.expires_at) < new Date()) {
      await pool.query("DELETE FROM invitations WHERE id = $1", [invite.id]);
      return res.status(410).json({ message: "Invitation has expired" });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [invite.email],
    );
    if (existingUser.rows.length) {
      await pool.query("DELETE FROM invitations WHERE id = $1", [invite.id]);
      return res.status(409).json({ message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows: newUserRows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, organization_id, company_id, created_at`,
      [
        name.trim(),
        invite.email,
        hash,
        invite.role,
        invite.organization_id,
        invite.company_id,
      ],
    );
    const newUser = newUserRows[0];

    await pool.query("DELETE FROM invitations WHERE id = $1", [invite.id]);

    const jwtToken = jwt.sign(
      {
        id: newUser.id,
        jti: crypto.randomUUID(),
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        organization_id: newUser.organization_id,
        company_id: newUser.company_id,
      },
      SECRET,
      { expiresIn: "7d" },
    );

    await createUserSession(newUser.id, jwtToken, req);

    setAuthTokenCookie(res, jwtToken);

    logAudit({
      auth: {
        userId: newUser.id,
        organization_id: newUser.organization_id,
        company_id: newUser.company_id,
      },
      action: "create",
      entityType: "users",
      entityId: newUser.id,
      newData: {
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        invited: true,
      },
    });

    const { password_hash, totp_secret, totp_enabled, ...safeUser } = newUser;
    res.status(201).json({ user: safeUser });
  } catch (err) {
    console.error("[auth/invite/accept]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/invitations
router.get("/invitations", authMiddleware, async (req, res) => {
  if (!["super_admin", "company_owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, expires_at, created_at,
              (SELECT name FROM users WHERE id = invitations.created_by) as inviter_name
       FROM invitations
       WHERE organization_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.organization_id],
    );
    res.json(rows);
  } catch (err) {
    console.error("[auth/invitations GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/auth/invitations/:id
router.delete("/invitations/:id", authMiddleware, async (req, res) => {
  if (!["super_admin", "company_owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM invitations WHERE id = $1 AND organization_id = $2",
      [req.params.id, req.user.organization_id],
    );
    if (!rowCount)
      return res.status(404).json({ message: "Invitation not found" });
    res.json({ message: "Invitation cancelled" });
  } catch (err) {
    console.error("[auth/invitations DELETE]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/sessions
router.get("/sessions", authMiddleware, async (req, res) => {
  try {
    const tokenHash = await hashToken(
      req.cookies?.token || req.headers.authorization?.split(" ")[1] || "",
    );
    const { rows } = await pool.query(
      `SELECT id, device_info, ip_address, last_active, created_at,
              (token_hash = $2) as is_current
       FROM user_sessions
       WHERE user_id = $1
       ORDER BY last_active DESC`,
      [req.user.id, tokenHash],
    );
    res.json(rows);
  } catch (err) {
    console.error("[auth/sessions GET]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/auth/sessions/:id
router.delete("/sessions/:id", authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM user_sessions WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (!rowCount)
      return res.status(404).json({ message: "Session not found" });
    res.json({ message: "Session revoked" });
  } catch (err) {
    console.error("[auth/sessions DELETE]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/auth/sessions
router.delete("/sessions", authMiddleware, async (req, res) => {
  try {
    const currentHash = await hashToken(
      req.cookies?.token || req.headers.authorization?.split(" ")[1] || "",
    );
    await pool.query(
      "DELETE FROM user_sessions WHERE user_id = $1 AND token_hash != $2",
      [req.user.id, currentHash],
    );
    res.json({ message: "All other sessions revoked" });
  } catch (err) {
    console.error("[auth/sessions DELETE ALL]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/reset-password/:id
router.post("/reset-password/:id", authMiddleware, resetPasswordLimiter, async (req, res) => {
  if (!["super_admin", "company_owner", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ message: "Cannot reset your own password here" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND company_id = $2",
      [req.params.id, req.user.company_id],
    );
    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hash = await bcrypt.hash(tempPassword, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hash,
      req.params.id,
    ]);

    logAudit({
      auth: req.user,
      action: "update",
      entityType: "users",
      entityId: req.params.id,
      newData: { password_reset: true },
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[RESET-PASSWORD] Temp password for ${rows[0].email}: ${tempPassword}`);
    }

    res.json({ message: `Password reset email sent to ${rows[0].email}` });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req, res) => {
  const { jti, exp } = req.user;
  const ttl = exp ? Math.max(exp - Math.floor(Date.now() / 1000), 60) : 3600;
  await blacklistToken(jti, ttl);

  const tokenHash = await hashToken(req.cookies?.token || "");
  await invalidateSessionByTokenHash(tokenHash);

  await revokeAllUserTokens(req.user.id);
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

module.exports = router;

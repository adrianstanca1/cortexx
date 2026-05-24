/**
 * server/routes/webhooks.js
 * Webhook CRUD + delivery system for external integrations.
 *
 * Events emitted:
 *   project.created, project.updated, project.deleted
 *   invoice.created, invoice.updated, invoice.paid, invoice.overdue
 *   rfi.created, rfi.updated, rfi.overdue
 *   safety.incident, safety.updated
 *   daily_report.created
 *   tender.created, tender.updated
 *   notification.created
 *   document.uploaded
 */
const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const authMw = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");
const https = require("https");
const http = require("http");

const router = express.Router();
router.use(authMw);

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min

// ─── Event registry ───────────────────────────────────────────────────────────
const ALL_EVENTS = new Set([
  "project.created",
  "project.updated",
  "project.deleted",
  "invoice.created",
  "invoice.updated",
  "invoice.paid",
  "invoice.overdue",
  "rfi.created",
  "rfi.updated",
  "rfi.overdue",
  "safety.incident",
  "safety.updated",
  "daily_report.created",
  "tender.created",
  "tender.updated",
  "notification.created",
  "document.uploaded",
  "team.member_added",
  "subcontractor.created",
  "subcontractor.updated",
  "drone_captures.created",
]);

// ─── HMAC signature helper ────────────────────────────────────────────────────
function signPayload(payload, secret) {
  if (!secret) return "";
  return (
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex")
  );
}

// ─── Deliver a webhook (async, fire-and-forget with retry) ───────────────────
async function deliverWebhook(webhook, event, payload) {
  const start = Date.now();
  const id = webhook.id;
  const url = webhook.url;
  const secret = webhook.secret;

  // Build request headers
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "CortexBuild-Webhook/1.0",
    "X-CortexBuild-Event": event,
    "X-CortexBuild-Delivery": id,
    ...(webhook.headers || {}),
  };

  // Add HMAC signature if secret is configured
  if (secret) {
    headers["X-CortexBuild-Signature"] = signPayload(payload, secret);
  }

  const body = JSON.stringify({
    event,
    delivered_at: new Date().toISOString(),
    data: payload,
  });

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        timeout: 15000,
      },
      (res) => {
        let responseBody = "";
        res.on("data", (c) => (responseBody += c));
        res.on("end", async () => {
          const duration = Date.now() - start;
          const success = res.statusCode >= 200 && res.statusCode < 300;

          // Log delivery
          try {
            await pool.query(
              `INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, response_body, response_time_ms, success)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                id,
                event,
                body,
                res.statusCode,
                responseBody.substring(0, 1000),
                duration,
                success,
              ],
            );
            await pool.query(
              `UPDATE webhooks SET last_triggered_at = NOW(), last_status_code = $2, last_error = NULL WHERE id = $1`,
              [id, res.statusCode],
            );
          } catch (logErr) {
            console.error("[Webhook] Failed to log delivery:", logErr.message);
          }

          if (!success && !res.statusCode) {
            // Network error — schedule retry
            scheduleRetry(webhook, event, payload, 0);
          }
          resolve({ statusCode: res.statusCode, duration, success });
        });
      },
    );

    req.on("error", async (err) => {
      const duration = Date.now() - start;
      console.warn(
        `[Webhook] Delivery failed for ${id} (${event}):`,
        err.message,
      );
      try {
        await pool.query(
          `INSERT INTO webhook_deliveries (webhook_id, event, payload, success, response_time_ms, last_error)
           VALUES ($1, $2, $3, false, $4, $5)`,
          [id, event, body, duration, err.message],
        );
        await pool.query(
          `UPDATE webhooks SET last_triggered_at = NOW(), last_status_code = NULL, last_error = $2 WHERE id = $1`,
          [id, err.message],
        );
      } catch (logErr) {
        console.error(
          "[Webhook] Failed to log delivery error:",
          logErr.message,
        );
      }
      scheduleRetry(webhook, event, payload, 0);
      resolve({ error: err.message, duration });
    });

    req.on("timeout", () => {
      req.destroy();
      console.warn(`[Webhook] Timeout for ${id} (${event})`);
      scheduleRetry(webhook, event, payload, 0);
      resolve({ error: "timeout", duration: Date.now() - start });
    });

    req.write(body);
    req.end();
  });
}

function scheduleRetry(webhook, event, payload, attempt) {
  if (attempt >= MAX_RETRIES) {
    console.warn(
      `[Webhook] Max retries reached for webhook ${webhook.id} (${event})`,
    );
    return;
  }
  const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  setTimeout(() => {
    scheduleRetryInternal(webhook, event, payload, delay);
  }, delay);
}

function scheduleRetryInternal(webhook, event, payload, delay) {
  pool
    .query(
      "SELECT id, url, secret, headers, active FROM webhooks WHERE id = $1 AND active = true",
      [webhook.id],
    )
    .then(({ rows }) => {
      if (rows.length) {
        deliverWebhook(rows[0], event, payload);
      }
    })
    .catch((err) => {
      console.error(
        `[Webhook] scheduleRetry failed for ${webhook.id}:`,
        err.message,
      );
    });
}

// ─── Emit an event (call this from mutation routes) ───────────────────────────
async function emitEvent(organizationId, companyId, event, payload) {
  if (!ALL_EVENTS.has(event)) return;

  try {
    const { rows: webhooks } = await pool.query(
      `SELECT id, url, secret, headers, active FROM webhooks
       WHERE active = true
         AND COALESCE(organization_id, company_id) = $1
         AND $2 = ANY(events)`,
      [organizationId || companyId, event],
    );

    // Fire all webhooks concurrently (non-blocking)
    webhooks.forEach((wh) => {
      // Fire and forget — don't await
      deliverWebhook(wh, event, payload).catch((deliverErr) => {
        console.error(
          "[Webhook] Delivery failed for",
          wh.url,
          ":",
          deliverErr.message,
        );
      });
    });
  } catch (err) {
    console.error("[Webhook] emitEvent error:", err.message);
  }
}

// ─── CRUD Routes ───────────────────────────────────────────────────────────────

/** GET /api/webhooks — list webhooks for org/company */
router.get("/", async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;
    const isSuper = req.user?.role === "super_admin";

    let query, params;
    if (isSuper) {
      query = `SELECT * FROM webhooks ORDER BY created_at DESC`;
    } else {
      query = `SELECT * FROM webhooks
               WHERE COALESCE(organization_id, company_id) = $1
               ORDER BY created_at DESC`;
      params = [orgId, companyId];
    }

    const { rows } = await pool.query(query, params || []);
    res.json({ data: rows });
  } catch (err) {
    console.error("[Webhooks GET]", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

/** POST /api/webhooks — create webhook */
router.post("/", checkPermission("settings", "create"), async (req, res) => {
  try {
    const {
      name,
      url,
      secret,
      events = [],
      headers = {},
      active = true,
    } = req.body;
    if (!name || !url)
      return res.status(400).json({ message: "name and url are required" });

    // Validate events
    const invalid = events.filter((e) => !ALL_EVENTS.has(e));
    if (invalid.length)
      return res
        .status(400)
        .json({ message: `Invalid events: ${invalid.join(", ")}` });

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: "Invalid URL" });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ message: "URL must be http or https" });
    }

    // SSRF protection: block internal/private IP ranges and localhost
    function isInternalHostname(hostname) {
      return (
        /^localhost$/i.test(hostname) ||
        /^127\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^169\.254\./.test(hostname) ||
        /^0\./.test(hostname) ||
        /^::1$/i.test(hostname) ||
        /^fc00:/i.test(hostname) ||
        /^fe80:/i.test(hostname)
      );
    }
    if (isInternalHostname(parsedUrl.hostname)) {
      return res
        .status(400)
        .json({
          message: "URL must not point to internal or private addresses",
        });
    }

    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;

    // Generate HMAC secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString("hex");

    const { rows } = await pool.query(
      `INSERT INTO webhooks (organization_id, company_id, name, url, secret, events, headers, active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId,
        companyId,
        name,
        url,
        webhookSecret,
        events,
        headers,
        active,
        req.user?.id,
      ],
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error("[Webhooks POST]", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

/** PUT /api/webhooks/:id — update webhook */
router.put("/:id", checkPermission("settings", "update"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, secret, events, headers, active } = req.body;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;

    if (events) {
      const invalid = events.filter((e) => !ALL_EVENTS.has(e));
      if (invalid.length)
        return res
          .status(400)
          .json({ message: `Invalid events: ${invalid.join(", ")}` });
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      params.push(name);
    }
    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL" });
      }
      updates.push(`url = $${paramIdx++}`);
      params.push(url);
    }
    if (secret !== undefined) {
      updates.push(`secret = $${paramIdx++}`);
      params.push(secret);
    }
    if (events !== undefined) {
      updates.push(`events = $${paramIdx++}`);
      params.push(events);
    }
    if (headers !== undefined) {
      updates.push(`headers = $${paramIdx++}`);
      params.push(headers);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIdx++}`);
      params.push(active);
    }
    updates.push(`updated_at = NOW()`);

    params.push(id, orgId, companyId);
    const { rows } = await pool.query(
      `UPDATE webhooks SET ${updates.join(", ")}
       WHERE id = $${paramIdx++} AND (organization_id = $${paramIdx++} OR (organization_id IS NULL AND company_id = $${paramIdx++}))
       RETURNING *`,
      params,
    );

    if (!rows.length)
      return res.status(404).json({ message: "Webhook not found" });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error("[Webhooks PUT]", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

/** DELETE /api/webhooks/:id — delete webhook */
router.delete(
  "/:id",
  checkPermission("settings", "delete"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const orgId = req.user?.organization_id;
      const companyId = req.user?.company_id;

      const { rows } = await pool.query(
        `DELETE FROM webhooks WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3)) RETURNING id`,
        [id, orgId, companyId],
      );
      if (!rows.length)
        return res.status(404).json({ message: "Webhook not found" });
      res.json({ message: "Webhook deleted" });
    } catch (err) {
      console.error("[Webhooks DELETE]", err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

/** GET /api/webhooks/:id/deliveries — delivery history */
router.get("/:id/deliveries", async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = "20" } = req.query;
    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;

    const { rows } = await pool.query(
      `SELECT wd.* FROM webhook_deliveries wd
       JOIN webhooks w ON w.id = wd.webhook_id
       WHERE wd.webhook_id = $1
         AND (w.organization_id = $2 OR (w.organization_id IS NULL AND w.company_id = $3))
       ORDER BY wd.attempted_at DESC
       LIMIT $4`,
      [id, orgId, companyId, parseInt(limit, 10)],
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("[Webhooks deliveries]", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

/** POST /api/webhooks/test — send a test event */
router.post("/test", async (req, res) => {
  try {
    const { webhookId } = req.body;
    if (!webhookId)
      return res.status(400).json({ message: "webhookId required" });

    const orgId = req.user?.organization_id;
    const companyId = req.user?.company_id;

    const { rows } = await pool.query(
      `SELECT * FROM webhooks WHERE id = $1 AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3))`,
      [webhookId, orgId, companyId],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Webhook not found" });

    const result = await deliverWebhook(rows[0], "test.ping", {
      message: "This is a test event from CortexBuild",
      timestamp: new Date().toISOString(),
    });
    res.json({ message: "Test event sent", result });
  } catch (err) {
    console.error("[Webhooks test]", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = { router, emitEvent };

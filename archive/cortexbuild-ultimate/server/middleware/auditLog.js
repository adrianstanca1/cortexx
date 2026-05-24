const { logAudit } = require("../routes/audit-helper");

/**
 * Auto-audit middleware — captures all mutating HTTP requests (POST, PUT, PATCH, DELETE)
 * after auth and logs them to the audit_log table. Fire-and-forget: does not block
 * response or crash on audit-write failure.
 *
 * Mounted after authMiddleware so req.user is guaranteed available.
 */
function auditLogMiddleware(req, res, next) {
  // Only intercept mutation methods
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const startedAt = Date.now();

  // Wrap res.json to capture response body
  const origJson = res.json.bind(res);
  let captured = null;
  res.json = function (body) {
    captured = body;
    return origJson(body);
  };

  res.on("finish", async () => {
    try {
      const actionMap = {
        POST: "create",
        PUT: "update",
        PATCH: "update",
        DELETE: "delete",
      };
      const action = actionMap[method];
      if (!action) return;

      // Extract entity type from first path segment after /api/
      const m = req.path.match(/^\/api\/([^/]+)/);
      const entityType = m ? m[1] : "unknown";
      const entityId = req.params?.id ||
        (captured && typeof captured === "object" ? captured.id : null) ||
        req.body?.id || null;

      const newData = method === "DELETE" || res.statusCode >= 400 ? null : (captured || null);
      const oldData = method === "DELETE" ? (req.body || null) : null;

      await logAudit({
        auth: req.user,
        action,
        entityType,
        entityId,
        newData,
        oldData,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
      });
    } catch (err) {
      // Never crash or block response because of audit failure
      console.error("[auditLog] Silent failure:", err?.message || err);
    }
  });

  next();
}

module.exports = auditLogMiddleware;

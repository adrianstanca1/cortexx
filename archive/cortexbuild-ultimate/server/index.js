require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const logger = require("./lib/logger");
// Global error handlers — prevent crashes from Redis or other async errors
process.on("unhandledRejection", (reason, promise) => {
  logger.error("[UnhandledRejection] Unhandled promise rejection:", reason);
  // Graceful shutdown — allow in-flight requests to complete
  setTimeout(() => {
    logger.error("[UnhandledRejection] Forcing exit after grace period");
    process.exit(1);
  }, 5000);
});
process.on("uncaughtException", (err) => {
  logger.error("[UncaughtException]", err);
  // Attempt graceful shutdown
  process.exit(1);
});
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const http = require("http");
const passport = require("passport");
const session = require("express-session");
const authMiddleware = require("./middleware/auth");
const { startBIMProcessor } = require("./workers/bimProcessor");
const { startAutoresearchWorker } = require("./workers/autoresearch-worker");
const {
  startAutoimproveScheduler,
} = require("./workers/autoimprove-scheduler");
const { startAutorepairMonitor } = require("./workers/autorepair-monitor");
const makeRouter = require("./routes/generic");
const authRoutes = require("./routes/auth");
const rateLimiter = require("./middleware/rateLimiter");
const requestLogger = require("./middleware/requestLogger");
const { initWebSocket } = require("./lib/websocket");
const { attachDocumentWS } = require("./routes/ws-documents");
const {
  requireFeature,
  isFeatureEnabled,
} = require("./middleware/featureFlag");
const rateLimit = require("express-rate-limit");
const { RedisStore: RateLimitRedisStore } = require("rate-limit-redis");
const cookieParser = require("cookie-parser");
const redis = require("redis");
const auditLogMiddleware = require("./middleware/auditLog");
const { RedisStore: RedisSessionStore } = require("connect-redis");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Redis client for rate limiting and distributed state (optional — skips if REDIS_URL is not set)
let redisClient = null;
let redisAvailable = false;

const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST || "localhost"}:6379` : null;

if (redisUrl) {
  redisClient = redis.createClient({ url: redisUrl });
  redisClient.on("error", (err) => {
    logger.error("[Redis] connection error:", err.message);
    redisAvailable = false;
  });
  redisClient.on("connect", () => {
    logger.info("[Redis] connected");
    redisAvailable = true;
  });
  redisClient.on("reconnecting", () => logger.info("[Redis] reconnecting..."));
  redisClient.on("ready", () => logger.info("[Redis] ready"));
  redisClient.on("end", () => {
    logger.info("[Redis] connection closed");
    redisAvailable = false;
  });
  redisClient.connect().catch((err) => {
    logger.error("[Redis] initial connection failed:", err.message);
    redisAvailable = false;
  });
} else {
  logger.info("[Redis] REDIS_URL not set — skipping Redis connection");
}

// Initialize WebSocket server (gated by feature flag — skips server creation when disabled)
initWebSocket(server, { enabled: isFeatureEnabled("FEATURE_WEBSOCKET") });

// Realtime collaborative document rooms (separate WS upgrade path /ws/documents/:id)
const docWSHandlers = isFeatureEnabled("FEATURE_WEBSOCKET")
  ? attachDocumentWS(server)
  : null;

// ─── Session & Passport middleware for OAuth ─────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (!sessionSecret) {
  logger.error(
    "[FATAL] SESSION_SECRET or JWT_SECRET environment variable must be set",
  );
  process.exit(1);
}
if (sessionSecret.length < 32) {
  logger.error(
    "[FATAL] SESSION_SECRET must be at least 32 characters for security",
  );
  process.exit(1);
}

// Session store — use Redis if available, otherwise MemoryStore for development
const sessionStore = redisAvailable
  ? new RedisSessionStore({ client: redisClient, prefix: "sess:" })
  : new session.MemoryStore();

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      // Lax: top-level returns from OAuth providers and normal cross-site navigations still send the cookie.
      // Strict breaks those flows because the browser treats them as cross-site GETs.
      sameSite: (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase(),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// ─── Security middleware ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── Middleware ───────────────────────────────────────────────────────────────
// CORS: only allow configured origins — never default to '*' in production
const corsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!corsOrigins.length) {
  if (process.env.NODE_ENV === "production") {
    logger.error(
      "[FATAL] CORS_ORIGIN must list at least one comma-separated browser origin in production",
    );
    process.exit(1);
  }
  logger.warn(
    "[CORS] CORS_ORIGIN not set — credentialed browser calls need localhost origins or set CORS_ORIGIN",
  );
}
const LOCAL_DEV_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/browserless requests (curl, health checks, server-to-server).
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      // Dev: allow browser calls from Vite (5173) or other local ports to API :3001 when
      // CORS_ORIGIN is unset or does not list every dev URL (common login failure).
      if (
        process.env.NODE_ENV !== "production" &&
        LOCAL_DEV_ORIGIN_RE.test(origin)
      ) {
        return callback(null, true);
      }
      if (!corsOrigins.length) return callback(null, false);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Debug-Session-Id",
      "X-Requested-With",
    ],
  }),
);
app.set("trust proxy", 1);

// Stripe webhook MUST be mounted before express.json so the handler can verify
// the signature against the raw request body. Express.raw() preserves it.
app.use(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  require("./routes/billing-webhook")(),
);

app.use(express.json({ limit: "10mb" }));
app.use(requestLogger); // Request logging with slow request detection
app.use(cookieParser());
app.use(rateLimiter);

// ─── Static file serving for uploads (directory listing disabled, auth required) ──────────────
app.use(
  "/uploads",
  authMiddleware,
  express.static(path.join(__dirname, "uploads"), {
    index: false,
    dotfiles: "ignore",
  }),
);

// ─── Public routes ────────────────────────────────────────────────────────────
app.use(require("./routes/metrics").observeRequest); // Prometheus HTTP request timing
app.use("/api/auth", authRoutes);
app.use("/api/auth", require("./routes/oauth")); // Google OAuth
// ─── Health check — verifies PostgreSQL and Redis connectivity ──────────────────
async function checkHealth() {
  const checks = { postgres: false, redis: false, status: "degraded" };
  try {
    const pool = require("./db");
    await pool.query("SELECT 1");
    checks.postgres = true;
  } catch (err) {
    logger.error("[Health] PostgreSQL check failed:", err.message);
    checks.postgres = false;
  }
  try {
    if (redisClient) {
      await redisClient.ping();
      checks.redis = true;
    } else {
      checks.redis = false;
    }
  } catch (err) {
    logger.error("[Health] Redis check failed:", err.message);
    checks.redis = false;
  }
  checks.status = checks.postgres && checks.redis ? "ok" : "degraded";
  return checks;
}

app.get("/api/health", async (_req, res) => {
  // Use a lightweight TCP probe for Redis to avoid blocking on reconnecting client
  const checks = { postgres: false, redis: false, status: "degraded" };
  try {
    const pool = require("./db");
    await pool.query("SELECT 1");
    checks.postgres = true;
  } catch (err) {
    logger.error("[Health] PostgreSQL check failed:", err.message);
    checks.postgres = false;
  }
  try {
    const net = require("net");
    const redisHost = (process.env.REDIS_URL || "").replace(/^redis:\/\//, "").split(":")[0] || "127.0.0.1";
    const redisPort = parseInt((process.env.REDIS_URL || "").split(":")[2], 10) || 6379;
    await new Promise((resolve, reject) => {
      const s = new net.Socket();
      s.setTimeout(2000);
      s.connect(redisPort, redisHost, () => {
        s.write("PING\r\n");
      });
      s.on("data", (d) => {
        if (d.toString().includes("PONG")) {
          s.end();
          resolve(true);
        }
      });
      s.on("error", reject);
      s.on("timeout", () => {
        s.destroy();
        reject(new Error("timeout"));
      });
    });
    checks.redis = true;
  } catch (_err) {
    // Redis optional — don’t block health if it’s down
    checks.redis = false;
  }
  checks.status = checks.postgres ? "ok" : "degraded";
  const statusCode = checks.status === "ok" ? 200 : 503;
  res
    .status(statusCode)
    .json({ status: checks.status, version: "1.0.0", checks });
});

// ─── Debug NDJSON sink (before /api auth) ─────────────────────────────────────
// Browser POSTs via same-origin `/api` (Vite proxy → :3001) so logs land in the repo.
// If your server `.env` sets NODE_ENV=production locally, set ENABLE_AGENT_DEBUG_API=1 to opt in.
const agentDebugApiEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_AGENT_DEBUG_API === "1";
if (agentDebugApiEnabled) {
  const AGENT_DEBUG_LOG = path.join(
    __dirname,
    "..",
    ".cursor",
    "debug-82d802.log",
  );
  const AGENT_DEBUG_MIRROR = path.join(
    __dirname,
    "..",
    "agent-debug-82d802.ndjson",
  );

  function tailNdjsonFile(filePath, maxLines = 120) {
    try {
      if (!fs.existsSync(filePath)) {
        return { exists: false, byteLength: 0, tailLines: [] };
      }
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.trim().split("\n").filter(Boolean);
      return {
        exists: true,
        byteLength: Buffer.byteLength(raw, "utf8"),
        lineCount: lines.length,
        tailLines: lines.slice(-maxLines),
      };
    } catch (e) {
      return {
        exists: false,
        byteLength: 0,
        tailLines: [],
        readError: String(e),
      };
    }
  }

  // Require auth on debug endpoints — they expose internal log data and allow
  // arbitrary file writes. In production they are already gated by
  // ENABLE_AGENT_DEBUG_API, but auth prevents abuse even when enabled.
  app.get("/api/agent-debug", authMiddleware, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      primaryPath: AGENT_DEBUG_LOG,
      mirrorPath: AGENT_DEBUG_MIRROR,
      primary: tailNdjsonFile(AGENT_DEBUG_LOG),
      mirror: tailNdjsonFile(AGENT_DEBUG_MIRROR),
    });
  });

  app.post("/api/agent-debug", authMiddleware, (req, res) => {
    try {
      const line = JSON.stringify(req.body ?? {});
      JSON.parse(line);
      fs.mkdirSync(path.dirname(AGENT_DEBUG_LOG), { recursive: true });
      fs.appendFileSync(AGENT_DEBUG_LOG, `${line}\n`);
      fs.appendFileSync(AGENT_DEBUG_MIRROR, `${line}\n`);
      res.status(204).end();
    } catch (e) {
      logger.error("[Agent Debug] Write failed:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  logger.info("[agent-debug] POST/GET /api/agent-debug →", AGENT_DEBUG_LOG);
}

// Rate-limited deploy route (5 requests per hour, Redis-backed if available, otherwise memory)
const deployLimiterStore = redisAvailable
  ? new RateLimitRedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: "rl:deploy:",
    })
  : undefined; // undefined = memory store (default)

const deployLimiter = rateLimit({
  store: deployLimiterStore,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: "Too many deploy attempts, try again later" },
});
app.use("/api/deploy", deployLimiter, require("./routes/deploy"));

// ─── JWT auth on all other /api routes ───────────────────────────────────────

// ─── Metrics endpoint (no auth required for Prometheus scraping) ─────────────
app.use("/api/metrics", require("./routes/metrics").router);

// ─── Public billing plans endpoint (before auth) ──────────────────────────────
const plansRouter = require("express").Router();
const { getAllPlans } = require("./lib/billing/plans");
plansRouter.get("/plans", (req, res) => {
  try {
    const plans = getAllPlans();
    const sanitized = plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceId: p.priceId,
      features: p.features,
    }));
    res.json({ plans: sanitized });
  } catch (err) {
    logger.error("[billing/plans]", err.message);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});
app.use("/api/billing", plansRouter);

app.use("/api", authMiddleware);
app.use("/api", auditLogMiddleware); // Auto-record all mutations after auth

// ─── Protected routes ────────────────────────────────────────────────────────

// ─── Routes requiring authentication ─────────────────────────────────────────
app.use("/api/company", require("./routes/company"));

// ─── Upload route ─────────────────────────────────────────────────────────────
app.use(
  "/api/upload",
  requireFeature("FEATURE_FILE_UPLOAD"),
  require("./routes/upload"),
);
app.use(
  "/api/files",
  requireFeature("FEATURE_FILE_UPLOAD"),
  require("./routes/files"),
);
app.use(
  "/api/project-images",
  requireFeature("FEATURE_FILE_UPLOAD"),
  require("./routes/project-images"),
);
app.use("/api/project-tasks", require("./routes/project-tasks"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/subtasks", require("./routes/subtasks"));
app.use("/api/task-dependencies", require("./routes/task-dependencies"));
app.use("/api/task-templates", require("./routes/task-templates"));
app.use("/api/recurring-tasks", require("./routes/recurring-tasks"));
app.use("/api/work-packages", require("./routes/work-packages"));

// ─── AI routes ────────────────────────────────────────────────────────────────
app.use("/api/ai", requireFeature("FEATURE_AI_AGENTS"), require("./routes/ai"));
// Autonomous surfaces share the same kill-switch as interactive AI agents.
app.use(
  "/api/autoresearch",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/autoresearch"),
);
app.use(
  "/api/autoimprove",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/autoimprove"),
);
app.use(
  "/api/autorepair",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/autorepair"),
);
app.use(
  "/api/workflows",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/workflows"),
);

app.use(
  "/api/ai-conversations",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/ai-conversations"),
);
app.use(
  "/api/ai-predictive",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/ai-predictive"),
);

// ─── Protected billing routes (subscription, checkout, portal) ────────────────
// GET /api/billing/plans is public and mounted before authMiddleware above
app.use("/api/billing", require("./routes/billing"));

// ─── CRUD routes ─────────────────────────────────────────────────────────────
app.use("/api/projects", makeRouter("projects"));
app.use("/api/invoices", makeRouter("invoices"));
app.use("/api/safety", makeRouter("safety_incidents"));
app.use("/api/rfis", makeRouter("rfis"));
app.use("/api/change-orders", makeRouter("change_orders"));
app.use("/api/team", makeRouter("team_members"));
app.use("/api/equipment", makeRouter("equipment"));
app.use("/api/subcontractors", makeRouter("subcontractors"));
app.use("/api/documents", makeRouter("documents"));
app.use("/api/timesheets", makeRouter("timesheets"));
app.use("/api/meetings", makeRouter("meetings"));
app.use("/api/materials", makeRouter("materials"));
app.use("/api/punch-list", makeRouter("punch_list"));
app.use("/api/inspections", makeRouter("inspections"));
app.use("/api/rams", makeRouter("rams"));
// NOTE: /api/submittals is handled by dedicated router below (line ~555)
// app.use("/api/submittals", makeRouter("submittals"));
app.use("/api/cis", makeRouter("cis_returns"));
app.use("/api/tenders/ai", require("./routes/tender-ai"));
app.use("/api/tenders", makeRouter("tenders"));
app.use("/api/contacts", makeRouter("contacts"));
app.use("/api/risk-register", makeRouter("risk_register"));
app.use("/api/purchase-orders", makeRouter("purchase_orders"));
app.use("/api/daily-reports", makeRouter("daily_reports"));
app.use("/api/reports", require("./routes/daily-reports-summary"));

// New construction module routes
app.use("/api/variations", makeRouter("variations"));
app.use("/api/defects", makeRouter("defects"));
app.use("/api/specifications", makeRouter("specifications"));
app.use("/api/temp-works", makeRouter("temp_works"));
app.use("/api/signage", require("./routes/signage"));
app.use("/api/waste-management", makeRouter("waste_management"));
app.use("/api/sustainability", makeRouter("sustainability"));
app.use("/api/training", makeRouter("training"));
app.use("/api/certifications", makeRouter("certifications"));
app.use("/api/prequalification", makeRouter("prequalification"));
app.use("/api/lettings", require("./routes/lettings"));
app.use('/api/measuring', require('./routes/measuring'));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/push", require("./routes/push")());
app.use("/api/team-member-data", require("./routes/team-member-data"));
app.use("/api/site-permits", makeRouter("site_permits"));
app.use("/api/safety-permits", makeRouter("safety_permits"));
app.use("/api/permit-renewals", makeRouter("permit_renewals"));
app.use("/api/permit-inspections", makeRouter("permit_inspections"));
app.use("/api/equipment", makeRouter("equipment"));
app.use("/api/project-templates", makeRouter("project_templates"));
app.use("/api/maintenance-schedules", makeRouter("maintenance_schedules"));
app.use("/api/equipment-hire-logs", makeRouter("equipment_hire_logs"));
app.use("/api/equipment-service-logs", makeRouter("equipment_service_logs"));
app.use("/api/risk-mitigation-actions", makeRouter("risk_mitigation_actions"));
app.use("/api/contact-interactions", makeRouter("contact_interactions"));
app.use("/api/api-keys", require("./routes/api-keys"));
app.use("/api/toolbox-talks", makeRouter("toolbox_talks"));
app.use("/api/drawing-transmittals", makeRouter("drawing_transmittals"));
app.use("/api/site-inspections", makeRouter("site_inspections"));
app.use("/api/analytics-data", require("./routes/analytics-data"));
app.use("/api/dashboard-data", require("./routes/dashboard-data"));
app.use("/api/financial-reports", require("./routes/financial-reports"));
app.use("/api/executive-reports", require("./routes/executive-reports"));
app.use("/api/search", require("./routes/search"));
app.use("/api/audit", require("./routes/audit"));
app.use("/api/calendar", require("./routes/calendar"));
app.use(
  "/api/email",
  requireFeature("FEATURE_EMAIL"),
  require("./routes/email"),
);
app.use("/api/insights", require("./routes/insights"));
app.use("/api/weather-forecast", require("./routes/weather-data"));
app.use("/api/backup", require("./routes/backup"));
app.use("/api/report-templates", require("./routes/report-templates"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api", require("./routes/permits"));
app.use(
  "/api/rag",
  requireFeature("FEATURE_RAG_SEARCH"),
  require("./routes/rag"),
);
app.use(
  "/api/rag-chat",
  requireFeature("FEATURE_RAG_SEARCH"),
  require("./routes/ai-rag"),
);
app.use("/api/bim-models", require("./routes/bim-models"));
app.use("/api/cost-management", require("./routes/cost-management"));
app.use("/api/submittals", require("./routes/submittals"));
app.use("/api/suppliers", require("./routes/suppliers"));
app.use("/api/webhooks", require("./routes/webhooks").router);
app.use("/api/signatures", require("./routes/signatures"));
app.use("/api/carbon", require("./routes/carbon"));
app.use("/api/bim4d", require("./routes/bim4d"));
app.use("/api/portal", require("./routes/client-portal"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/activity-feed", require("./routes/activity-feed"));
app.use("/api/admin/stats", require("./routes/admin-stats"));
app.use(
  "/api/ai-vision",
  requireFeature("FEATURE_AI_AGENTS"),
  require("./routes/ai-vision"),
);
app.use("/api/ai_vision_logs", makeRouter("ai_vision_logs"));
app.use("/api/project-phases", makeRouter("project_phases"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/mobile", require("./routes/mobile-summary"));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error("[UnhandledError]", err.message || err);
  res.status(500).json({ message: "Internal server error" });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));


// ─── Graceful shutdown — drain connections before exiting ───────────────────────────
function gracefulShutdown(signal) {
  logger.info(`\n[${signal}] Graceful shutdown initiated...`);
  if (docWSHandlers) {
    try { docWSHandlers.cleanup(); } catch (e) { logger.error("[ws-documents] cleanup error:", e.message); }
  }
  server.close(async () => {
    logger.info("[HTTP] Server closed");
    try {
      const pool = require("./db");
      await pool.end();
      logger.info("[PostgreSQL] Pool closed");
    } catch (e) {
      logger.error("[PostgreSQL] Error closing pool:", e.message);
    }
    try {
      if (redisAvailable && redisClient) {
        await redisClient.quit();
        logger.info("[Redis] Client closed");
      }
    } catch (e) {
      logger.error("[Redis] Error closing client:", e.message);
    }
    logger.info("[Shutdown] Complete");
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error("[Shutdown] Timeout — forcing exit");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Start ────────────────────────────────────────────────────────────────────
// ─── Start Background Workers ──────────────────────────────────────────────────
startBIMProcessor();
startAutoresearchWorker();
startAutoimproveScheduler();
startAutorepairMonitor();

server.listen(PORT, () => {
  logger.info(`\n🏗  CortexBuild API running on port ${PORT}`);
  logger.info(`   Health: http://localhost:${PORT}/api/health`);
  logger.info(`   WebSocket: ws://localhost:${PORT}/ws\n`);
});

module.exports = app; // Export app for testing

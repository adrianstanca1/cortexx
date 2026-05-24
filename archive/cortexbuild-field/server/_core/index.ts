import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerBootstrapRoute } from "./bootstrap";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { scheduleCredentialExpiryJob } from "../credentialExpiryJob";
import { checkDatabaseReady, getDb } from "../db";
import { getPushErrorMetricsSnapshot } from "./push-error-counter";
import { checkRedisReady } from "./redis";
import { checkMinioReady } from "../storage";
import { checkIns as dbCheckIns } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "./logger";

// Read the build marker that the deploy workflow stamps into dist/. Lets
// /api/version surface the commit SHA actually running so we can tell from
// outside the VPS whether PM2 is on the latest release.
function normalizeCommitSha(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s === "unknown") return null;
  if (/^[0-9a-f]{7,40}$/i.test(s)) return s;
  return null;
}

function readBuildInfo(): { sha: string; builtAt: string | null } {
  let builtAt: string | null = null;
  let shaFromFile: string | null = null;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const buildInfoPath = join(here, "build-info.json");
    const raw = readFileSync(buildInfoPath, "utf8");
    const parsed = JSON.parse(raw) as { sha?: unknown; builtAt?: unknown };
    builtAt = typeof parsed.builtAt === "string" ? parsed.builtAt : null;
    shaFromFile = normalizeCommitSha(parsed.sha);
  } catch {
    // dist/build-info.json missing or invalid — fall through to env
  }
  const shaFromEnv =
    normalizeCommitSha(process.env.DEPLOY_COMMIT_SHA) ??
    normalizeCommitSha(process.env.GITHUB_SHA);
  const sha = shaFromFile ?? shaFromEnv ?? "unknown";
  return { sha, builtAt };
}
const BUILD_INFO = readBuildInfo();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // jose's HS256 signer (used by sdk.createSessionToken) crashes on every
  // login with "Zero-length key is not supported" when JWT_SECRET is empty.
  // Surface the misconfiguration at boot so it's visible in pm2 logs the
  // first time someone restarts the service, instead of as a sanitized
  // INTERNAL_SERVER_ERROR on the first login attempt.
  if (!process.env.JWT_SECRET) {
    log.error(
      "[startup] JWT_SECRET is not set — auth.login will return 500 because " +
        "session-token signing requires a non-empty key. Configure JWT_SECRET in the deploy env or .env file.",
    );
    // In production, refuse to start at all. Accepting traffic with broken
    // auth would silently hand every login a 500, possibly masked by the
    // sanitized error formatter. Exit non-zero so PM2 surfaces the failure
    // and the deploy pipeline marks the rollout as failed instead of
    // proceeding to pm2 reload with a broken process.
    if (process.env.NODE_ENV === "production") {
      log.error(
        "[startup] Refusing to start in production without JWT_SECRET.",
      );
      process.exit(1);
    }
  }

  const app = express();
  const server = createServer(app);

  // Trust the immediate reverse proxy (Nginx) so `req.ip` and
  // `req.ips` reflect the real client address from `X-Forwarded-For`
  // instead of the loopback that Nginx connects from. Without this,
  // every rate limiter keyed off `req.ip` (e.g. `bootstrapLimiter` in
  // `_core/bootstrap.ts`) collapses into a single global bucket shared
  // by every client, which is functionally no rate limiting at all.
  // `1` = trust the FIRST hop only — safer than `true` (trust all),
  // which would let a hostile client forge X-Forwarded-For from
  // outside the VPS network. The deployment runs PM2 → Nginx; if
  // additional intermediaries (CDN, ELB) are ever added, bump this.
  app.set("trust proxy", 1);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerBootstrapRoute(app);

  app.get("/api/health", async (_req, res) => {
    const [database, redis, minio] = await Promise.all([
      checkDatabaseReady(),
      checkRedisReady(),
      checkMinioReady(),
    ]);
    const checks = { postgres: database.ok, redis: redis.ok, minio: minio.ok };
    const ok = checks.postgres && checks.redis;
    res.status(ok ? 200 : 503).json({
      ok,
      status: ok ? "ok" : "degraded",
      checks,
      sha: BUILD_INFO.sha,
      timestamp: Date.now(),
    });
  });

  // /api/version exposes which commit the running bundle was built from. Used
  // by the deploy workflow's health check to confirm PM2 actually picked up
  // the new release — a stale bundle is otherwise invisible from outside.
  app.get("/api/version", (_req, res) => {
    res.json({ sha: BUILD_INFO.sha, builtAt: BUILD_INFO.builtAt });
  });

  // /api/metrics exposes the in-process push-error counter (server/_core/
  // push-error-counter.ts). Read-only JSON; intended to be scraped by ops
  // tooling. Per-bucket recent counts + cooldown state lets ops grep for
  // ongoing incidents without parsing PM2 logs.
  app.get("/api/metrics", (_req, res) => {
    res.json({
      pushErrors: getPushErrorMetricsSnapshot(),
      timestamp: Date.now(),
    });
  });

  app.get("/api/ready", async (_req, res) => {
    const database = await checkDatabaseReady();
    const ok = database.ok || process.env.REQUIRE_DATABASE !== "true";
    res.status(ok ? 200 : 503).json({
      ok,
      database,
      timestamp: Date.now(),
    });
  });

  app.post("/api/horus/ping", async (req, res) => {
    const pings = Array.isArray(req.body?.pings) ? req.body.pings : [];
    if (pings.length === 0) {
      res.status(400).json({ success: false, error: "No pings provided" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({ success: false, error: "Database unavailable" });
      return;
    }

    let updated = 0;
    for (const ping of pings) {
      const id = Number(String(ping.checkInId ?? "").replace(/^ci_/, ""));
      if (!Number.isFinite(id)) continue;
      const latitude = Number(ping.latitude);
      const longitude = Number(ping.longitude);
      const result = await db
        .update(dbCheckIns)
        .set({
          checkOutLat: Number.isFinite(latitude) ? String(latitude) : undefined,
          checkOutLng: Number.isFinite(longitude)
            ? String(longitude)
            : undefined,
        })
        .where(eq(dbCheckIns.id, id));
      if ((result as { rowCount?: number }).rowCount !== 0) updated++;
    }

    res.json({ success: true, received: pings.length, updated });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    log.info(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    log.info(`[api] server listening on port ${port}`);
  });

  // Start daily credential expiry alert job
  scheduleCredentialExpiryJob();
}

startServer().catch((err: unknown) => log.error(err));

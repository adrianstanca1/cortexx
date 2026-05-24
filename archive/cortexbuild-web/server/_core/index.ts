import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { parseWebhookPayload } from "../services/whatsappClient";
import { processIncomingMessage } from "../services/webhookProcessor";
import { processInboxMessage } from "../services/inboxProcessor";
import { runDueScheduledReports } from "../services/scheduledReports";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { messageBus } from "./messageBus";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { getMessagesByConversation } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
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
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── WhatsApp Webhook ──────────────────────────────────────────────────────

  /**
   * GET /api/webhook/whatsapp
   * WhatsApp webhook verification endpoint.
   * Meta sends a GET request with hub.challenge to verify the endpoint.
   */
  app.get("/api/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "cortexbuild_verify_token";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[WhatsApp] Webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      console.warn("[WhatsApp] Webhook verification failed — token mismatch");
      res.status(403).json({ error: "Verification failed" });
    }
  });

  /**
   * POST /api/webhook/whatsapp
   * Receives incoming WhatsApp messages and media.
   * Processes each message through the full AI pipeline asynchronously.
   */
  app.post("/api/webhook/whatsapp", (req, res) => {
    // Respond immediately with 200 to acknowledge receipt (required by Meta)
    res.status(200).json({ status: "received" });

    // Process messages asynchronously
    const messages = parseWebhookPayload(req.body);
    for (const msg of messages) {
      processIncomingMessage(msg).catch((err) =>
        console.error("[Webhook] Message processing error:", err)
      );
    }
  });

  // ─── In-App File Upload ───────────────────────────────────────────────────
  // Accepts multipart image/file uploads from the dashboard inbox.
  // Stores to S3 and returns the public URL for use in the inbox pipeline.

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const ext = req.file.originalname.split(".").pop() ?? "bin";
      const s3Key = `inbox-uploads/${nanoid(12)}.${ext}`;
      const { url } = await storagePut(s3Key, req.file.buffer, req.file.mimetype);
      res.json({ url, s3Key, mimeType: req.file.mimetype, originalName: req.file.originalname });
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // ─── OAuth & tRPC ──────────────────────────────────────────────────────────

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "1.0.0", service: "cortexbuild-web" });
  });

  // ─── SSE: Real-time messages for a conversation ───────────────────────────────

  app.get("/api/sse/messages", async (req, res) => {
    // Authenticate via session cookie
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const sessionCookie = cookies[COOKIE_NAME];
    const session = await sdk.verifySession(sessionCookie);
    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const conversationId = parseInt(req.query.conversationId as string, 10);
    if (!conversationId || Number.isNaN(conversationId)) {
      res.status(400).json({ error: "Missing or invalid conversationId" });
      return;
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders?.();

    // Send initial connected ping
    res.write(`event: connected\ndata: ${JSON.stringify({ conversationId })}\n\n`);

    const listener = (msg: any) => {
      if (msg.conversationId === conversationId) {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    };

    messageBus.on("message", listener);

    // Heartbeat to keep connection alive every 30s
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      messageBus.off("message", listener);
      res.end();
    });

    req.on("error", () => {
      clearInterval(heartbeat);
      messageBus.off("message", listener);
      res.end();
    });
  });

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── Static / Vite ────────────────────────────────────────────────────────

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ─── Scheduled Reports (runs every hour) ──────────────────────────────────

  setInterval(() => {
    runDueScheduledReports().catch((err) =>
      console.error("[ScheduledReports] Runner error:", err)
    );
  }, 60 * 60 * 1000); // every 60 minutes

  // Run once on startup to catch any missed schedules
  setTimeout(() => {
    runDueScheduledReports().catch(console.error);
  }, 10_000);

  // ─── Start Server ──────────────────────────────────────────────────────────

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WhatsApp Webhook: http://localhost:${port}/api/webhook/whatsapp`);
  });
}

startServer().catch(console.error);

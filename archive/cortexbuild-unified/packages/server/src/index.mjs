import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { initTRPC } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ZodError } from "zod";
import superjson from "superjson";

const app = express();
const PORT = Number(process.env.PORT) || 3333;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString(), service: "cortexbuild-unified" }));

// ── tRPC
const t = initTRPC.context().create({
  transformer: superjson,
  errorFormatter({ shape, error }) { return { ...shape, message: error.message, zodError: error.cause instanceof ZodError ? error.cause.flatten() : null }; }
});
const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  auth: router({
    me: publicProcedure.query(() => ({ user: null })),
    login: publicProcedure.query(() => ({ token: "" })),
    register: publicProcedure.query(() => ({ token: "" })),
  }),
  project: router({
    list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })),
    getById: publicProcedure.query(() => null),
    create: publicProcedure.mutation(() => ({ id:1 })),
  }),
  task: router({
    list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })),
    create: publicProcedure.mutation(() => ({ id:1 })),
    update: publicProcedure.mutation(() => ({ id:1 })),
  }),
  defect: router({
    list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })),
    create: publicProcedure.mutation(() => ({ id:1 })),
  }),
  inspection: router({
    list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })),
    create: publicProcedure.mutation(() => ({ id:1 })),
  }),
  file: router({
    list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })),
    create: publicProcedure.mutation(() => ({ id:1 })),
  }),
  rfi: router({ list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })), }),
  dailyReport: router({ list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })), }),
  incident: router({ list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })), }),
  permit: router({ list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })), }),
  timesheet: router({ list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })), }),
  dashboard: router({
    stats: publicProcedure.query(() => ({
      activeProjects:0, openTasks:0, openDefects:0, openIncidents:0,
      totalProjects:0, pendingRfis:0, pendingApprovals:0,
      totalBudget:0, totalSpent:0, totalRevenue:0, workersOnSite:0, overdueItems:0
    })),
  }),
  notification: router({
    list: publicProcedure.query(() => ({ data: [], pagination: { page:1, perPage:20, total:0, totalPages:0 } })),
    unreadCount: publicProcedure.query(() => 0),
  }),
});

app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext: () => ({}) }));
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(err.status || 500).json({ error: err.message || "Internal server error" }); });

app.listen(PORT, () => console.log(`🚀 CortexBuild Unified API on :${PORT}`));

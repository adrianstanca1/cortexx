import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { sql } from "./db.mjs";

const app = express();
const PORT = Number(process.env.PORT) || 3333;
// Bind to loopback by default — the REST surface has no auth and
// shouldn't be reachable from the public internet. Set HOST=0.0.0.0
// explicitly only when fronting with nginx that enforces auth.
const HOST = process.env.HOST || '127.0.0.1';

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", async (_req, res) => {
  try { await sql`SELECT 1`; res.json({ status: "ok", db: true, ts: new Date().toISOString() }); }
  catch (e) { res.status(500).json({ status: "error", db: false, error: e.message }); }
});

const safeQuery = async (queryFn, fallback) => { try { return await queryFn(); } catch (e) { console.warn("SQL warn:", e.message?.slice(0,120)); return fallback; } };

const listHandler = (table) => async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 20));
  const cId = req.query.companyId;
  const data = await safeQuery(async () => {
    const where = cId ? sql`company_id = ${cId}` : sql`true`;
    const [{ count: total }] = await sql`SELECT COUNT(*)::int as count FROM ${sql(table)} WHERE ${where}`;
    const rows = await sql`SELECT * FROM ${sql(table)} WHERE ${where} ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${(page-1)*perPage}`;
    return { data: rows, pagination: { page, perPage, total: Number(total), totalPages: Math.ceil(Number(total)/perPage) } };
  }, { data: [], pagination: { page, perPage, total: 0, totalPages: 0 }, error: null });
  res.json(data);
};

const tables = ['projects','tasks','defects','inspections','rfis','incidents','permits','daily_reports','timesheets','check_ins','materials','equipment','drawings','files','meetings','invoices','purchase_orders','budgets','cost_forecasts','change_orders','submittals','punch_items','risk_register','certifications','tenders','delay_notes','notifications','activity_feed','subscriptions','ai_conversations','ai_messages','webhooks','bim_models','weather_logs','contacts','quotes','documents'];
for (const t of tables) {
  app.get(`/api/${t.replace(/_/g,'-')}`, listHandler(t));
  app.get(`/api/${t.replace(/_/g,'-')}/:id`, async (req, res) => {
    const row = await safeQuery(async () => {
      const [r] = await sql`SELECT * FROM ${sql(t)} WHERE id = ${req.params.id} LIMIT 1`;
      return r;
    }, null);
    res.json(row);
  });
  app.post(`/api/${t.replace(/_/g,'-')}`, async (req, res) => {
    const row = await safeQuery(async () => {
      const keys = Object.keys(req.body);
      if (!keys.length) throw new Error("No data");
      const cols = sql(keys.join(','));
      const vals = keys.map(k => req.body[k]);
      const [r] = await sql`INSERT INTO ${sql(t)} (${cols}) VALUES ${sql(vals)} RETURNING *`;
      return r;
    }, null);
    if (!row) return res.status(400).json({ error: "Insert failed" });
    res.status(201).json(row);
  });
}

app.get("/api/users", async (_req, res) => res.json({ data: await safeQuery(() => sql`SELECT id,email,name,role,company_id,created_at FROM users`, []) }));
app.get("/api/companies", async (_req, res) => res.json({ data: await safeQuery(() => sql`SELECT * FROM companies`, []) }));
app.get("/api/dashboard/stats", async (_req, res) => {
  const proj = await safeQuery(async () => (await sql`SELECT COUNT(*)::int as c FROM projects`)[0].c, 0);
  const tsk = await safeQuery(async () => (await sql`SELECT COUNT(*)::int as c FROM tasks WHERE status != 'completed'`)[0].c, 0);
  const def = await safeQuery(async () => (await sql`SELECT COUNT(*)::int as c FROM defects WHERE status = 'open'`)[0].c, 0);
  const inc = await safeQuery(async () => (await sql`SELECT COUNT(*)::int as c FROM incidents WHERE status = 'open'`)[0].c, 0);
  res.json({ activeProjects: proj, openTasks: tsk, openDefects: def, openIncidents: inc, totalProjects: proj, pendingRfis: 0, pendingApprovals: 0, totalBudget: 0, totalSpent: 0, totalRevenue: 0, workersOnSite: 0, overdueItems: 0 });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: err.message }); });

app.listen(PORT, HOST, () => console.log(`🚀 CortexBuild Unified API on ${HOST}:${PORT}`));

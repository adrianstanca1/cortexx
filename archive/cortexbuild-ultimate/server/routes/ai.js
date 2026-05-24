const express = require("express");
const path = require("path");
const fs = require("fs");
const pool = require("../db");
const https = require("https");
const http = require("http");
const auth = require("../middleware/auth");
const { buildTenantFilter } = require("../middleware/tenantFilter");
const { extractReadableTextFromDocument } = require("../lib/document-text-extract");
const rateLimit = require("express-rate-limit");
const {
  broadcastDashboardUpdate,
  broadcastNotification,
} = require("../lib/ws-broadcast");

// Import modular intent handlers
const { handleProjects } = require("./ai-intents/projects-intent");
const {
  handleInvoices,
  handleOverdue,
} = require("./ai-intents/invoices-intent");
const { handleSafety } = require("./ai-intents/safety-intent");
const { handleTeam } = require("./ai-intents/team-intent");
const { handleRfis } = require("./ai-intents/rfis-intent");
const { handleTenders } = require("./ai-intents/tenders-intent");
const { handleBudget } = require("./ai-intents/budget-intent");
const { handleValuations } = require("./ai-intents/valuations-intent");
const { handleDefects } = require("./ai-intents/defects-intent");
const { handleMaterials } = require("./ai-intents/materials-intent");
const { handleTimesheets } = require("./ai-intents/timesheets-intent");
const { handleSubcontractors } = require("./ai-intents/subcontractors-intent");
const { handleEquipment } = require("./ai-intents/equipment-intent");
const { handleChangeOrders } = require("./ai-intents/change-orders-intent");
const { handlePurchaseOrders } = require("./ai-intents/purchase-orders-intent");
const { handleContacts } = require("./ai-intents/contacts-intent");
const { handleRams } = require("./ai-intents/rams-intent");
const { handleCIS } = require("./ai-intents/cis-intent");
const { handleDailyReports } = require("./ai-intents/daily-reports-intent");
const { handleRisk } = require("./ai-intents/risk-intent");
const { handleGenerateReport } = require("./ai-intents/report-generator");
const { handleAutoresearch } = require("./ai-intents/autoresearch-intent");
const { handleAutoimprove } = require("./ai-intents/autoimprove-intent");
const { handleAutorepair } = require("./ai-intents/autorepair-intent");
const {
  classify,
  shouldUseOllama,
} = require("./ai-intents/ai-intent-classifier");
const {
  getConversationHistory,
  truncateToTokenBudget,
  MAX_CONTEXT_MESSAGES,
  SUMMARY_THRESHOLD,
} = require("./ai-intents/conversation-history");
const {
  getOllamaResponse,
  summarizeText,
  OLLAMA_HOST,
  LLM_MODEL,
} = require("./ai-intents/ollama-client");
const {
  agenticQuery,
  streamAgenticQuery,
  smartQuery,
} = require("../lib/unified-ai-client-v2");
const { AGENT_DEFINITIONS } = require("../lib/agents/agent-orchestrator");

const router = express.Router();

// Rate limiters for AI endpoints
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    message: "Too many AI requests, please wait a moment before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiExecuteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 execute requests per minute (write actions)
  message: {
    message: "Too many AI actions, please wait a moment before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiSummarizeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 summarize requests per minute
  message: {
    message:
      "Too many summary requests, please wait a moment before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(auth);

// ─── Ollama health check ──────────────────────────────────────────────────────

/**
 * GET /api/ai/status
 * Returns Ollama connectivity status and available models.
 */
router.get("/status", async (req, res) => {
  const start = Date.now();
  const result = {
    ollama: {
      reachable: false,
      latencyMs: null,
      host: OLLAMA_HOST,
      model: LLM_MODEL,
      error: null,
    },
    capabilities: {
      chat: false,
      summarise: false,
      embeddings: false,
    },
  };

  // Check basic connectivity (HTTP request to Ollama root)
  try {
    await new Promise((resolve, reject) => {
      const url = new URL(OLLAMA_HOST);
      const lib = url.protocol === "https:" ? https : http;
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 11434),
          path: "/",
          method: "GET",
          timeout: 5000,
        },
        (res) => {
          result.ollama.reachable = res.statusCode < 500;
          resolve();
        },
      );
      req.on("error", (e) => {
        result.ollama.error = e.message;
        reject(e);
      });
      req.on("timeout", () => {
        result.ollama.error = "Connection timed out";
        req.destroy();
        reject(new Error("timeout"));
      });
      req.end();
    });
  } catch (err) {
    result.ollama.error = err.message;
    result.ollama.reachable = false;
  }

  result.ollama.latencyMs = Date.now() - start;

  // If reachable, check /api/tags for available models
  if (result.ollama.reachable) {
    try {
      await new Promise((resolve, reject) => {
        const url = new URL(OLLAMA_HOST + "/api/tags");
        const lib = url.protocol === "https:" ? https : http;
        const req = lib.request(
          {
            hostname: url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 11434),
            path: "/api/tags",
            method: "GET",
            timeout: 8000,
          },
          (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                result.capabilities.chat = (parsed.models || []).some(
                  (m) =>
                    m.name === LLM_MODEL ||
                    m.name.includes("qwen") ||
                    m.name.includes("llama"),
                );
                result.capabilities.summarise = result.capabilities.chat;
              } catch (parseErr) {
                console.error(
                  "[AI Health] Failed to parse Ollama models response:",
                  parseErr.message,
                );
              }
              resolve();
            });
          },
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("timeout"));
        });
        req.end();
      });
    } catch (checkErr) {
      result.ollama.error =
        result.ollama.error || `Model check failed: ${checkErr.message}`;
    }
  }

  // Determine overall health
  const healthy =
    result.ollama.reachable &&
    (result.capabilities.chat || result.capabilities.summarise);
  const status = healthy
    ? "healthy"
    : result.ollama.reachable
      ? "degraded"
      : "offline";

  res.status(healthy ? 200 : result.ollama.reachable ? 200 : 503).json({
    status,
    ...result,
    recommendation: !result.ollama.reachable
      ? "Ollama is offline. Rule-based responses will be used. Start Ollama: `ollama serve`"
      : !result.capabilities.chat
        ? `Model "${LLM_MODEL}" not found on Ollama. Install: \`ollama pull ${LLM_MODEL}\``
        : "All systems operational.",
  });
});

// ─── Agent status ──────────────────────────────────────────────────────────────

router.get("/agent-status", (req, res) => {
  const { AGENT_DEFINITIONS } = require("../lib/unified-ai-client-v2");
  res.json({
    ok: true,
    available: true,
    agents: Object.entries(AGENT_DEFINITIONS).map(([key, agent]) => ({
      key,
      name: agent.name,
      description: agent.description,
      aliases: agent.aliases,
    })),
  });
});

// ─── Helper: handle unknown intent ────────────────────────────────────────────

function handleUnknown(message) {
  return {
    reply: `I didn't quite understand "${message}", but here's what I can help you with:\n\n• **Projects** — status, progress, budgets\n• **Invoices / Payments** — outstanding, overdue amounts\n• **Safety** — incidents, hazards, open investigations\n• **Team / Workers / Staff** — headcount, trades, hours\n• **RFIs** — open requests, priorities, deadlines\n• **Tenders / Bids** — pipeline, probabilities\n• **Overdue** — overdue invoices\n• **Budget** — total budget vs spend across all projects\n• **Materials** — stock, deliveries, suppliers\n• **Timesheets** — hours, payroll, overtime\n• **Subcontractors** — trades, CIS, insurance\n• **Equipment** — plant, machinery, hire\n• **Change Orders / Variations** — status, values\n• **Purchase Orders** — procurement, deliveries\n• **Contacts / CRM** — clients, prospects, suppliers\n• **RAMS** — method statements, risk assessments\n• **CIS** — construction industry scheme returns\n• **Daily Reports** — site diary, progress\n• **Risk Register** — hazards, risk scores\n• **Defects / Snags** — punch lists, NCRs, quality control\n• **Contracts** — JCT/NEC review, payment terms, bonds\n• **Valuations** — interim certificates, payment applications, cash flow\n• **Team Management** — workforce, CSCS/CPCS, IR35\n• **Construction Knowledge** — building codes, standards, methods, materials\n\nTry asking something like "Show me all projects" or "What invoices are overdue?"`,
    data: null,
    suggestions: [
      "Show me all projects",
      "What invoices are overdue?",
      "Show me open safety incidents",
    ],
  };
}

// ─── POST /chat ───────────────────────────────────────────────────────────────

router.post("/chat", aiChatLimiter, async (req, res) => {
  const { message, context, sessionId } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ message: "message is required" });
  }

  try {
    // ── Fetch conversation history (summarization applied internally for long chats) ──────
    let convHistory = [];
    let summary = null;
    if (
      sessionId &&
      req.user &&
      (req.user.organization_id || req.user.company_id)
    ) {
      try {
        const hist = await getConversationHistory(
          req.user.organization_id,
          req.user.company_id,
          sessionId,
        );
        convHistory = hist.messages;
        summary = hist.summary;
      } catch (e) {
        console.warn("[AI] Could not load conversation history:", e.message);
      }
    }

    const intents = classify(message.trim());
    let result;

    if (
      intents.length === 0 ||
      (intents.length === 1 && intents[0] === "unknown")
    ) {
      result = handleUnknown(message.trim());
    } else if (intents.length > 1) {
      const { handleCrossModule } = require("./ai-intents/cross-module-intent");
      result = await handleCrossModule(intents, message.trim(), req.user);
    } else {
      const intent = intents[0];
      const user = req.user;
      switch (intent) {
        case "projects":
          result = await handleProjects(user);
          break;
        case "invoices":
          result = await handleInvoices(user);
          break;
        case "overdue":
          result = await handleOverdue(user);
          break;
        case "safety":
          result = await handleSafety(user);
          break;
        case "team":
          result = await handleTeam(user);
          break;
        case "rfis":
          result = await handleRfis(user);
          break;
        case "tenders":
          result = await handleTenders(user);
          break;
        case "budget":
          result = await handleBudget(user);
          break;
        case "valuations":
          result = await handleValuations(user);
          break;
        case "defects":
          result = await handleDefects(user);
          break;
        case "materials":
          result = await handleMaterials(user);
          break;
        case "timesheets":
          result = await handleTimesheets(user);
          break;
        case "subcontractors":
          result = await handleSubcontractors(user);
          break;
        case "equipment":
          result = await handleEquipment(user);
          break;
        case "change_orders":
          result = await handleChangeOrders(user);
          break;
        case "purchase_orders":
          result = await handlePurchaseOrders(user);
          break;
        case "contacts":
          result = await handleContacts(user);
          break;
        case "rams":
          result = await handleRams(user);
          break;
        case "cis":
          result = await handleCIS(user);
          break;
        case "daily_reports":
          result = await handleDailyReports(user);
          break;
        case "risk":
          result = await handleRisk(user);
          break;
        case "report":
          result = await handleGenerateReport(message.trim(), req.user);
          break;
        case "autoresearch":
          result = await handleAutoresearch(message.trim(), req.user);
          break;
        case "autoimprove":
          result = await handleAutoimprove(message.trim(), req.user);
          break;
        case "autorepair":
          result = await handleAutorepair(message.trim(), req.user);
          break;
        case "construction_domain":
        case "safety_compliance":
        case "cost_estimation":
        case "project_coordinator":
        case "defects":
        case "contracts":
        case "valuations":
        case "team_management":
          {
            const agentType = intent;
            try {
              const agentResult = await agenticQuery(message.trim(), {
                agentType,
                context: {
                  userId: req.user?.id,
                  organizationId: req.user?.organization_id,
                  companyId: req.user?.company_id,
                },
              });
              const suggestions = {
                construction_domain: [
                  "Ask about specific standards",
                  "Request material recommendations",
                ],
                safety_compliance: [
                  "Review PPE requirements",
                  "Request hazard analysis",
                  "Check incident reporting procedures",
                ],
                cost_estimation: [
                  "Request unit cost breakdown",
                  "Get labor rate estimates",
                  "Compare alternative materials",
                ],
                project_coordinator: [
                  "Review project schedule",
                  "Check resource allocation",
                  "Update milestone timeline",
                ],
                defects: [
                  "Review open defects",
                  "Check punch list status",
                  "Request priority scoring",
                ],
                contracts: [
                  "Review contract clauses",
                  "Check payment terms",
                  "Assess bond requirements",
                ],
                valuations: [
                  "Prepare interim valuation",
                  "Forecast cash flow",
                  "Check withholding reasons",
                ],
                team_management: [
                  "Check CSCS certifications",
                  "Review workforce allocation",
                  "Assess headcount",
                ],
              };
              result = {
                reply: agentResult,
                data: { agentType },
                suggestions: suggestions[agentType] || [],
              };
            } catch (agentErr) {
              console.warn(
                `[AI] agenticQuery (${agentType}) failed:`,
                agentErr.message,
              );
              result = {
                reply: `Agent processing unavailable: ${agentErr.message}`,
                data: null,
                suggestions: [],
              };
            }
          }
          break;
        default:
          result = handleUnknown(message.trim());
          break;
      }
    }

    let reply = result.reply;
    let useLLM = false;

    if (shouldUseOllama(message.trim(), intents[0])) {
      try {
        reply = await getOllamaResponse(
          message.trim(),
          result.reply,
          convHistory,
          summary,
        );
        useLLM = true;
      } catch (llmErr) {
        console.warn(
          "[AI] Ollama unavailable, using rule-based fallback:",
          llmErr.message,
        );
        // Append a note so the user knows AI reasoning wasn't used
        if (reply && !reply.includes("(AI unavailable")) {
          reply =
            reply +
            "\n\n_Note: AI reasoning is currently unavailable (Ollama is offline). Showing rule-based summary._";
        }
      }
    }

    // ── Save conversation to DB (atomic — both messages or neither) ────────────
    if (sessionId && req.user) {
      const orgId = req.user.organization_id || null;
      const companyId = req.user.company_id || null;
      const uid = req.user.id || null;
      try {
        await pool.query(
          `INSERT INTO ai_conversations (organization_id, company_id, user_id, session_id, role, content, model)
           VALUES ($1, $2, $3, $4, 'user', $5, $6), ($1, $2, $3, $4, 'assistant', $7, $8)`,
          [
            orgId,
            companyId,
            uid,
            sessionId,
            message.trim(),
            LLM_MODEL,
            reply,
            LLM_MODEL,
          ],
        );
      } catch (e) {
        console.warn("[AI] Could not save conversation:", e.message);
      }
    }

    res.json({
      reply,
      data: result.data ?? null,
      suggestions: result.suggestions,
      source: useLLM ? "ollama" : "rule-based",
      _meta: { aiAvailable: useLLM, fallback: useLLM ? null : "rule-based" },
      hasHistory: convHistory.length > 0,
      hasSummary: !!summary,
    });
  } catch (err) {
    console.error("[AI /chat]", err.message);
    res.status(500).json({ message: "AI assistant encountered an error" });
  }
});

// ─── POST /summarize-project ─────────────────────────────────────────────────
// Returns a concise AI summary of a specific project
router.post("/summarize-project", aiSummarizeLimiter, async (req, res) => {
  const { projectId } = req.body;
  if (!projectId)
    return res.status(400).json({ error: "projectId is required" });

  const orgId = req.user?.organization_id;
  const isCompanyOwner = req.user?.role === "company_owner";
  const isSuper = req.user?.role === "super_admin";

  try {
    let projWhere = "WHERE id = $1";
    let projParams = [projectId];
    if (isCompanyOwner) {
      projWhere += " AND company_id = $2";
      projParams.push(req.user.company_id);
    } else if (!isSuper && (orgId || req.user.company_id)) {
      projWhere += " AND COALESCE(organization_id, company_id) = $2";
      projParams.push(orgId || req.user.company_id);
    }
    const { rows: projects } = await pool.query(
      `SELECT name, client, status, progress, budget, spent, manager, location, type, description, start_date, end_date
       FROM projects ${projWhere} LIMIT 1`,
      projParams,
    );
    if (!projects.length)
      return res.status(404).json({ error: "Project not found" });

    const proj = projects[0];

    // Gather related data in a single query using UNION ALL (1 round trip vs 5)
    // Handle company_owner: project rows may have NULL organization_id, fall back to company_id
    const projOrgId = proj.organization_id || orgId;
    const projCompanyId = proj.company_id || req.user?.company_id;
    let tenantFilter, tenantParam;
    if (projOrgId || projCompanyId) {
      tenantFilter = "COALESCE(organization_id, company_id) = $2";
      tenantParam = projOrgId || projCompanyId;
    } else {
      tenantFilter = "1=0";
      tenantParam = null;
    }
    const { rows: related } = await pool.query(
      `SELECT 'invoice' as type, id, number, amount, status, NULL as title, NULL as priority, NULL as due_date, NULL as reference, NULL as workers_on_site, NULL as progress, NULL as weather, NULL as date
       FROM invoices WHERE project_id = $1 AND ${tenantFilter} LIMIT 100
       UNION ALL
       SELECT 'change_order', id, number, amount, status, title, NULL, NULL, NULL, NULL, NULL, NULL, NULL
       FROM change_orders WHERE project_id = $1 AND ${tenantFilter} LIMIT 100
       UNION ALL
       SELECT 'defect', id, reference, amount, status, title, priority, due_date, NULL, NULL, NULL, NULL, NULL
       FROM defects WHERE project_id = $1 AND ${tenantFilter} LIMIT 100
       UNION ALL
       SELECT 'rfi', id, number, NULL, status, subject, priority, due_date, NULL, NULL, NULL, NULL, NULL
       FROM rfis WHERE project_id = $1 AND ${tenantFilter} LIMIT 100
       UNION ALL
       SELECT 'daily_report', id, NULL, NULL, status, NULL, NULL, NULL, date, workers_on_site, progress, weather, date
       FROM daily_reports WHERE project_id = $1 AND ${tenantFilter} ORDER BY date DESC LIMIT 100`,
      [projectId, tenantParam],
    );

    const invoices = related
      .filter((r) => r.type === "invoice")
      .map((r) => ({ number: r.number, amount: r.amount, status: r.status }));
    const changeOrders = related
      .filter((r) => r.type === "change_order")
      .map((r) => ({
        number: r.number,
        title: r.title,
        amount: r.amount,
        status: r.status,
      }));
    const defects = related
      .filter((r) => r.type === "defect")
      .map((r) => ({
        reference: r.reference,
        title: r.title,
        priority: r.priority,
        status: r.status,
        due_date: r.due_date,
      }));
    const rfis = related
      .filter((r) => r.type === "rfi")
      .map((r) => ({
        number: r.number,
        subject: r.title,
        priority: r.priority,
        status: r.status,
        due_date: r.due_date,
      }));
    const dailyReports = related
      .filter((r) => r.type === "daily_report")
      .map((r) => ({
        date: r.date,
        weather: r.weather,
        workers_on_site: r.workers_on_site,
        progress: r.progress,
      }))
      .slice(-7);

    const totalInvoiced = invoices.reduce(
      (s, i) => s + parseFloat(i.amount || 0),
      0,
    );
    const paidInvoices = invoices.filter((i) => i.status === "paid").length;
    const overdueInvoices = invoices.filter(
      (i) => i.status === "overdue",
    ).length;
    const openDefects = defects.filter(
      (d) => d.status === "open" || d.status === "in_progress",
    ).length;
    const openRfis = rfis.filter((r) => r.status !== "closed").length;
    const avgWorkers = dailyReports.length
      ? (
          dailyReports.reduce(
            (s, d) => s + parseFloat(d.workers_on_site || 0),
            0,
          ) / dailyReports.length
        ).toFixed(1)
      : "N/A";

    const context = `
Project: ${proj.name}
Client: ${proj.client || "N/A"}
Status: ${proj.status} | Progress: ${proj.progress ?? 0}%
Budget: £${parseFloat(proj.budget || 0).toLocaleString("en-GB")} | Spent: £${parseFloat(proj.spent || 0).toLocaleString("en-GB")} (${proj.budget > 0 ? Math.round((proj.spent / proj.budget) * 100) : 0}%)
Manager: ${proj.manager || "N/A"} | Location: ${proj.location || "N/A"}
Type: ${proj.type || "N/A"} | Start: ${proj.start_date || "N/A"} | End: ${proj.end_date || "N/A"}
Description: ${proj.description || "None"}
Financial: ${invoices.length} invoices totalling £${totalInvoiced.toLocaleString("en-GB")}, ${paidInvoices} paid, ${overdueInvoices} overdue
Change Orders: ${changeOrders.length} total
Defects: ${defects.length} total, ${openDefects} open
RFIs: ${rfis.length} total, ${openRfis} open
Daily Reports: ${dailyReports.length} recent | Avg workers on site: ${avgWorkers}
`.trim();

    try {
      const summary = await summarizeText(
        `Summarise this construction project in 3-4 sentences for a non-technical stakeholder:\n\n${context}`,
      );
      res.json({
        summary,
        projectId,
        projectName: proj.name,
        stats: {
          progress: proj.progress ?? 0,
          budgetUtilization:
            proj.budget > 0 ? Math.round((proj.spent / proj.budget) * 100) : 0,
          totalInvoiced,
          paidInvoices,
          overdueInvoices,
          totalChangeOrders: changeOrders.length,
          openDefects,
          openRfis,
          avgWorkersOnSite:
            avgWorkers === "N/A" ? null : parseFloat(avgWorkers),
        },
      });
    } catch (ollamaErr) {
      // Fallback to rule-based summary
      const budgetPct =
        proj.budget > 0 ? Math.round((proj.spent / proj.budget) * 100) : 0;
      const summary =
        `"${proj.name}" is a ${proj.type || "construction"} project for ${proj.client || "an undisclosed client"}, currently ${proj.status} at ${proj.progress ?? 0}% completion. ` +
        `Budget utilisation is ${budgetPct}% (£${parseFloat(proj.spent || 0).toLocaleString("en-GB")} of £${parseFloat(proj.budget || 0).toLocaleString("en-GB")}). ` +
        `There are ${openRfis} open RFIs, ${openDefects} open defects, and ${overdueInvoices} overdue invoice(s).`;
      res.json({
        summary,
        projectId,
        projectName: proj.name,
        source: "rule-based",
        _meta: { aiAvailable: false, fallback: "rule-based" },
      });
    }
  } catch (err) {
    console.error("[AI /summarize-project]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /summarize-rfi-thread ───────────────────────────────────────────────
// Returns an AI-generated summary of all RFIs for a project or all open RFIs
router.post("/summarize-rfi-thread", aiSummarizeLimiter, async (req, res) => {
  const { projectId } = req.body;

  try {
    let rfis, placeholders, params;

    if (projectId) {
      // Summarize RFIs for a specific project
      const orgId = req.user?.organization_id;
      const companyId = req.user?.company_id;
      const isSuper = req.user?.role === "super_admin";

      let tenantFilter;
      if (isSuper) {
        tenantFilter = "";
        params = [projectId];
      } else if (orgId) {
        tenantFilter =
          " AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3))";
        params = [projectId, orgId, companyId];
      } else {
        tenantFilter = " AND company_id = $2";
        params = [projectId, companyId];
      }

      const { rows } = await pool.query(
        `SELECT number, subject, priority, status, due_date, assigned_to, submitted_date, resolution_date, project
         FROM rfis WHERE id = $1 ${tenantFilter}`,
        params,
      );
      rfis = rows;
    } else {
      // Summarize all open/overdue RFIs for the user's org
      const orgId = req.user?.organization_id;
      const companyId = req.user?.company_id;
      const { rows } = await pool.query(
        `SELECT number, subject, priority, status, due_date, assigned_to, submitted_date, project
         FROM rfis
         WHERE COALESCE(organization_id, company_id) = $1
           AND status IN ('open', 'pending', 'overdue')
         ORDER BY
           CASE WHEN priority = 'critical' THEN 0 WHEN priority = 'high' THEN 1 ELSE 2 END,
           due_date ASC NULLS LAST
         LIMIT 50`,
        [orgId, companyId],
      );
      rfis = rows;
    }

    if (!rfis.length) {
      return res.json({
        summary: "No open RFIs found.",
        count: 0,
        source: "rule-based",
        _meta: { aiAvailable: false, fallback: "rule-based" },
      });
    }

    const open = rfis.filter(
      (r) => r.status === "open" || r.status === "pending",
    );
    const overdue = rfis.filter((r) => r.status === "overdue");
    const critical = rfis.filter((r) => r.priority === "critical");
    const high = rfis.filter((r) => r.priority === "high");

    // Build context for LLM
    const context = rfis
      .map(
        (r) =>
          `[${r.number}] ${r.project || ""} — ${r.subject} | Priority: ${r.priority} | Status: ${r.status} | Due: ${r.due_date || "N/A"} | Assigned: ${r.assigned_to || "Unassigned"}`,
      )
      .join("\n");

    const prompt = `You are a construction project manager summarising RFIs (Requests for Information).

Summarise the following ${rfis.length} RFIs in a concise executive summary:
- ${open.length} open, ${overdue.length} overdue, ${critical.length} critical, ${high.length} high priority
${
  critical.length > 0
    ? `\nCritical RFIs that need immediate attention:\n${rfis
        .filter((r) => r.priority === "critical")
        .map((r) => `• ${r.number}: ${r.subject}`)
        .join("\n")}`
    : ""
}
${
  overdue.length > 0
    ? `\nOverdue RFIs:\n${rfis
        .filter((r) => r.status === "overdue")
        .map((r) => `• ${r.number}: ${r.subject} (due ${r.due_date})`)
        .join("\n")}`
    : ""
}

RFI Details:
${context}

Provide a 3-4 sentence executive summary followed by recommended actions. Format in Markdown.`;

    try {
      const summary = await summarizeText(prompt);
      res.json({
        summary,
        count: rfis.length,
        open: open.length,
        overdue: overdue.length,
        critical: critical.length,
        source: "ai",
        _meta: { aiAvailable: true, fallback: null },
      });
    } catch (ollamaErr) {
      // Fallback to rule-based summary
      const byProject = rfis.reduce((acc, r) => {
        const p = r.project || "Unassigned";
        if (!acc[p]) acc[p] = [];
        acc[p].push(r);
        return acc;
      }, {});

      let summary = `You have **${rfis.length} open RFIs** — ${overdue.length} overdue, ${critical.length} critical, ${high.length} high priority.\n\n`;
      if (critical.length > 0)
        summary += `**Critical:** ${critical.map((r) => `${r.number}: ${r.subject}`).join(", ")}\n\n`;
      if (overdue.length > 0)
        summary += `**Overdue:** ${overdue.map((r) => `${r.number}: ${r.subject}`).join(", ")}\n\n`;
      summary += `RFIs by project: ${Object.entries(byProject)
        .map(([p, arr]) => `${p}: ${arr.length}`)
        .join(", ")}.\n\n`;
      summary +=
        "Recommendation: Review critical and overdue RFIs first, assign unassigned items, and update stakeholders.";
      res.json({
        summary,
        count: rfis.length,
        open: open.length,
        overdue: overdue.length,
        critical: critical.length,
        source: "rule-based",
        _meta: { aiAvailable: false, fallback: "rule-based" },
      });
    }
  } catch (err) {
    console.error("[AI /summarize-rfi-thread]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /summarize-daily-reports ───────────────────────────────────────────
// Returns an AI-generated summary of daily site reports
router.post(
  "/summarize-daily-reports",
  aiSummarizeLimiter,
  async (req, res) => {
    const { projectId, days = 7 } = req.body;

    try {
      const orgId = req.user?.organization_id;
      const companyId = req.user?.company_id;
      const isSuper = req.user?.role === "super_admin";
      const daysNum = Math.min(30, Math.max(1, parseInt(days, 10) || 7));

      let query, params;
      if (projectId) {
        let tenantFilter;
        if (isSuper) {
          tenantFilter = "";
          params = [projectId];
        } else if (orgId) {
          tenantFilter =
            " AND (organization_id = $2 OR (organization_id IS NULL AND company_id = $3))";
          params = [projectId, orgId, companyId];
        } else {
          tenantFilter = " AND company_id = $2";
          params = [projectId, companyId];
        }
        query = `SELECT project, date, weather, workers_on_site, progress_notes, delays, notes, equipment_on_site
               FROM daily_reports WHERE id = $1 ${tenantFilter}
               ORDER BY date DESC LIMIT $${params.length + 1}`;
        params.push(daysNum);
        query = `SELECT project, date, weather, workers_on_site, progress_notes, delays, notes, equipment_on_site
               FROM daily_reports WHERE id = $1 ${tenantFilter}
               ORDER BY date DESC LIMIT $${params.length + 1}`;
      } else {
        params = [orgId, companyId, daysNum];
        query = `SELECT project, date, weather, workers_on_site, progress_notes, delays, notes, equipment_on_site
               FROM daily_reports
               WHERE COALESCE(organization_id, company_id) = $1
                 AND date >= CURRENT_DATE - INTERVAL '${daysNum} days'
               ORDER BY date DESC`;
      }

      const { rows: reports } = await pool.query(query, params);

      if (!reports.length) {
        return res.json({
          summary: "No daily reports found for this period.",
          count: 0,
          source: "rule-based",
          _meta: { aiAvailable: false, fallback: "rule-based" },
        });
      }

      // Calculate aggregate stats
      const workers = reports.map((r) => parseFloat(r.workers_on_site) || 0);
      const avgWorkers =
        workers.length > 0
          ? (workers.reduce((a, b) => a + b, 0) / workers.length).toFixed(1)
          : "0";
      const totalReports = reports.length;
      const projects = [
        ...new Set(reports.map((r) => r.project).filter(Boolean)),
      ];

      // Build context
      const weatherCounts = reports.reduce((acc, r) => {
        const w = r.weather || "Unknown";
        acc[w] = (acc[w] || 0) + 1;
        return acc;
      }, {});
      const weatherSummary = Object.entries(weatherCounts)
        .map(([w, c]) => `${w} (${c} day${c > 1 ? "s" : ""})`)
        .join(", ");

      const context = reports
        .map(
          (r) =>
            `${r.date} | ${r.project || "N/A"} | ${r.weather || "N/A"} | ${r.workers_on_site || 0} workers | ${r.progress_notes || "No notes"} | Delays: ${r.delays || "None"}`,
        )
        .join("\n");

      const prompt = `You are a construction site manager summarising daily site reports.

Summary: ${totalReports} daily reports across ${projects.length} project(s) over ${daysNum} days.
Average workers on site: ${avgWorkers} per day.
Weather: ${weatherSummary}

Detailed reports:
${context}

Provide a 3-4 sentence executive summary covering:
1. Overall site activity and productivity trends
2. Weather impact on operations
3. Any delays or issues noted
4. Recommended follow-up actions

Format in Markdown.`;

      try {
        const summary = await summarizeText(prompt);
        res.json({
          summary,
          count: totalReports,
          avgWorkers: parseFloat(avgWorkers),
          projects: projects.length,
          weatherSummary,
          source: "ai",
          _meta: { aiAvailable: true, fallback: null },
        });
      } catch (ollamaErr) {
        // Fallback to rule-based summary
        const latest = reports[0];
        let summary = `${totalReports} daily reports submitted over the past ${daysNum} days across ${projects.length} project(s).\n\n`;
        summary += `Average workforce: ${avgWorkers} workers/day.\n`;
        summary += `Weather breakdown: ${weatherSummary}.\n\n`;
        if (latest) {
          summary +=
            `Most recent report (${latest.date}) for ${latest.project || "N/A"}: ${latest.progress_notes || "No notes"} ` +
            `— ${latest.workers_on_site || 0} workers on site${latest.delays ? `, delays: ${latest.delays}` : ""}.`;
        }
        res.json({
          summary,
          count: totalReports,
          avgWorkers: parseFloat(avgWorkers),
          projects: projects.length,
          weatherSummary,
          source: "rule-based",
          _meta: { aiAvailable: false, fallback: "rule-based" },
        });
      }
    } catch (err) {
      console.error("[AI /summarize-daily-reports]", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

const UPLOADS_FOR_AI = path.join(__dirname, "../uploads");

// ─── POST /enrich-site-brief ─────────────────────────────────────────────────
// NL polish on top of client heuristic brief (OpenRouter → Ollama → Gemini).
router.post("/enrich-site-brief", aiSummarizeLimiter, async (req, res) => {
  const {
    headline,
    subline,
    signals = [],
    playbooks = [],
    stats = {},
  } = req.body || {};
  if (!headline || typeof headline !== "string") {
    return res.status(400).json({ message: "headline is required" });
  }

  const signalsStr = (Array.isArray(signals) ? signals : [])
    .slice(0, 8)
    .map((s) => `- [${s.severity || "info"}] ${s.title || ""}: ${s.detail || ""}`)
    .join("\n");

  const prompt = `You are a UK construction programme director. Polish the site command brief for a control-room dashboard.

Rules:
- Do not invent facts or counts; only sharpen tone using the given signals and stats.
- headline: max 100 characters, punchy.
- subline: max 240 characters, one or two sentences.
- Return ONLY valid JSON: {"headline":"...","subline":"..."}

Current headline: ${headline}
Current subline: ${subline || ""}
Playbooks (hints): ${(playbooks || []).slice(0, 5).join(" | ")}
Signals:
${signalsStr || "(none)"}
Stats JSON: ${JSON.stringify(stats)}`;

  try {
    const raw = await smartQuery(prompt, {
      temperature: 0.35,
      maxTokens: 500,
      preferredProvider: "openrouter",
    });
    const m = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
    const parsed = m ? JSON.parse(m[0]) : null;
    if (parsed?.headline) {
      return res.json({
        headline: String(parsed.headline).slice(0, 160),
        subline: String(parsed.subline || subline || "").slice(0, 400),
        source: "ai",
      });
    }
    throw new Error("no json");
  } catch (e) {
    console.warn("[AI /enrich-site-brief]", e.message);
    return res.json({
      headline,
      subline: subline || "",
      source: "heuristic",
      fallback: true,
    });
  }
});

// ─── POST /analyze-document ──────────────────────────────────────────────────
// PDF/TXT extraction + structured commercial / RFI intelligence.
router.post("/analyze-document", aiSummarizeLimiter, async (req, res) => {
  const { documentId, useCache = true } = req.body || {};
  if (!documentId) {
    return res.status(400).json({ message: "documentId is required" });
  }

  const orgSel = buildTenantFilter(req, "AND", null, 2);
  const orgUp = buildTenantFilter(req, "AND", null, 3);

  try {
    const { rows } = await pool.query(
      `SELECT * FROM documents WHERE id = $1${orgSel.clause}`,
      [documentId, ...orgSel.params],
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Document not found" });
    }
    const doc = rows[0];

    if (
      useCache &&
      doc.ai_analysis_cache &&
      typeof doc.ai_analysis_cache === "object"
    ) {
      return res.json({
        ...doc.ai_analysis_cache,
        source: "cache",
        documentId: String(documentId),
      });
    }

    if (!doc.file_path) {
      return res.json({
        summary: `No file stored for "${doc.name}". Category: ${doc.category}, type: ${doc.type}.`,
        commercialRisks: [],
        suggestedActions: [],
        rfiSuggestions: [],
        keyEntities: [],
        confidence: "low",
        extractedChars: 0,
        source: "metadata-only",
        documentId: String(documentId),
      });
    }

    const fullPath = path.resolve(UPLOADS_FOR_AI, path.basename(doc.file_path));
    if (!fullPath.startsWith(path.resolve(UPLOADS_FOR_AI))) {
      return res.status(403).json({ message: "Invalid file path" });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    let text = doc.ai_extracted_snippet || "";
    if (!text || String(text).length < 40) {
      text = await extractReadableTextFromDocument(fullPath, doc.type || "");
      if (text && text.length > 80) {
        await pool
          .query(
            `UPDATE documents SET ai_extracted_snippet = $1 WHERE id = $2${orgUp.clause}`,
            [text.slice(0, 15000), documentId, ...orgUp.params],
          )
          .catch(() => {});
      }
    }

    const metadataBlock = `Filename: ${doc.name}
Type: ${doc.type}
Category: ${doc.category}
Project ID: ${doc.project_id || "n/a"}
Access: ${doc.access_level || "n/a"}`;

    if (!text || String(text).length < 30) {
      return res.json({
        summary: `No extractable text (try PDF with text layer or .txt). ${metadataBlock.replace(/\n/g, " · ")}`,
        commercialRisks: [],
        suggestedActions: [
          "Export drawings/specs to searchable PDF or paste scope into a TXT attachment for AI review.",
        ],
        rfiSuggestions: [],
        keyEntities: [],
        confidence: "low",
        extractedChars: 0,
        source: "metadata-only",
        documentId: String(documentId),
      });
    }

    const prompt = `You are a senior contracts & delivery manager on a UK construction project.

Analyse this document excerpt (may be partial). Output ONLY valid JSON (no markdown):
{
  "summary": "3-5 sentence executive summary",
  "commercialRisks": ["short bullets: payment, scope, time, compliance, retention, LDs, etc."],
  "suggestedActions": ["concrete next steps for PM or commercial"],
  "rfiSuggestions": ["clarifications or RFIs worth raising"],
  "keyEntities": ["parties, specs, dates, sums to track"],
  "confidence": "high|medium|low"
}

METADATA:
${metadataBlock}

DOCUMENT TEXT:
${String(text).slice(0, 12000)}`;

    try {
      const raw = await smartQuery(prompt, {
        temperature: 0.35,
        maxTokens: 2800,
        preferredProvider: "openrouter",
      });
      const m = typeof raw === "string" ? raw.match(/\{[\s\S]*\}/) : null;
      const parsed = m ? JSON.parse(m[0]) : null;
      const out = {
        summary:
          parsed?.summary ||
          (typeof raw === "string" ? raw.slice(0, 600) : "Analysis incomplete."),
        commercialRisks: Array.isArray(parsed?.commercialRisks)
          ? parsed.commercialRisks.slice(0, 14)
          : [],
        suggestedActions: Array.isArray(parsed?.suggestedActions)
          ? parsed.suggestedActions.slice(0, 14)
          : [],
        rfiSuggestions: Array.isArray(parsed?.rfiSuggestions)
          ? parsed.rfiSuggestions.slice(0, 12)
          : [],
        keyEntities: Array.isArray(parsed?.keyEntities)
          ? parsed.keyEntities.slice(0, 16)
          : [],
        confidence: parsed?.confidence || "medium",
        extractedChars: String(text).length,
        source: "ai",
        documentId: String(documentId),
      };

      await pool
        .query(
          `UPDATE documents SET ai_analysis_cache = $1::jsonb, ai_analysis_at = NOW() WHERE id = $2${orgUp.clause}`,
          [JSON.stringify(out), documentId, ...orgUp.params],
        )
        .catch(() => {});

      return res.json(out);
    } catch (llmErr) {
      console.warn("[AI /analyze-document] LLM:", llmErr.message);
      return res.json({
        summary: `Extracted ${String(text).length} characters but AI providers failed. Preview: ${String(text).slice(0, 500)}…`,
        commercialRisks: [],
        suggestedActions: [
          "Set OPENROUTER_API_KEY or start Ollama for full structured analysis.",
        ],
        rfiSuggestions: [],
        keyEntities: [],
        confidence: "low",
        extractedChars: String(text).length,
        source: "extraction-only",
        documentId: String(documentId),
      });
    }
  } catch (err) {
    console.error("[AI /analyze-document]", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /chat/stream ────────────────────────────────────────────────────────
router.post("/chat/stream", aiChatLimiter, async (req, res) => {
  const { message, context } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ message: "message is required" });
  }

  const intents = classify(message.trim());
  const intent = intents[0];

  const agentIntents = [
    "construction_domain",
    "safety_compliance",
    "cost_estimation",
    "project_coordinator",
    "defects",
    "contracts",
    "valuations",
    "team_management",
  ];
  if (!agentIntents.includes(intent)) {
    return res
      .status(400)
      .json({ message: "Streaming is only available for agent queries." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await streamAgenticQuery(message.trim(), {
      agentType: intent,
      context: {
        userId: req.user?.id,
        organizationId: req.user?.organization_id,
        companyId: req.user?.company_id,
      },
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true, intent })}\n\n`);
  } catch (err) {
    console.warn("[AI /chat/stream]", err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.end();
});
// Action execution: { action, params } → { success, message, data }
// Restricted to admin-level roles — prevents clients/field_workers from creating
// projects, updating invoices, adding team members, etc. via AI.
const AI_EXECUTE_ALLOWED_ROLES = new Set([
  "super_admin",
  "company_owner",
  "admin",
  "project_manager",
]);

router.post("/execute", aiExecuteLimiter, async (req, res) => {
  const { action, params = {} } = req.body;
  if (!action)
    return res
      .status(400)
      .json({ success: false, message: "action is required" });

  if (!AI_EXECUTE_ALLOWED_ROLES.has(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Insufficient permissions to execute AI actions",
    });
  }

  try {
    // Require either organization_id or company_id for all write actions
    if (!req.user?.organization_id && !req.user?.company_id) {
      return res.status(400).json({
        success: false,
        message:
          "User profile incomplete — organization or company membership required.",
      });
    }

    // Tenant scope: prefer organization_id, fall back to company_id
    const tenantId = req.user?.organization_id || req.user?.company_id;

    switch (action) {
      case "create_project": {
        const {
          name,
          client,
          budget,
          status = "active",
          type = "construction",
          manager,
          location,
        } = params;
        if (!name || !client)
          return res
            .status(400)
            .json({ success: false, message: "name and client are required" });
        const { rows } = await pool.query(
          `INSERT INTO projects(name,client,budget,status,type,manager,location,progress,spent,organization_id,company_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,0,0,$8,$9) RETURNING id,name,status`,
          [
            name,
            client,
            budget !== null && budget !== undefined ? Number(budget) : 0,
            status,
            type,
            manager || null,
            location || null,
            tenantId,
            req.user.company_id,
          ],
        );
        broadcastDashboardUpdate("create", "projects", rows[0]);
        broadcastNotification(
          "New Project Created",
          `"${name}" has been added to the project register.`,
          "info",
          { projectId: rows[0].id, projectName: name },
        );
        res.json({
          success: true,
          message: `Project "${name}" created.`,
          data: rows[0],
        });
        break;
      }

      case "update_project_status": {
        const { project_id, status } = params;
        if (!project_id || !status)
          return res.status(400).json({
            success: false,
            message: "project_id and status are required",
          });
        const companyId = req.user?.company_id;
        const orgFilter =
          tenantId || companyId
            ? req.user?.organization_id
              ? "organization_id = $3"
              : "company_id = $3"
            : "1=0";
        const { rows } = await pool.query(
          `UPDATE projects SET status=$1 WHERE id=$2 AND ${orgFilter} RETURNING id,name,status`,
          [status, project_id, tenantId || companyId],
        );
        if (!rows.length)
          return res.status(404).json({
            success: false,
            message: "Project not found or access denied",
          });
        broadcastDashboardUpdate("update", "projects", rows[0]);
        broadcastNotification(
          "Project Status Updated",
          `Project "${rows[0].name}" status changed to ${status}.`,
          "info",
          { projectId: project_id },
        );
        res.json({
          success: true,
          message: `Project status updated to "${status}".`,
          data: rows[0],
        });
        break;
      }

      case "update_invoice_status": {
        const { invoice_id, status } = params;
        if (!invoice_id || !status)
          return res.status(400).json({
            success: false,
            message: "invoice_id and status are required",
          });
        const VALID_INVOICE_STATUSES = [
          "draft",
          "sent",
          "paid",
          "overdue",
          "disputed",
        ];
        if (!VALID_INVOICE_STATUSES.includes(status))
          return res.status(400).json({
            success: false,
            message: `Invalid status. Valid values: ${VALID_INVOICE_STATUSES.join(", ")}`,
          });
        const companyId = req.user?.company_id;
        const orgFilter =
          tenantId || companyId
            ? req.user?.organization_id
              ? "organization_id = $3"
              : "company_id = $3"
            : "1=0";
        const { rows } = await pool.query(
          `UPDATE invoices SET status=$1 WHERE id=$2 AND ${orgFilter} RETURNING id,number,status`,
          [status, invoice_id, tenantId || companyId],
        );
        if (!rows.length)
          return res
            .status(404)
            .json({ success: false, message: "Invoice not found" });
        broadcastDashboardUpdate("update", "invoices", rows[0]);
        res.json({
          success: true,
          message: `Invoice "${rows[0].number}" status updated to "${status}".`,
          data: rows[0],
        });
        break;
      }

      case "create_rfi": {
        const {
          project,
          subject,
          priority = "medium",
          status: rfiStatus = "open",
        } = params;
        if (!project || !subject)
          return res.status(400).json({
            success: false,
            message: "project and subject are required",
          });
        const { rows } = await pool.query(
          `INSERT INTO rfis(project,subject,priority,status,organization_id,company_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,number,status`,
          [
            project,
            subject,
            priority,
            rfiStatus,
            tenantId,
            req.user.company_id,
          ],
        );
        broadcastDashboardUpdate("create", "rfis", rows[0]);
        broadcastNotification(
          "New RFI Raised",
          `${rows[0].number}: ${subject}`,
          "info",
          { projectId: project },
        );
        res.json({
          success: true,
          message: `RFI created: ${rows[0].number}`,
          data: rows[0],
        });
        break;
      }

      case "create_safety_incident": {
        const {
          project,
          title,
          type,
          severity = "medium",
          status: incStatus = "open",
        } = params;
        if (!project || !title)
          return res.status(400).json({
            success: false,
            message: "project and title are required",
          });
        const { rows } = await pool.query(
          `INSERT INTO safety_incidents(project,title,type,severity,status,date,organization_id,company_id)
           VALUES($1,$2,$3,$4,$5,NOW(),$6,$7) RETURNING id,title,severity,status`,
          [
            project,
            title,
            type || "incident",
            severity,
            incStatus,
            tenantId,
            req.user.company_id,
          ],
        );
        broadcastDashboardUpdate("create", "safety_incidents", rows[0]);
        broadcastNotification(
          "Safety Incident Recorded",
          `"${title}" — severity: ${severity}`,
          severity === "critical" || severity === "high"
            ? "critical"
            : "warning",
          { projectId: project },
        );
        res.json({
          success: true,
          message: `Safety incident recorded: "${title}"`,
          data: rows[0],
        });
        break;
      }

      case "add_team_member": {
        const { name, role, trade, status: tmStatus = "active" } = params;
        if (!name)
          return res
            .status(400)
            .json({ success: false, message: "name is required" });
        const { rows } = await pool.query(
          `INSERT INTO team_members(name,role,trade,status,organization_id,company_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,role,status`,
          [
            name,
            role || null,
            trade || null,
            tmStatus,
            tenantId,
            req.user.company_id,
          ],
        );
        broadcastDashboardUpdate("create", "team_members", rows[0]);
        broadcastNotification(
          "New Team Member Added",
          `${name} has joined the team as ${role || "member"}.`,
          "info",
          { memberId: rows[0].id },
        );
        res.json({
          success: true,
          message: `Team member "${name}" added.`,
          data: rows[0],
        });
        break;
      }

      case "update_rfi_status": {
        const { rfi_id, status } = params;
        if (!rfi_id || !status)
          return res.status(400).json({
            success: false,
            message: "rfi_id and status are required",
          });
        const companyId = req.user?.company_id;
        const orgFilter =
          tenantId || companyId
            ? req.user?.organization_id
              ? "organization_id = $3"
              : "company_id = $3"
            : "1=0";
        const { rows } = await pool.query(
          `UPDATE rfis SET status=$1 WHERE id=$2 AND ${orgFilter} RETURNING id,number,status`,
          [status, rfi_id, tenantId || companyId],
        );
        if (!rows.length)
          return res
            .status(404)
            .json({ success: false, message: "RFI not found" });
        res.json({
          success: true,
          message: `RFI "${rows[0].number}" status updated.`,
          data: rows[0],
        });
        break;
      }

      case "create_contact": {
        const { name, company, email, role, type = "client" } = params;
        if (!name)
          return res
            .status(400)
            .json({ success: false, message: "name is required" });
        const { rows } = await pool.query(
          `INSERT INTO contacts(name,company,email,role,type,status,organization_id,company_id) VALUES($1,$2,$3,$4,$5,'active',$6,$7) RETURNING id,name,company`,
          [
            name,
            company || null,
            email || null,
            role || null,
            type,
            tenantId,
            req.user.company_id,
          ],
        );
        res.json({
          success: true,
          message: `Contact "${name}" created.`,
          data: rows[0],
        });
        break;
      }

      case "summarize_project": {
        const { projectId } = params;
        if (!projectId)
          return res
            .status(400)
            .json({ success: false, message: "projectId is required" });
        const orgId = req.user?.organization_id;
        const isCoOwner = req.user?.role === "company_owner";
        const isSuperAdmin = req.user?.role === "super_admin";
        let exWhere = "WHERE id = $1";
        let exParams = [projectId];
        if (isCoOwner) {
          exWhere += " AND company_id = $2";
          exParams.push(req.user.company_id);
        } else if (!isSuperAdmin && (orgId || req.user.company_id)) {
          exWhere += " AND COALESCE(organization_id, company_id) = $2";
          exParams.push(orgId || req.user.company_id);
        }
        const { rows } = await pool.query(
          `SELECT name, client, status, progress, budget, spent, manager, description
           FROM projects ${exWhere} LIMIT 1`,
          exParams,
        );
        if (!rows.length)
          return res
            .status(404)
            .json({ success: false, message: "Project not found" });
        const p = rows[0];
        const budgetPct =
          p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
        const summary =
          `"${p.name}" is currently ${p.status} at ${p.progress ?? 0}% completion. ` +
          `Budget utilisation is ${budgetPct}% (£${parseFloat(p.spent || 0).toLocaleString("en-GB")} of £${parseFloat(p.budget || 0).toLocaleString("en-GB")}). ` +
          `Managed by ${p.manager || "no assigned manager"}.`;
        res.json({ success: true, message: summary, data: rows[0] });
        break;
      }

      default:
        res.status(400).json({
          success: false,
          message: `Unknown action: "${action}". Supported: create_project, update_project_status, update_invoice_status, create_rfi, create_safety_incident, add_team_member, update_rfi_status, create_contact.`,
        });
    }
  } catch (err) {
    console.error("[AI /execute]", err.message);
    res.status(500).json({ success: false, message: "Action failed" });
  }
});

// ─── POST /transcribe ─────────────────────────────────────────────────────────
// Transcribe audio using inference.sh CLI (fallback when browser STT unavailable)
// Accepts: { audioUrl: string } — returns { text: string }
router.post("/transcribe", async (req, res) => {
  const { audioUrl } = req.body;
  if (!audioUrl || typeof audioUrl !== "string") {
    return res.status(400).json({ error: "audioUrl is required" });
  }

  const { spawn } = require("child_process");

  // Helper: run a command with array args (no shell interpolation)
  function runCmd(bin, args, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { timeout: timeoutMs });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => {
        stdout += d;
      });
      child.stderr.on("data", (d) => {
        stderr += d;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) reject(new Error(stderr || `exit ${code}`));
        else resolve(stdout);
      });
    });
  }

  // Use fast-whisper-large-v3 via inference.sh CLI — args passed as array
  let taskId;
  try {
    const stdout = await runCmd("infsh", [
      "app",
      "run",
      "infsh/fast-whisper-large-v3",
      "--input",
      JSON.stringify({ audio_url: audioUrl }),
      "--no-wait",
    ]);
    const parsed = JSON.parse(stdout);
    taskId = parsed.task_id;
    if (!taskId) throw new Error("No task_id returned");
  } catch (err) {
    console.error("[AI /transcribe] Failed to start infsh task:", err.message);
    return res.status(500).json({
      error:
        "Failed to start transcription. Is infsh CLI installed and logged in?",
    });
  }

  // Poll for completion (up to 60s)
  const maxAttempts = 30;
  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const statusOut = await runCmd("infsh", ["task", "get", taskId]);
      const status = JSON.parse(statusOut);
      if (status.status === "completed") {
        const text = status.result?.text || status.output?.text || "";
        return res.json({ text });
      }
      if (status.status === "failed") {
        return res
          .status(500)
          .json({ error: status.error || "Transcription failed" });
      }
    } catch {
      // Keep polling
    }
    attempts++;
  }

  return res.status(504).json({ error: "Transcription timed out" });
});

module.exports = router;

const express = require("express");
const authMiddleware = require("../middleware/auth");
const pool = require("../db");
const { broadcastDashboardUpdate } = require("../lib/ws-broadcast");
const { validateRequiredFields } = require("./validation");
const { safeParse, buildCrudPayloadSchema } = require("../lib/zod-validation");

// Map table name → webhook event name
const WEBHOOK_EVENT_MAP = {
  projects: {
    create: "project.created",
    update: "project.updated",
    delete: "project.deleted",
  },
  invoices: {
    create: "invoice.created",
    update: "invoice.updated",
    delete: "invoice.deleted",
    statusMap: { paid: "invoice.paid", overdue: "invoice.overdue" },
  },
  safety_incidents: { create: "safety.incident", update: "safety.updated" },
  rfis: {
    create: "rfi.created",
    update: "rfi.updated",
    statusMap: { overdue: "rfi.overdue" },
  },
  daily_reports: { create: "daily_report.created" },
  tenders: { create: "tender.created", update: "tender.updated" },
  documents: { create: "document.uploaded" },
  team_members: { create: "team.member_added" },
  subcontractors: {
    create: "subcontractor.created",
    update: "subcontractor.updated",
  },
  submittals: {
    create: "submittal.created",
    update: "submittal.updated",
    statusMap: { approved: "submittal.approved", rejected: "submittal.rejected" },
  },
  suppliers: {
    create: "supplier.created",
    update: "supplier.updated",
    delete: "supplier.deleted",
  },
};

/**
 * Emit a webhook event asynchronously (fire-and-forget).
 * Non-blocking: does not affect the HTTP response.
 */
function emitWebhookEvent(orgId, companyId, tableName, action, record) {
  try {
    const tableMap = WEBHOOK_EVENT_MAP[tableName];
    if (!tableMap) return;

    let event = tableMap[action];
    if (!event) return;

    // Check for status-based event mapping (e.g. invoice.paid, rfi.overdue)
    if (action === "update" && tableMap.statusMap && record?.status) {
      const statusEvent = tableMap.statusMap[record.status];
      if (statusEvent) event = statusEvent;
    }

    // Async import to avoid circular dependency at module load time
    import("./webhooks.js")
      .then(({ emitEvent }) => {
        emitEvent(orgId, companyId, event, {
          table: tableName,
          action,
          record,
        }).catch((emitErr) => {
          console.error("[Generic] Webhook emit failed:", emitErr.message);
        });
      })
      .catch((importErr) => {
        console.error(
          "[Generic] Failed to import webhooks module:",
          importErr.message,
        );
      });
  } catch (err) {
    console.error("[Generic] Webhook emission failed:", err.message);
    // Never let webhook emission affect HTTP response
  }
}

// Per-table column whitelists — prevents column-name injection
const ALLOWED_COLUMNS = {
  projects: [
    "name",
    "client",
    "status",
    "progress",
    "budget",
    "spent",
    "start_date",
    "end_date",
    "manager",
    "location",
    "type",
    "phase",
    "workers",
    "contract_value",
    "description",
    "organization_id",
    "company_id",
  ],
  invoices: [
    "number",
    "client",
    "project_id",
    "project",
    "amount",
    "vat",
    "cis_deduction",
    "status",
    "issue_date",
    "due_date",
    "description",
    "payment_terms",
    "bank_account",
    "notes",
    "organization_id",
    "company_id",
  ],
  safety_incidents: [
    "type",
    "title",
    "severity",
    "status",
    "project_id",
    "project",
    "reported_by",
    "reported_by_name",
    "date",
    "location",
    "description",
    "root_cause",
    "corrective_actions",
    "injured_party",
    "immediate_actions",
    "riddor_reportable",
    "injury_type",
    "body_part_affected",
    "days_lost",
    "witness_name",
    "target_closure_date",
    "organization_id",
    "company_id",
  ],
  rfis: [
    "number",
    "title",
    "project_id",
    "project",
    "rfi_number",
    "subject",
    "question",
    "answer",
    "priority",
    "status",
    "submitted_by",
    "submitted_date",
    "due_date",
    "assigned_to",
    "response",
    "discipline",
    "notes",
    "ball_in_court",
    "cost_impact",
    "schedule_impact",
    "organization_id",
    "company_id",
  ],
  change_orders: [
    "number",
    "co_number",
    "project_id",
    "project",
    "title",
    "description",
    "amount",
    "value",
    "status",
    "submitted_date",
    "approved_date",
    "reason",
    "schedule_impact",
    "days_extension",
    "rejection_reason",
    "cost_change",
    "schedule_change",
    "type",
    "organization_id",
    "company_id",
  ],
  team_members: [
    "name",
    "role",
    "trade",
    "trade_type",
    "email",
    "phone",
    "status",
    "cis_status",
    "utr_number",
    "ni_number",
    "hours_this_week",
    "rams_completed",
    "notes",
    "daily_rate",
    "cscs_card",
    "cscs_expiry",
    "cscs_type",
    "organization_id",
    "company_id",
  ],
  equipment: [
    "name",
    "type",
    "registration",
    "status",
    "location",
    "next_service",
    "daily_rate",
    "hire_period",
    "category",
    "serial_number",
    "ownership",
    "inspection_due",
    "mewp_check",
    "project_id",
    "supplier",
    "notes",
    "organization_id",
    "company_id",
  ],
  subcontractors: [
    "company",
    "trade",
    "contact",
    "email",
    "phone",
    "status",
    "cis_verified",
    "cis_status",
    "insurance_expiry",
    "rams_approved",
    "rams_status",
    "current_project",
    "contract_value",
    "rating",
    "utr_number",
    "address",
    "notes",
    "organization_id",
    "company_id",
  ],
  documents: [
    "name",
    "type",
    "project_id",
    "project",
    "uploaded_by",
    "version",
    "size",
    "status",
    "category",
    "discipline",
    "file_url",
    "date_issued",
    "author",
  ],
  timesheets: [
    "worker_id",
    "worker",
    "project_id",
    "project",
    "week",
    "regular_hours",
    "overtime_hours",
    "daywork_hours",
    "total_pay",
    "status",
    "cis_deduction",
    "notes",
    "organization_id",
    "company_id",
  ],
  meetings: [
    "title",
    "meeting_type",
    "project_id",
    "project",
    "date",
    "time",
    "location",
    "attendees",
    "agenda",
    "minutes",
    "actions",
    "status",
    "link",
    "organization_id",
    "company_id",
  ],
  materials: [
    "name",
    "category",
    "quantity",
    "unit",
    "unit_cost",
    "total_cost",
    "supplier",
    "project_id",
    "project",
    "status",
    "delivery_date",
    "po_number",
    "order_date",
    "notes",
    "organization_id",
    "company_id",
  ],
  punch_list: [
    "project_id",
    "project",
    "location",
    "description",
    "assigned_to",
    "priority",
    "status",
    "due_date",
    "photos",
    "trade",
    "item_number",
    "category",
    "resolution",
    "notes",
    "organization_id",
    "company_id",
  ],
  inspections: [
    "type",
    "project_id",
    "project",
    "inspector",
    "date",
    "status",
    "score",
    "items",
    "next_inspection",
    "title",
    "location",
    "notes",
    "findings",
    "corrective_actions",
    "organization_id",
    "company_id",
  ],
  rams: [
    "title",
    "project_id",
    "project",
    "activity",
    "doc_type",
    "version",
    "status",
    "created_by",
    "approved_by",
    "review_date",
    "hazards",
    "method_statement",
    "ppe",
    "signatures",
    "required",
    "risk_level",
    "valid_from",
    "valid_until",
    "controls",
    "reviewed_by",
    "likelihood",
    "severity",
    "notes",
    "organization_id",
    "company_id",
  ],
  cis_returns: [
    "contractor",
    "utr",
    "period",
    "gross_payment",
    "materials_cost",
    "labour_net",
    "cis_deduction",
    "cis_rate",
    "status",
    "verification_status",
    "payment_date",
    "notes",
    "organization_id",
    "company_id",
  ],
  tenders: [
    "title",
    "client",
    "value",
    "deadline",
    "status",
    "probability",
    "type",
    "location",
    "ai_score",
    "notes",
    "stage",
    "result_date",
    "organization_id",
    "company_id",
  ],
  contacts: [
    "name",
    "company",
    "role",
    "email",
    "phone",
    "type",
    "value",
    "last_contact",
    "status",
    "projects",
    "address",
    "website",
    "notes",
    "rating",
    "organization_id",
    "company_id",
  ],
  risk_register: [
    "title",
    "project_id",
    "project",
    "category",
    "likelihood",
    "impact",
    "risk_score",
    "owner",
    "status",
    "mitigation",
    "review_date",
    "notes",
    "contingency",
    "description",
    "organization_id",
    "company_id",
  ],
  purchase_orders: [
    "number",
    "supplier",
    "project_id",
    "project",
    "amount",
    "status",
    "order_date",
    "delivery_date",
    "items",
    "notes",
    "category",
    "organization_id",
    "company_id",
  ],
  daily_reports: [
    "project_id",
    "project",
    "report_date",
    "prepared_by",
    "weather",
    "temperature",
    "workers_on_site",
    "activities",
    "materials",
    "equipment",
    "issues",
    "photos",
    "progress",
    "temp_high",
    "temp_low",
    "delays",
    "safety_observations",
    "visitors",
    "status",
    "submitted_by",
    "organization_id",
    "company_id",
  ],
  variations: [
    "ref",
    "title",
    "project_id",
    "project",
    "subcontractor",
    "status",
    "type",
    "value",
    "original_value",
    "impact",
    "submitted_date",
    "responded_date",
    "description",
    "reason",
    "affected_items",
    "approval_chain",
    "documents",
  ],
  defects: [
    "reference",
    "title",
    "project_id",
    "project",
    "location",
    "description",
    "priority",
    "status",
    "trade",
    "raised_by",
    "assigned_to",
    "due_date",
    "closed_date",
    "photos",
    "cost",
    "category",
  ],
  valuations: [
    "reference",
    "project_id",
    "project",
    "application_number",
    "period_start",
    "period_end",
    "status",
    "contractor_name",
    "client_name",
    "original_value",
    "variations",
    "total_value",
    "retention",
    "amount_due",
    "submitted_date",
    "certified_date",
    "certified_by",
    "notes",
    "organization_id",
    "company_id",
  ],
  specifications: [
    "reference",
    "title",
    "project_id",
    "project",
    "section",
    "version",
    "status",
    "description",
    "specifications",
    "materials",
    "standards",
    "approved_by",
    "approved_date",
  ],
  temp_works: [
    "reference",
    "title",
    "project_id",
    "project",
    "description",
    "type",
    "status",
    "location",
    "design_by",
    "approved_by",
    "design_date",
    "approval_date",
    "erected_by",
    "erected_date",
    "inspected_by",
    "inspected_date",
    "load_capacity",
    "notes",
  ],
  signage: [
    "reference",
    "project_id",
    "project",
    "type",
    "description",
    "location",
    "size",
    "material",
    "quantity",
    "status",
    "required_date",
    "installed_date",
    "installed_by",
    "notes",
  ],
  waste_management: [
    "reference",
    "project_id",
    "project",
    "waste_type",
    "carrier",
    "license_number",
    "skip_number",
    "collection_date",
    "quantity",
    "unit",
    "cost",
    "disposal_site",
    "waste_code",
    "status",
    "notes",
  ],
  sustainability: [
    "project_id",
    "project",
    "metric_type",
    "target",
    "actual",
    "unit",
    "period",
    "status",
    "notes",
  ],
  training: [
    "reference",
    "title",
    "project_id",
    "project",
    "type",
    "provider",
    "duration",
    "cost",
    "attendees",
    "status",
    "scheduled_date",
    "completed_date",
    "certification",
    "expiry_date",
    "notes",
  ],
  certifications: [
    "reference",
    "company",
    "certification_type",
    "body",
    "grade",
    "expiry_date",
    "status",
    "renewal_date",
    "cost",
    "scope",
    "accreditation_number",
    "notes",
  ],
  prequalification: [
    "reference",
    "contractor",
    "project_id",
    "project",
    "questionnaire_type",
    "status",
    "score",
    "approved_by",
    "approved_date",
    "expiry_date",
    "documents",
    "sections_completed",
    "total_sections",
    "notes",
  ],
  lettings: [
    "reference",
    "project_id",
    "project",
    "package_name",
    "trade",
    "status",
    "tender_closing_date",
    "award_date",
    "contractor",
    "contract_value",
    "notes",
  ],
  measuring: [
    "reference",
    "project_id",
    "project",
    "survey_type",
    "location",
    "status",
    "surveyor",
    "survey_date",
    "completed_date",
    "areas",
    "total_area",
    "unit",
    "notes",
  ],
  site_permits: [
    "permit_number",
    "type",
    "site",
    "issued_by",
    "issued_to",
    "from_date",
    "to_date",
    "status",
    "project_id",
    "description",
    "renewal_date",
    "document_id",
    "apply_date",
    "reminder_date",
    "notes",
    "priority",
    "reminder_sent",
    "organization_id",
    "company_id",
  ],
  equipment_service_logs: [
    "equipment_id",
    "date",
    "type",
    "technician",
    "notes",
    "next_due",
  ],
  equipment_hire_logs: [
    "equipment_id",
    "name",
    "company",
    "daily_rate",
    "start_date",
    "end_date",
    "project",
    "status",
  ],
  maintenance_schedules: [
    "equipment_id",
    "project_id",
    "title",
    "maintenance_type",
    "priority",
    "status",
    "description",
    "scheduled_date",
    "due_date",
    "completed_date",
    "estimated_hours",
    "actual_hours",
    "technician",
    "assigned_to",
    "recurring_schedule",
    "parent_schedule_id",
    "checklist",
    "parts_used",
    "cost_estimate",
    "actual_cost",
    "downtime_hours",
    "notes",
    "qr_code",
    "photos",
    "documents",
    "created_by",
    "updated_by",
    "organization_id",
    "company_id",
  ],
  risk_mitigation_actions: [
    "risk_id",
    "title",
    "owner",
    "due_date",
    "status",
    "progress",
  ],
  contact_interactions: ["contact_id", "type", "date", "note"],
  safety_permits: [
    "permit_no",
    "type",
    "project",
    "location",
    "start_date",
    "end_date",
    "issued_by",
    "status",
  ],
  permit_renewals: [
    "permit_id",
    "previous_end_date",
    "new_end_date",
    "previous_status",
    "new_status",
    "renewed_by",
    "notes",
  ],
  permit_inspections: [
    "permit_id",
    "inspection_id",
  ],
  toolbox_talks: [
    "date",
    "topic",
    "location",
    "presenter",
    "attendees",
    "signed_off",
  ],
  drawing_transmittals: ["project", "issued_to", "date", "purpose", "status"],
  site_inspections: [
    "name",
    "status",
    "description",
    "category",
    "severity",
    "resolution",
    "due_date",
    "project_id",
    "inspector",
    "location",
    "findings",
    "corrective_actions",
    "scheduled_date",
    "completed_date",
  ],
  ai_vision_logs: [
    "organization_id",
    "company_id",
    "project_id",
    "image_url",
    "analysis_result",
    "confidence_score",
    "processed_at",
  ],
  submittals: [
    "project_id",
    "number",
    "title",
    "description",
    "type",
    "status",
    "ball_in_court",
    "responsible_company",
    "responsible_person",
    "due_date",
    "submitted_date",
    "approved_date",
    "reviewer",
    "linked_drawing_id",
    "linked_spec_id",
    "linked_rfi_id",
    "attachments",
    "comments",
    "distribution_list",
    "official_response",
    "created_by",
    "updated_by",
    "organization_id",
    "company_id",
  ],
  project_templates: [
    "name",
    "description",
    "type",
    "default_budget",
    "default_duration_days",
    "default_phase_order",
    "custom_fields",
    "tasks",
    "checklists",
    "is_shared",
    "is_default",
    "created_by",
    "updated_by",
    "organization_id",
    "company_id",
  ],
  suppliers: [
    "name",
    "contact_name",
    "email",
    "phone",
    "address",
    "website",
    "tax_id",
    "status",
    "rating",
    "category",
    "payment_terms",
    "notes",
    "insurance_expiry",
    "compliance_status",
    "organization_id",
    "company_id",
  ],
  project_phases: [
    "project_id",
    "organization_id",
    "company_id",
    "name",
    "description",
    "sequence_order",
    "status",
    "progress",
    "budget_allocated",
    "budget_spent",
    "start_date",
    "end_date",
    "actual_start_date",
    "actual_end_date",
    "color",
    "dependencies",
    "gates",
    "created_by",
    "updated_by",
  ],
};

const VALID_ORDER_COLS = new Set([
  "id",
  "created_at",
  "updated_at",
  "name",
  "status",
  "date",
  "title",
  "project",
  "priority",
  "severity",
  "type",
  "submitted_date",
  "due_date",
  "start_date",
  "end_date",
  "amount",
  "value",
  "cost",
  "contract_value",
]);

const SUPER_ADMIN_ROLES = new Set(["super_admin", "company_owner"]);

/**
 * @returns {'all'|'tenant'|'company'|'deny'}
 * - all: super_admin — no org filter (sees everything)
 * - tenant: scoped to organization_id
 * - company: company_owner with null organization_id — scoped by company_id via COALESCE
 * - deny: authenticated but missing both organization_id and company_id
 */
function getTenantScope(req) {
  if (!req.user) return "deny";
  if (req.user.role === "super_admin") return "all";
  if (req.user.organization_id) return "tenant";
  // company_owner (or any user) with null organization_id but valid company_id
  if (req.user.company_id) return "company";
  return "deny";
}

/**
 * Creates a standard CRUD router for any table.
 * @param {string} tableName - The PostgreSQL table name
 * @param {string} [orderCol='created_at'] - Column to order by
 */
function makeRouter(tableName, orderCol = "created_at") {
  if (!ALLOWED_COLUMNS[tableName]) {
    throw new Error(`Table "${tableName}" not allowed`);
  }
  const safeOrderCol = VALID_ORDER_COLS.has(orderCol) ? orderCol : "created_at";
  const router = express.Router();
  router.use(authMiddleware);
  const allowed = ALLOWED_COLUMNS[tableName];

  function filterKeys(data) {
    return Object.keys(data).filter(
      (k) => allowed.includes(k) && data[k] !== undefined,
    );
  }

  function buildFilterAndParams(req) {
    const scope = getTenantScope(req);
    if (scope === "all") return { filter: "", params: [] };
    if (scope === "deny") return { filter: " WHERE 1=0", params: [] };
    if (scope === "company")
      return {
        filter: " WHERE company_id = $1",
        params: [req.user.company_id],
      };
    return {
      filter: " WHERE organization_id = $1",
      params: [req.user.organization_id],
    };
  }

  /**
   * @param {number} nextParamIndex - First $n for this WHERE (use keys.length + 1 on UPDATE so SET keeps $1..$n)
   */
  function buildFilterWithId(req, nextParamIndex) {
    const scope = getTenantScope(req);
    if (scope === "all") {
      return {
        filter: ` WHERE id = $${nextParamIndex}`,
        params: [req.params.id],
      };
    }
    if (scope === "deny") {
      return { filter: " WHERE 1=0", params: [] };
    }
    const tenantPl = nextParamIndex;
    const idPl = nextParamIndex + 1;
    if (scope === "company") {
      return {
        filter: ` WHERE company_id = $${tenantPl} AND id = $${idPl}`,
        params: [req.user.company_id, req.params.id],
      };
    }
    return {
      filter: ` WHERE organization_id = $${tenantPl} AND id = $${idPl}`,
      params: [req.user.organization_id, req.params.id],
    };
  }

  // GET / — list all (paginated)
  router.get("/", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        1000,
        Math.max(1, parseInt(req.query.limit, 10) || 100),
      );
      const offset = (page - 1) * limit;
      const { filter, params: filterParams } = buildFilterAndParams(req);
      const queryParams = [...filterParams, limit, offset];
      const paramLimit = filterParams.length + 1;
      const paramOffset = filterParams.length + 2;
      const { rows } = await pool.query(
        `SELECT * FROM ${tableName}${filter} ORDER BY ${safeOrderCol} DESC LIMIT $${paramLimit} OFFSET $${paramOffset}`,
        queryParams,
      );
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM ${tableName}${filter}`,
        filterParams,
      );
      res.json({
        data: rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total, 10),
          pages: Math.ceil(parseInt(countResult.rows[0].total, 10) / limit),
        },
      });
    } catch (err) {
      console.error(`[GET ${tableName}]`, err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /:id — get one
  router.get("/:id", async (req, res) => {
    try {
      const { filter, params } = buildFilterWithId(req, 1);
      const { rows } = await pool.query(
        `SELECT * FROM ${tableName}${filter}`,
        params,
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error(`[GET ${tableName}/:id]`, err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST / — create
  router.post("/", async (req, res) => {
    // Normalise camelCase → snake_case for known aliases
    const body = { ...req.body };
    if ("aiScore" in body) {
      body.ai_score = body.aiScore;
      delete body.aiScore;
    }

    // Zod validate payload (strips unknown keys, type-checks values)
    const payloadValidation = safeParse(buildCrudPayloadSchema(allowed), body);
    if (!payloadValidation.valid) {
      return res.status(400).json({ message: payloadValidation.error });
    }
    const validatedBody = payloadValidation.data;

    const keys = filterKeys(validatedBody);
    if (!keys.length)
      return res.status(400).json({ message: "No valid fields provided" });

    // Validate required fields
    const { valid, missing } = validateRequiredFields(tableName, validatedBody);
    if (!valid) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(", ")}`,
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Guard: prevent inserts without tenant scoping (OAuth users without profile)
    if (!req.user?.organization_id && !req.user?.company_id) {
      return res.status(400).json({
        message: "User profile incomplete. Please complete your profile setup.",
      });
    }

    const cols = keys.join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => validatedBody[k]);

    // Auto-inject tenant columns on insert
    let colSuffix = "";
    let valSuffix = "";
    const tenantValues = [];
    if (req.user) {
      if (req.user.organization_id) {
        colSuffix += ", organization_id";
        valSuffix += `, $${values.length + tenantValues.length + 1}`;
        tenantValues.push(req.user.organization_id);
      }
      if (req.user.company_id) {
        colSuffix += ", company_id";
        valSuffix += `, $${values.length + tenantValues.length + 1}`;
        tenantValues.push(req.user.company_id);
      }
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO ${tableName} (${cols}${colSuffix}) VALUES (${placeholders}${valSuffix}) RETURNING *`,
        [...values, ...tenantValues],
      );
      broadcastDashboardUpdate("create", tableName, rows[0]);
      // Emit webhook asynchronously (non-blocking)
      const orgId = req.user?.organization_id;
      const companyId = req.user?.company_id;
      setImmediate(() =>
        emitWebhookEvent(orgId, companyId, tableName, "create", rows[0]),
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(`[POST ${tableName}]`, err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PUT /:id — update
  router.put("/:id", async (req, res) => {
    // Zod validate payload (strips unknown keys, type-checks values)
    const payloadValidation = safeParse(buildCrudPayloadSchema(allowed), req.body);
    if (!payloadValidation.valid) {
      return res.status(400).json({ message: payloadValidation.error });
    }
    const validatedBody = payloadValidation.data;

    const keys = filterKeys(validatedBody);
    if (!keys.length)
      return res.status(400).json({ message: "No valid fields provided" });

    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = [...keys.map((k) => validatedBody[k])];

    const { filter, params: filterParams } = buildFilterWithId(
      req,
      keys.length + 1,
    );
    values.push(...filterParams);

    try {
      const { rows } = await pool.query(
        `UPDATE ${tableName} SET ${setClause}${filter} RETURNING *`,
        values,
      );
      if (!rows[0]) return res.status(404).json({ message: "Not found" });
      broadcastDashboardUpdate("update", tableName, rows[0]);
      // Emit webhook asynchronously (non-blocking)
      const orgId = req.user?.organization_id;
      const companyId = req.user?.company_id;
      setImmediate(() =>
        emitWebhookEvent(orgId, companyId, tableName, "update", rows[0]),
      );
      res.json(rows[0]);
    } catch (err) {
      console.error(`[PUT ${tableName}]`, err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /:id
  router.delete("/:id", async (req, res) => {
    try {
      const { filter, params } = buildFilterWithId(req, 1);
      const oldRows = await pool.query(
        `SELECT * FROM ${tableName}${filter}`,
        params,
      );
      if (!oldRows.rowCount)
        return res.status(404).json({ message: "Not found" });
      const { rowCount } = await pool.query(
        `DELETE FROM ${tableName}${filter}`,
        params,
      );
      broadcastDashboardUpdate("delete", tableName, oldRows.rows[0]);
      res.json({ message: "Deleted successfully" });
    } catch (err) {
      console.error(`[DELETE ${tableName}]`, err.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
}

module.exports = makeRouter;

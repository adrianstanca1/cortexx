const express = require("express");
const authMiddleware = require("../middleware/auth");
const pool = require("../db");
const { broadcastDashboardUpdate } = require("../lib/ws-broadcast");
const { checkPermission } = require("../middleware/auth");

const router = express.Router();

/* ── Helpers ───────────────────────────────────────────────────── */
function getTenantClause(req) {
  const user = req.user;
  if (!user) return null;
  if (user.role === "super_admin") return { clause: "", values: [] };
  if (user.organization_id) {
    return { clause: "organization_id = $1", values: [user.organization_id] };
  }
  if (user.company_id) {
    return { clause: "company_id = $1", values: [user.company_id] };
  }
  return { clause: "company_id = $1", values: [user.id] };
}

/* ── List ──────────────────────────────────────────────────────── */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tenant = getTenantClause(req);
    let sql = "SELECT * FROM suppliers";
    const params = [];
    if (tenant.clause) {
      sql += ` WHERE ${tenant.clause}`;
      params.push(...tenant.values);
    }
    sql += " ORDER BY name ASC";
    const { rows } = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    console.error("[Suppliers] list error:", err.message);
    res.status(500).json({ message: "Failed to list suppliers" });
  }
});

/* ── Get one ───────────────────────────────────────────────────── */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = getTenantClause(req);
    let sql = "SELECT * FROM suppliers WHERE id = $1";
    const params = [id];
    if (tenant.clause) {
      sql += ` AND ${tenant.clause}`;
      params.push(...tenant.values);
    }
    const { rows } = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ message: "Supplier not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[Suppliers] get error:", err.message);
    res.status(500).json({ message: "Failed to get supplier" });
  }
});

/* ── Create ────────────────────────────────────────────────────── */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const {
      name, contact_name, email, phone, address, website, tax_id,
      status, rating, category, payment_terms, notes, insurance_expiry, compliance_status,
    } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    const orgId = user.organization_id || null;
    const companyId = user.company_id || user.id;
    const { rows } = await pool.query(
      `INSERT INTO suppliers (organization_id, company_id, name, contact_name, email, phone, address, website, tax_id, status, rating, category, payment_terms, notes, insurance_expiry, compliance_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [orgId, companyId, name, contact_name, email, phone, address, website, tax_id, status || "active", rating || 0, category, payment_terms, notes, insurance_expiry, compliance_status || "pending"],
    );
    broadcastDashboardUpdate("suppliers", "create", rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[Suppliers] create error:", err.message);
    res.status(500).json({ message: "Failed to create supplier" });
  }
});

/* ── Update ────────────────────────────────────────────────────── */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = getTenantClause(req);
    const allowed = ["name","contact_name","email","phone","address","website","tax_id","status","rating","category","payment_terms","notes","insurance_expiry","compliance_status"];
    const sets = [];
    const values = [];
    allowed.forEach((col) => {
      if (req.body[col] !== undefined) {
        sets.push(`${col} = $${values.length + 1}`);
        values.push(req.body[col]);
      }
    });
    if (!sets.length) return res.status(400).json({ message: "No valid fields to update" });
    let sql = `UPDATE suppliers SET ${sets.join(", ")} WHERE id = $${values.length + 1}`;
    values.push(id);
    if (tenant.clause) {
      sql += ` AND ${tenant.clause}`;
      values.push(...tenant.values);
    }
    sql += " RETURNING *";
    const { rows } = await pool.query(sql, values);
    if (!rows.length) return res.status(404).json({ message: "Supplier not found" });
    broadcastDashboardUpdate("suppliers", "update", rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error("[Suppliers] update error:", err.message);
    res.status(500).json({ message: "Failed to update supplier" });
  }
});

/* ── Delete ─────────────────────────────────────────────────────── */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = getTenantClause(req);
    let sql = "DELETE FROM suppliers WHERE id = $1";
    const params = [id];
    if (tenant.clause) {
      sql += ` AND ${tenant.clause}`;
      params.push(...tenant.values);
    }
    const { rowCount } = await pool.query(sql, params);
    if (!rowCount) return res.status(404).json({ message: "Supplier not found" });
    broadcastDashboardUpdate("suppliers", "delete", { id });
    res.status(204).end();
  } catch (err) {
    console.error("[Suppliers] delete error:", err.message);
    res.status(500).json({ message: "Failed to delete supplier" });
  }
});

/* ── Analytics / Dashboard ──────────────────────────────────────── */
router.get("/analytics/summary", authMiddleware, async (req, res) => {
  try {
    const tenant = getTenantClause(req);
    let base = "FROM suppliers";
    const params = [];
    if (tenant.clause) {
      base += ` WHERE ${tenant.clause}`;
      params.push(...tenant.values);
    }
    const { rows } = await pool.query(
      `SELECT
        (SELECT COUNT(*) ${base}) AS total,
        (SELECT COUNT(*) ${base} AND status='active') AS active,
        (SELECT COUNT(*) ${base} AND compliance_status='compliant') AS compliant,
        (SELECT COUNT(*) ${base} AND compliance_status='expired') AS expired,
        (SELECT COALESCE(AVG(rating),0) ${base}) AS avg_rating,
        (SELECT COUNT(*) ${base} AND insurance_expiry < CURRENT_DATE + INTERVAL '30 days') AS insurance_due
      `,
      params,
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("[Suppliers] analytics error:", err.message);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

/* ── Supplier purchase history ─────────────────────────────────── */
router.get("/:id/history", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = getTenantClause(req);
    let sql = `SELECT id, number, amount, status, order_date, delivery_date FROM purchase_orders WHERE supplier_id = $1`;
    const params = [id];
    if (tenant.clause) {
      sql += ` AND ${tenant.clause}`;
      params.push(...tenant.values);
    }
    sql += " ORDER BY order_date DESC LIMIT 50";
    const { rows } = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    console.error("[Suppliers] history error:", err.message);
    res.status(500).json({ message: "Failed to load history" });
  }
});

module.exports = router;

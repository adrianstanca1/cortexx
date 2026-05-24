const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

function generateKey() {
  return "cb_" + crypto.randomBytes(32).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

router.get(
  "/",
  authMiddleware,
  checkPermission("integrations", "read"),
  async (req, res) => {
    const user = req.user;
    const orgId = user.organization_id;
    const companyId = user.company_id;
    try {
      const result = await pool.query(
        `SELECT id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at, created_by
         FROM api_keys
         WHERE COALESCE(organization_id, company_id) = COALESCE($1, $2)
         ORDER BY created_at DESC`,
        [orgId, companyId]
      );
      res.json({ data: result.rows });
    } catch (err) {
      console.error("[API Keys] List error:", err.message);
      res.status(500).json({ message: "Failed to list API keys" });
    }
  }
);

router.post(
  "/",
  authMiddleware,
  checkPermission("integrations", "create"),
  async (req, res) => {
    const user = req.user;
    const orgId = user.organization_id;
    const companyId = user.company_id;
    const { name, scopes = [], expiresAt } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }
    const key = generateKey();
    const prefix = key.slice(0, 8);
    const hash = sha256(key);
    try {
      const result = await pool.query(
        `INSERT INTO api_keys (organization_id, company_id, name, key_hash, key_prefix, scopes, expires_at, created_by)
         VALUES (COALESCE($1, $2), $2, $3, $4, $5, $6::jsonb, $7, $8)
         RETURNING id, name, key_prefix, scopes, is_active, expires_at, created_at`,
        [orgId, companyId, name.trim(), hash, prefix, JSON.stringify(scopes), expiresAt || null, user.id]
      );
      const row = result.rows[0];
      res.status(201).json({ data: { ...row, key } });
    } catch (err) {
      console.error("[API Keys] Create error:", err.message);
      res.status(500).json({ message: "Failed to create API key" });
    }
  }
);

router.patch(
  "/:id",
  authMiddleware,
  checkPermission("integrations", "update"),
  async (req, res) => {
    const { id } = req.params;
    const { name, scopes, isActive, expiresAt } = req.body;
    const user = req.user;
    const orgId = user.organization_id;
    const companyId = user.company_id;
    try {
      const existing = await pool.query(
        `SELECT id FROM api_keys WHERE id=$1 AND COALESCE(organization_id, company_id) = COALESCE($2, $3)`,
        [id, orgId, companyId]
      );
      if (existing.rows.length === 0) return res.status(404).json({ message: "Not found" });
      const updates = [];
      const values = [];
      let idx = 1;
      if (name !== undefined) { updates.push(`name=$${idx++}`); values.push(name); }
      if (scopes !== undefined) { updates.push(`scopes=$${idx++}::jsonb`); values.push(JSON.stringify(scopes)); }
      if (isActive !== undefined) { updates.push(`is_active=$${idx++}`); values.push(isActive); }
      if (expiresAt !== undefined) { updates.push(`expires_at=$${idx++}`); values.push(expiresAt); }
      if (updates.length === 0) return res.status(400).json({ message: "No fields to update" });
      values.push(id);
      const q = `UPDATE api_keys SET ${updates.join(", ")} WHERE id=$${idx} RETURNING id, name, key_prefix, scopes, is_active, expires_at, updated_at`;
      const result = await pool.query(q, values);
      res.json({ data: result.rows[0] });
    } catch (err) {
      console.error("[API Keys] Update error:", err.message);
      res.status(500).json({ message: "Failed to update API key" });
    }
  }
);

router.delete(
  "/:id",
  authMiddleware,
  checkPermission("integrations", "delete"),
  async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const orgId = user.organization_id;
    const companyId = user.company_id;
    try {
      const result = await pool.query(
        `DELETE FROM api_keys WHERE id=$1 AND COALESCE(organization_id, company_id) = COALESCE($2, $3) RETURNING id`,
        [id, orgId, companyId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Not found" });
      res.json({ data: { id } });
    } catch (err) {
      console.error("[API Keys] Delete error:", err.message);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  }
);

module.exports = router;

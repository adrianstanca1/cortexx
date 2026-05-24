const pool = require('../db');

async function logAudit({ auth, action, entityType, entityId, oldData, newData, ipAddress }) {
  try {
    const changes = oldData || newData ? { old: oldData, new: newData } : null;
    await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, changes, ip_address, organization_id, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        auth?.id || auth?.userId || null,
        action,
        entityType,
        entityId || null,
        changes ? JSON.stringify(changes) : null,
        ipAddress || null,
        auth?.organization_id || null,
        auth?.company_id || null,
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };

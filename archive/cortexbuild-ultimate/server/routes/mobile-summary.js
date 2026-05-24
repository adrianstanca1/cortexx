const express = require("express");
const authMiddleware = require("../middleware/auth");
const pool = require("../db");
const router = express.Router();

router.use(authMiddleware);

// GET /api/mobile/summary — stats for MobileHome field worker dashboard
router.get("/summary", async (req, res) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.organization_id || req.user?.company_id;

    const thisWeek = new Date();
    // Round to start of current ISO week (Monday)
    const dayOfWeek = thisWeek.getDay(); // 0=Sun
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(thisWeek);
    weekStart.setDate(thisWeek.getDate() + diff);
    const weekDate = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD

    const [tasksResult, permitsResult, hoursResult, defectsResult] =
      await Promise.allSettled([
        // Open tasks for this org (with optional user filter)
        pool.query(
          `SELECT COUNT(*) as count FROM project_tasks
         WHERE status NOT IN ('done','completed','closed')
         AND (organization_id = $1 OR company_id = $1)`,
          [orgId],
        ),

        // Active safety permits for this org
        pool.query(
          `SELECT COUNT(*) as count FROM safety_permits
         WHERE status IN ('active','approved')
         AND (organization_id = $1 OR company_id = $1)`,
          [orgId],
        ),

        // Hours logged this week by this worker (timesheets uses worker_id + week)
        pool.query(
          `SELECT COALESCE(SUM(regular_hours + overtime_hours + daywork_hours), 0)::numeric(5,1) as hours
         FROM timesheets
         WHERE worker_id = $1 AND week = $2`,
          [userId, weekDate],
        ),

        // Open defects for this org
        pool.query(
          `SELECT COUNT(*) as count FROM defects
         WHERE status IN ('open','in_progress')
         AND (organization_id = $1 OR company_id = $1)`,
          [orgId],
        ),
      ]);

    // Log any rejected queries and return 503 so the client knows data is incomplete
    const rejected = [
      tasksResult,
      permitsResult,
      hoursResult,
      defectsResult,
    ].filter((r) => r.status === "rejected");
    if (rejected.length > 0) {
      rejected.forEach((r) =>
        console.error(
          "[GET /api/mobile/summary] query failed:",
          r.reason?.message,
        ),
      );
      return res
        .status(503)
        .json({ error: "Database query failed", unavailable: true });
    }

    const getValue = (result, field) => {
      if (result.status === "fulfilled") {
        return result.value?.rows?.[0]?.[field] ?? 0;
      }
      return 0;
    };

    res.json({
      tasks: Number(getValue(tasksResult, "count")),
      permits: Number(getValue(permitsResult, "count")),
      hours: Number(getValue(hoursResult, "hours")),
      defects: Number(getValue(defectsResult, "count")),
    });
  } catch (err) {
    console.error("[GET /api/mobile/summary]", err.message);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

// GET /api/mobile/project-location?project_id=UUID
// Returns lat/lon for the GPS radius check on clock-in
router.get("/project-location", async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.json({ latitude: null, longitude: null });

    const result = await pool.query(
      "SELECT latitude, longitude FROM projects WHERE id = $1 LIMIT 1",
      [project_id],
    );
    const row = result.rows[0];
    res.json({
      latitude: row?.latitude ?? null,
      longitude: row?.longitude ?? null,
    });
  } catch (err) {
    console.error("[GET /api/mobile/project-location]", err.message);
    res.json({ latitude: null, longitude: null }); // non-fatal: GPS check gracefully skips
  }
});

module.exports = router;

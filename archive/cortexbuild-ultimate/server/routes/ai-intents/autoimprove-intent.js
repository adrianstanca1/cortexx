/**
 * server/routes/ai-intents/autoimprove-intent.js
 * Intent handler for on-demand autoimprove requests.
 * Triggers immediate analysis rather than waiting for scheduled run.
 */
const pool = require('../../db');
const { analyzeAndRecommend } = require('../../lib/autoimprove-analyser');

/**
 * Handle autoimprove intent — run immediate analysis and return results.
 * @param {string} query - User message (may contain project context)
 * @param {object} user - req.user
 * @returns {Promise<{reply: string, recommendations: Array}>}
 */
async function handleAutoimprove(query, user) {
  // Extract project name/ID if mentioned
  const projectMatch = query.match(/project[:\s]+([a-f0-9-]{36})/i);
  const projectId = projectMatch ? projectMatch[1] : null;

  const orgId = user.organization_id || null;
  const companyId = user.company_id || null;

  // Get or create schedule for thresholds
  const tid = orgId || companyId;
  let schedule = null;
  if (tid) {
    const { rows } = await pool.query(`
      SELECT budget_threshold, safety_threshold, defect_threshold
      FROM autoimprove_schedules
      WHERE COALESCE(organization_id, company_id) = $1
      LIMIT 1
    `, [tid]);
    schedule = rows[0] || { budget_threshold: 5, safety_threshold: 3, defect_threshold: 10 };
  } else {
    schedule = { budget_threshold: 5, safety_threshold: 3, defect_threshold: 10 };
  }

  const result = await analyzeAndRecommend(orgId, companyId, schedule);

  if (result.recommendations.length === 0 && result.atRiskItems.length === 0) {
    return {
      reply: 'All metrics look healthy. No significant issues or trends requiring attention at this time.',
      recommendations: [],
    };
  }

  // Format recommendations for display
  const lines = [];
  for (const rec of result.recommendations.slice(0, 5)) {
    const severity = rec.severity.toUpperCase();
    lines.push(`[${severity}] ${rec.recommendation}`);
  }

  if (result.atRiskItems.length > 0) {
    lines.push('---');
    lines.push(`**At-Risk Items (${result.atRiskItems.length}):**`);
    for (const item of result.atRiskItems.slice(0, 3)) {
      lines.push(`  - ${item.projectName}: ${item.details} (${item.severity})`);
    }
  }

  const reply = `Autoimprove analysis complete — ${result.recommendations.length} recommendation(s) found:\n\n${lines.join('\n')}`;

  // Store recommendations in DB
  if (tid) {
    try {
      for (const rec of result.recommendations) {
        await pool.query(`
          INSERT INTO autoimprove_recommendations
            (organization_id, company_id, project_id, type, severity, recommendation, auto_actions, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        `, [
          orgId,
          companyId,
          rec.projectId,
          rec.type,
          rec.severity,
          rec.recommendation,
          JSON.stringify(rec.autoActions || []),
        ]);
      }
    } catch (err) {
      console.warn('[autoimprove-intent] Failed to persist recommendations:', err.message);
    }
  }

  return { reply, recommendations: result.recommendations };
}

module.exports = { handleAutoimprove };

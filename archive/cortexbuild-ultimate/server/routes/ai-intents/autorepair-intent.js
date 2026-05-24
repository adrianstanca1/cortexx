/**
 * server/routes/ai-intents/autorepair-intent.js
 * Intent handler for on-demand infrastructure diagnosis.
 * Does NOT auto-execute — just diagnoses and recommends.
 */
const pool = require('../../db');
const { diagnose } = require('../../lib/autorepair-diagnoser');

/**
 * Handle autorepair intent — diagnose infrastructure issues on demand.
 * @param {string} query - User message describing the issue
 * @param {object} user - req.user
 * @returns {Promise<{reply: string, diagnosis?: object}>}
 */
async function handleAutorepair(query, user) {
  const lower = query.toLowerCase();

  // Determine likely incident type from query
  let incidentType = 'container_unhealthy';
  if (/ollama|llm|embedding|model/i.test(lower)) incidentType = 'ollama_down';
  else if (/rag|vector|embed|search/i.test(lower)) incidentType = 'rag_embedding_failed';
  else if (/intent|classif|ai.*wrong|misclass/i.test(lower)) incidentType = 'intent_misclassify';
  else if (/cache|redis/i.test(lower)) incidentType = 'cache_corrupt';

  // Gather recent error context from audit_log
  let errorContext = { errorCount: 0, lastError: '', sampleErrors: [] };
  try {
    const { rows } = await pool.query(`
      SELECT id, action, details, created_at
      FROM audit_log
      WHERE action LIKE '%error%' OR action LIKE '%fail%'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    if (rows.length > 0) {
      errorContext = {
        errorCount: rows.length,
        lastError: rows[0]?.details || rows[0]?.action || '',
        sampleErrors: rows.slice(0, 5).map(r => ({ action: r.action, details: r.details })),
      };
    }
  } catch {
    // audit_log might not exist or have different schema — proceed without it
  }

  const diagnosis = await diagnose(incidentType, errorContext, user.id);

  // Format reply
  const lines = [
    `**Diagnosis:** ${diagnosis.diagnosis}`,
    `**Root Cause:** ${diagnosis.rootCause}`,
    `**Confidence:** ${(diagnosis.confidence * 100).toFixed(0)}%`,
  ];

  if (diagnosis.suggestedActions.length > 0) {
    lines.push('---');
    lines.push('**Recommended Actions:**');
    for (const action of diagnosis.suggestedActions.slice(0, 5)) {
      lines.push(`  - \`${action.action}\` — ${action.reason}`);
    }
  } else {
    lines.push('No repair actions available for this incident type.');
  }

  const reply = `Autorepair diagnostic report:\n\n${lines.join('\n')}`;

  return { reply, diagnosis };
}

module.exports = { handleAutorepair };

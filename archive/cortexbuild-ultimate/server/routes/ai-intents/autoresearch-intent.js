/**
 * server/routes/ai-intents/autoresearch-intent.js
 * Intent handler for deep research requests.
 * Creates a research job and returns immediately with jobId for polling.
 */
const pool = require('../../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Handle autoresearch intent.
 * @param {string} query - User's research question
 * @param {object} user - req.user object { id, organization_id, company_id, role }
 * @returns {Promise<{reply: string, jobId: string, status: string}>}
 */
async function handleAutoresearch(query, user) {
  // Validate query
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 5) {
    return {
      reply: 'Please provide a more specific research question.',
      jobId: null,
      status: 'rejected',
    };
  }

  // Check for duplicate recent job (same query within 5 minutes)
  const recentWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { rows: recent } = await pool.query(`
    SELECT id, status FROM autoresearch_jobs
    WHERE user_id = $1
      AND query = $2
      AND created_at > $3
      AND status IN ('pending', 'processing')
    ORDER BY created_at DESC
    LIMIT 1
  `, [user.id, trimmedQuery, recentWindow]);

  if (recent.length > 0) {
    return {
      reply: `A research job for "${trimmedQuery}" is already in progress. Fetching results...`,
      jobId: recent[0].id,
      status: recent[0].status,
    };
  }

  // Determine depth from query complexity
  let depth = 'medium';
  if (/superficial|quick|brief|shallow/i.test(trimmedQuery)) depth = 'shallow';
  else if (/comprehensive|deep|exhaustive|thorough|all.*data/i.test(trimmedQuery)) depth = 'deep';

  // Create research job
  const { rows } = await pool.query(`
    INSERT INTO autoresearch_jobs (user_id, organization_id, company_id, query, depth, status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING id
  `, [user.id, user.organization_id || null, user.company_id || null, trimmedQuery, depth]);

  const jobId = rows[0].id;

  return {
    reply: `Research job created for "${trimmedQuery}" (depth: ${depth}). I'll notify you when the analysis is complete.`,
    jobId,
    status: 'pending',
  };
}

module.exports = { handleAutoresearch };

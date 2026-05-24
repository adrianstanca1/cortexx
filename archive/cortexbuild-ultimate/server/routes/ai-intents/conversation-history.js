const pool = require('../../db');
const { summarizeText } = require("../../lib/unified-ai-client-v2");

const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES || '20', 10);
const SUMMARY_THRESHOLD    = parseInt(process.env.SUMMARY_THRESHOLD    || '30', 10);

/**
 * Fetch conversation history for a session, newest-first, with oldest summarized.
 * Returns { messages: [{role, content}], summary: string|null }
 */
async function getConversationHistory(organizationId, companyId, sessionId, limit = 60) {
  // Determine the tenant column to query — prefer organization_id, fall back to company_id
  const tenantId = organizationId || companyId;
  if (!tenantId) {
    return { messages: [], summary: null };
  }
  const colName = organizationId ? 'organization_id' : 'company_id';
  const { rows } = await pool.query(
    `SELECT id, role, content, created_at FROM ai_conversations
     WHERE ${colName} = $1 AND session_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [tenantId, sessionId, limit]
  );
  if (!rows.length) return { messages: [], summary: null };

  const chronological = rows.reverse();
  const totalMsgs = chronological.length;

  if (totalMsgs <= SUMMARY_THRESHOLD) {
    return {
      messages: chronological.map(m => ({ role: m.role, content: m.content })),
      summary: null,
    };
  }

  const recentRaw    = chronological.slice(-MAX_CONTEXT_MESSAGES);
  const olderMsgs    = chronological.slice(0, -MAX_CONTEXT_MESSAGES);

  const summaryParts = olderMsgs
    .filter(m => m.content && m.content.length > 10)
    .slice(-20)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 150)}${m.content.length > 150 ? '…' : ''}`)
    .join('\n');

  let summary = null;
  if (summaryParts) {
    try {
      summary = await summarizeText(
        `[Prior conversation (${olderMsgs.length} messages summarized)]\n${summaryParts}`
      );
    } catch (e) {
      console.warn('[AI] Summarization failed, using raw fallback:', e.message);
      summary = olderMsgs
        .filter(m => m.content)
        .slice(0, 5)
        .map(m => `[${m.role}]: ${m.content.split('\n')[0].substring(0, 120)}`)
        .join(' | ');
    }
  }

  return {
    messages: recentRaw.map(m => ({ role: m.role, content: m.content })),
    summary,
  };
}

/**
 * Truncate history by estimated token count to stay within budget.
 * Each character ≈ 0.25 tokens; we use 4 chars per token for safety.
 */
function truncateToTokenBudget(messages, userMsgContent, systemContext, maxTokens = 28000) {
  const systemTokens = Math.ceil((systemContext.length + 200) / 4);
  const userTokens   = Math.ceil(userMsgContent.length / 4);
  const budget       = maxTokens - systemTokens - userTokens - 500;

  const result = [];
  let usedTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m    = messages[i];
    const cost = Math.ceil(m.content.length / 4);
    if (usedTokens + cost > budget) break;
    result.unshift(m);
    usedTokens += cost;
  }

  return result;
}

module.exports = {
  getConversationHistory,
  truncateToTokenBudget,
  MAX_CONTEXT_MESSAGES,
  SUMMARY_THRESHOLD,
};

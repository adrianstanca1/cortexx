/**
 * server/lib/autorepair-diagnoser.js
 * LLM-powered diagnostic reasoning for infrastructure failures.
 * Falls back to rule-based diagnosis if Ollama is unavailable.
 */
const { getOllamaResponse } = require('../routes/ai-intents/ollama-client');

/**
 * Diagnose an incident given its type and error context.
 * @param {string} incidentType - Type of incident (ollama_down, rag_embedding_failed, etc.)
 * @param {object} errorContext - { errorCount, windowMinutes, lastError, sampleErrors }
 * @param {string} userId - User requesting diagnosis
 * @returns {Promise<{diagnosis: object}>}
 */
async function diagnose(incidentType, errorContext, userId) {
  const { errorCount = 0, windowMinutes = 30, lastError = '', sampleErrors = [] } = errorContext;

  const contextText = `
Incident Type: ${incidentType}
Error count in last ${windowMinutes} minutes: ${errorCount}
Last error: ${lastError}
Sample errors (last 5):
${sampleErrors.slice(0, 5).map((e, i) => `  ${i + 1}. ${JSON.stringify(e)}`).join('\n')}
`;

  const prompt = `You are a DevOps infrastructure diagnostic assistant for CortexBuild, a UK construction management SaaS.

Infrastructure stack: Express.js API, PostgreSQL 16 with pg_vector, Redis 7, Ollama (local LLM), Nginx reverse proxy, Docker containers.

Given the following incident, provide a diagnosis with:
1. **diagnosis** — What's likely causing this
2. **rootCause** — The underlying reason
3. **confidence** — How confident you are (0.0-1.0)
4. **suggestedActions** — Ordered list of {action, reason} to fix the issue

Available repair actions (MUST use only these, do not suggest other actions):
- test_ollama: Test if Ollama service is reachable
- test_rag_embeddings: Test if RAG embedding pipeline is working
- clear_rag_cache: Delete corrupted/low-quality RAG vectors
- reembed_table: Re-trigger embedding for a specific source table
- clear_redis_cache: Flush Redis cache keys matching a pattern

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "diagnosis": "what is happening",
  "rootCause": "underlying cause",
  "confidence": 0.0-1.0,
  "suggestedActions": [
    {"action": "test_ollama", "reason": "verify Ollama is reachable"}
  ]
}`;

  try {
    const raw = await getOllamaResponse(
      `${prompt}\n\nIncident data:\n${contextText}`,
      '',
      [],
      null,
      {
        model: process.env.AUTOREPAIR_MODEL || 'kimi-k2.6:cloud',
        timeoutMs: Number(process.env.AUTOREPAIR_TIMEOUT_MS) || 60000,
        numPredict: Number(process.env.AUTOREPAIR_NUM_PREDICT) || 2048,
        temperature: 0.2,
      }
    );

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('No JSON found');
    }

    return {
      diagnosis: parsed.diagnosis || 'Unknown',
      rootCause: parsed.rootCause || parsed.diagnosis || 'Unknown',
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions.filter(a => a.action && typeof a.action === 'string')
        : [],
    };
  } catch (err) {
    console.warn('[autorepair-diagnoser] LLM diagnosis failed, falling back to rule-based:', err.message);
    return ruleBasedDiagnosis(incidentType, errorContext);
  }
}

/**
 * Rule-based fallback when Ollama is down.
 */
function ruleBasedDiagnosis(incidentType, errorContext) {
  const { errorCount = 0, lastError = '' } = errorContext;

  const rules = {
    ollama_down: {
      diagnosis: 'Ollama service is unreachable',
      rootCause: 'Ollama HTTP endpoint not responding',
      confidence: 0.9,
      suggestedActions: [
        { action: 'test_ollama', reason: 'Confirm Ollama is unreachable' },
      ],
    },
    rag_embedding_failed: {
      diagnosis: 'RAG embedding pipeline is failing',
      rootCause: 'getEmbedding() returned null or threw an error',
      confidence: 0.85,
      suggestedActions: [
        { action: 'test_rag_embeddings', reason: 'Test if embeddings are working' },
        { action: 'clear_rag_cache', reason: 'Remove corrupted embedding vectors' },
      ],
    },
    intent_misclassify: {
      diagnosis: 'AI intent classifier is frequently misclassifying',
      rootCause: 'User queries do not match any known intent patterns',
      confidence: 0.7,
      suggestedActions: [
        { action: 'clear_redis_cache', reason: 'Clear stale intent classification cache' },
      ],
    },
    container_unhealthy: {
      diagnosis: 'A Docker container is unhealthy or stopped',
      rootCause: 'Container process crashed or health check failed',
      confidence: 0.8,
      suggestedActions: [
        { action: 'test_ollama', reason: 'Check if API container can reach Ollama' },
      ],
    },
    cache_corrupt: {
      diagnosis: 'Redis cache contains stale or corrupted data',
      rootCause: 'Cache entries are causing unexpected API behavior',
      confidence: 0.75,
      suggestedActions: [
        { action: 'clear_redis_cache', reason: 'Flush potentially corrupted cache entries' },
      ],
    },
  };

  const rule = rules[incidentType] || {
    diagnosis: `Unknown incident type: ${incidentType}`,
    rootCause: 'Unable to determine root cause',
    confidence: 0.3,
    suggestedActions: [],
  };

  if (errorCount > 10) {
    rule.confidence = Math.min(0.95, rule.confidence + 0.1);
  }

  if (lastError.includes('ECONNREFUSED') || lastError.includes('ETIMEDOUT')) {
    rule.suggestedActions.unshift(
      { action: 'test_ollama', reason: 'Network-level connection failure detected' }
    );
  }

  return rule;
}

module.exports = { diagnose, ruleBasedDiagnosis };

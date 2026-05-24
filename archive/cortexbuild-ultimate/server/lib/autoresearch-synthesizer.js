/**
 * server/lib/autoresearch-synthesizer.js
 * Synthesizes RAG search results into structured research findings using LLM.
 */
const { getOllamaResponse } = require('../routes/ai-intents/ollama-client');

/**
 * Synthesize raw RAG search results into structured findings.
 * @param {string} researchQuery - The original user query
 * @param {Array} ragResults - Array of { table, matches: [{row_id, chunk_text, similarity}] }
 * @param {string} userId
 * @returns {Promise<{findings: Array, confidence: number, dataGaps: string[], sources: Array}>}
 */
async function synthesizeResults(researchQuery, ragResults, userId) {
  // Build context string from RAG results
  const contextParts = ragResults.map(({ table, matches }) => {
    const chunks = matches.map(m => `  [${table}:${m.row_id}] (similarity: ${m.similarity})\n${m.chunk_text}`).join('\n\n');
    return `## ${table}\n${chunks}`;
  });

  const contextText = contextParts.join('\n\n');
  const totalMatches = ragResults.reduce((s, r) => s + r.matches.length, 0);

  if (totalMatches === 0) {
    return {
      findings: [],
      confidence: 0,
      dataGaps: ['No relevant data found matching the query in any searchable tables.'],
      sources: [],
    };
  }

  // Average similarity as base confidence
  const allSimilarities = ragResults.flatMap(r => r.matches.map(m => m.similarity));
  const avgSimilarity = allSimilarities.reduce((a, b) => a + b, 0) / allSimilarities.length;
  // Scale: similarity 0.5→0.3 confidence, similarity 0.9→0.95 confidence
  const baseConfidence = 0.3 + (avgSimilarity * 0.65);

  // Group sources by table for deduplication
  const sources = ragResults.map(({ table, matches }) => ({
    table,
    count: matches.length,
    rowIds: matches.map(m => m.row_id),
  }));

  const synthesisPrompt = `You are a research synthesis assistant. A user asked: "${researchQuery}"

You have retrieved ${totalMatches} relevant data chunks from the CortexBuild database across ${ragResults.length} tables. Your task is to synthesize these into:

1. **Key Findings** — A list of 3-8 concrete, factual findings directly supported by the retrieved data. Each finding should be a single concise statement (1-2 sentences). Do NOT speculate beyond what the data supports.

2. **Confidence Score** — A number from 0.0 to 1.0 reflecting how well the retrieved data answers the research query. Low confidence (0.3-0.5) if few results or low similarity. High confidence (0.8-0.95) if many high-quality matches.

3. **Data Gaps** — Areas where the retrieved data is insufficient or silent. Be specific about what additional information would help.

Retrieved data:
${contextText}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "findings": ["finding 1", "finding 2", ...],
  "confidence": 0.0-1.0,
  "dataGaps": ["gap description 1", "gap description 2", ...]
}`;

  try {
    const raw = await getOllamaResponse(
      synthesisPrompt,
      '',
      [],
      null
    );

    // Try to extract JSON from the response
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try extracting JSON block
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    }

    // Validate structure
    if (!Array.isArray(parsed.findings)) parsed.findings = [];
    if (typeof parsed.confidence !== 'number') parsed.confidence = baseConfidence;
    if (!Array.isArray(parsed.dataGaps)) parsed.dataGaps = [];

    // Cap findings at reasonable length
    parsed.findings = parsed.findings.map(f => String(f).substring(0, 500));
    parsed.dataGaps = parsed.dataGaps.map(g => String(g).substring(0, 300));

    return {
      findings: parsed.findings,
      confidence: Math.min(1, Math.max(0, parsed.confidence || baseConfidence)),
      dataGaps: parsed.dataGaps.length ? parsed.dataGaps : [],
      sources,
    };
  } catch (err) {
    console.error('[autoresearch-synthesizer] Synthesis failed:', err.message);
    // Fallback: return raw RAG results as findings with low confidence
    return {
      findings: ragResults.flatMap(r =>
        r.matches.map(m => `[${r.table}] ${m.chunk_text.substring(0, 200)}...`)
      ),
      confidence: avgSimilarity * 0.5,
      dataGaps: ['LLM synthesis failed — showing raw RAG results. ' + err.message],
      sources,
    };
  }
}

module.exports = { synthesizeResults };

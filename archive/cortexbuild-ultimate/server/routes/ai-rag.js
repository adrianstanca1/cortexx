/**
 * server/routes/ai-rag.js
 * RAG-augmented AI chat endpoint.
 * POST /api/rag-chat  — receives a question, retrieves relevant context, streams synthesis.
 *
 * Body: { question, history?: [{role, content}], tables?: string[] }
 */
const express  = require('express');
const pool      = require('../db');
const authMw   = require('../middleware/auth');
const https    = require('https');
const http     = require('http');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const LLM_MODEL   = process.env.LLM_MODEL  || process.env.OLLAMA_MODEL || 'qwen3.5:latest';

const router  = express.Router();
router.use(authMw);

const ALLOWED_TABLES = new Set([
  'projects', 'invoices', 'rfis', 'contacts', 'documents',
  'safety_incidents', 'change_orders', 'team_members',
  'subcontractors', 'equipment', 'materials', 'meetings',
  'timesheets', 'punch_list', 'inspections', 'rams',
  'tenders', 'risk_register', 'purchase_orders', 'daily_reports'
]);

function tenantFilter(req) {
  if (!req.user) return { clause: ' AND 1=0', params: [] };
  if (req.user.role === 'super_admin' || req.user.role === 'company_owner') return { clause: '', params: [] };
  const scope = req.user.organization_id || req.user.company_id;
  if (scope) return { clause: ' AND COALESCE(organization_id, company_id) = $1', params: [scope] };
  console.warn('[RAG] tenantFilter: user has no organization_id or company_id:', req.user.id, 'role:', req.user.role);
  return { clause: ' AND 1=0', params: [] };
}

function buildContextPrompt(contextItems) {
  if (!contextItems || contextItems.length === 0) return '';
  let prompt = '\n\nRelevant context from your data:\n';
  for (const item of contextItems) {
    const entries = Object.entries(item.data)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${String(v)}`)
      .slice(0, 20)
      .join(' | ');
    prompt += `- [${item.table}] ${entries}\n`;
  }
  return prompt;
}

async function getEmbedding(text) {
  return new Promise((resolve, reject) => {
    const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest';
    const body = JSON.stringify({ model, prompt: text });
    const url    = new URL(OLLAMA_HOST + '/api/embeddings');
    const isHttps = url.protocol === 'https:';
    const lib    = isHttps ? https : http;
    const port   = url.port || (isHttps ? 443 : 11434);

    const req = lib.request({
      hostname: url.hostname, port, path: '/api/embeddings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.embedding) return resolve(parsed.embedding);
          if (parsed.error) return reject(new Error('Ollama error: ' + parsed.error));
          reject(new Error('Ollama returned no embedding for model ' + model));
        } catch (e) {
          reject(new Error('Ollama returned invalid JSON: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', (err) => reject(new Error('Embedding service unavailable: ' + err.message)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Embedding service timed out after 30s')); });
    req.write(body); req.end();
  });
}

async function retrieveContext(question, tables, orgFilter) {
  let embedding;
  try {
    embedding = await getEmbedding(question);
  } catch (embedErr) {
    console.error('[RAG] getEmbedding failed:', embedErr.message);
    throw embedErr;
  }
  if (!embedding) return [];

  const { clause: filterClause, params: filterParams } = orgFilter;
  const context = [];

  for (const table of tables) {
    // Determine the starting index for $N placeholders in this table's queries
    // rag_embeddings query: $1 = embedding, $2 = table_name, then filter params
    const embeddingParam = JSON.stringify(embedding);
    const ragParams = [embeddingParam, table, ...filterParams];
    const filterWithAnd = filterClause ? filterClause.replace(/^ AND/, 'AND') : '';

    const { rows } = await pool.query(
      `SELECT row_id, (embedding <=> $1) AS similarity
       FROM rag_embeddings
       WHERE table_name = $2 ${filterWithAnd}
       ORDER BY embedding <=> $1
       LIMIT 5`,
      ragParams)
    .catch(err => { console.error('[RAG] retrieveContext: embedding query failed for table "' + table + '":', err.message); return { rows: [] }; });

    const validRows = rows.slice(0, 3).filter(r => (1 - parseFloat(r.similarity)) >= 0.5);
    if (validRows.length === 0) continue;

    const rowIds = validRows.map(r => r.row_id);
    const safeTable = table;
    const dataQueryParams = [rowIds, ...filterParams];
    const { rows: dataRows } = await pool.query(
      `SELECT * FROM ${safeTable} WHERE id = ANY($1)${filterClause}`,
      dataQueryParams)
    .catch(err => { console.error('[RAG] retrieveContext: data query failed for table "' + table + '":', err.message); return { rows: [] }; });

    const dataById = {};
    for (const row of dataRows) {
      dataById[row.id] = row;
    }

    for (const r of validRows) {
      if (dataById[r.row_id]) {
        context.push({ table, row_id: r.row_id, data: dataById[r.row_id] });
      }
    }
  }
  return context;
}

/** POST /api/rag-chat */
router.post('/', async (req, res) => {
  try {
    const { question, history = [], tables = [] } = req.body;
    if (!question || question.length < 2) {
      return res.status(400).json({ message: 'question is required (min 2 chars)' });
    }

    // Validate table names against whitelist
    const safeTables = (tables || []).filter(t => ALLOWED_TABLES.has(t));
    if (safeTables.length === 0 && tables.length > 0) {
      return res.status(400).json({ message: 'No valid tables specified' });
    }

    const orgFilterObj = tenantFilter(req);

    let contextItems = [];
    let embeddingError = null;
    if (safeTables.length) {
      try {
        contextItems = await retrieveContext(question, safeTables, orgFilterObj);
      } catch (embedErr) {
        embeddingError = embedErr.message;
        console.error('[RAG] retrieveContext failed:', embedErr.message);
      }
    }

    const systemPrompt = `You are a helpful construction management AI assistant. Answer questions using ONLY the provided context data. If the context doesn't contain enough information to answer, say so clearly. Be specific and reference actual values from the data.${embeddingError ? ' NOTE: The document search service is currently unavailable — the user may not be able to access project data. Mention this politely.' : ''}`;
    const contextPrompt = buildContextPrompt(contextItems);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user',   content: question + contextPrompt },
    ];

    const body = JSON.stringify({ model: LLM_MODEL, messages, stream: true });
    const url    = new URL(OLLAMA_HOST + '/api/chat');
    const isHttps = url.protocol === 'https:';
    const lib    = isHttps ? https : http;
    const port   = url.port || (isHttps ? 443 : 11434);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const ollamaReq = lib.request({
      hostname: url.hostname, port, path: '/api/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (ollamaRes) => {
      ollamaRes.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) res.write(parsed.message.content);
          } catch { /* skip non-JSON */ }
        }
      });
      ollamaRes.on('end', () => res.end());
    });

    ollamaReq.on('error', e => { console.error('[ai-rag]', e.message); res.end(); });
    ollamaReq.write(body);
    ollamaReq.end();
  } catch (err) {
    console.error('[ai-rag]', err.message);
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
    else res.end();
  }
});

module.exports = router;

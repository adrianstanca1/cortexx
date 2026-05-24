const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { buildTenantFilter, isSuperAdmin } = require('../middleware/tenantFilter');
const https = require('https');
const http = require('http');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest';

// Cosine similarity helper
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// Fetch embedding from Ollama
async function getEmbedding(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: EMBEDDING_MODEL, prompt: text });
    const url = new URL(OLLAMA_HOST + '/api/embeddings');
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 11434),
      path: '/api/embeddings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.embedding || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

const router = express.Router();
router.use(authMiddleware);

const SEARCHABLE_TABLES = [
  'projects',
  'invoices',
  'safety_incidents',
  'rfis',
  'change_orders',
  'team_members',
  'documents',
  'subcontractors',
  'contacts',
  'tenders',
  'rams',
  'meetings',
  'daily_reports',
];

router.get('/', async (req, res) => {
  try {
    const { q, limit = '20' } = req.query;
    if (!q || q.length < 2) {
      return res.json({
        results: { projects: [], invoices: [], contacts: [], rfis: [], documents: [], team: [] },
        total: 0,
        query: q || '',
        semanticResults: [],
        searchMode: 'text',
      });
    }

    const searchTerm = `%${q.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`;
    const results = { projects: [], invoices: [], contacts: [], rfis: [], documents: [], team: [] };
    const limitNum = parseInt(limit, 10);
    // We will start the semantic search concurrently with the DB queries
    let embeddingPromise = null;
    const doSemantic = req.query.semantic !== 'false' && q && q.length >= 2;
    if (doSemantic) {
      embeddingPromise = getEmbedding(q).catch(err => {
        console.warn('[Search] Embedding error:', err.message);
        return null;
      });
    }

    // Super_admin sees everything, others are scoped by tenant
    if (isSuperAdmin(req)) {
      const [
        projectResults,
        invoiceResults,
        contactResults,
        rfiResults,
        docResults,
        teamResults
      ] = await Promise.all([
        pool.query(
          `SELECT id, name, client, status, type FROM projects
           WHERE (LOWER(name) LIKE $1 OR LOWER(client) LIKE $1)
           ORDER BY created_at DESC LIMIT $2`,
          [searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, number, client, amount, status FROM invoices
           WHERE (LOWER(number) LIKE $1 OR LOWER(client) LIKE $1)
           ORDER BY created_at DESC LIMIT $2`,
          [searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, name, company, email, role FROM contacts
           WHERE (LOWER(name) LIKE $1 OR LOWER(company) LIKE $1 OR LOWER(email) LIKE $1)
           ORDER BY created_at DESC LIMIT $2`,
          [searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, number, subject, status, project FROM rfis
           WHERE (LOWER(number) LIKE $1 OR LOWER(subject) LIKE $1)
           ORDER BY created_at DESC LIMIT $2`,
          [searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, name, type, category, project FROM documents
           WHERE (LOWER(name) LIKE $1 OR LOWER(category) LIKE $1)
           ORDER BY created_at DESC LIMIT $2`,
          [searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, name, role, trade FROM team_members
           WHERE (LOWER(name) LIKE $1 OR LOWER(role) LIKE $1 OR LOWER(trade) LIKE $1)
           ORDER BY created_at DESC LIMIT $2`,
          [searchTerm, limitNum]
        )
      ]);

      results.projects = projectResults.rows;
      results.invoices = invoiceResults.rows;
      results.contacts = contactResults.rows;
      results.rfis = rfiResults.rows;
      results.documents = docResults.rows;
      results.team = teamResults.rows;
    } else {
      const { clause: tenantClause, params: tenantParams } = buildTenantFilter(req, 'AND');

      const [
        projectResults,
        invoiceResults,
        contactResults,
        rfiResults,
        docResults,
        teamResults
      ] = await Promise.all([
        pool.query(
          `SELECT id, name, client, status, type FROM projects
           WHERE 1=1${tenantClause} AND (LOWER(name) LIKE $${tenantParams.length + 1} OR LOWER(client) LIKE $${tenantParams.length + 1})
           ORDER BY created_at DESC LIMIT $${tenantParams.length + 2}`,
          [...tenantParams, searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, number, client, amount, status FROM invoices
           WHERE 1=1${tenantClause} AND (LOWER(number) LIKE $${tenantParams.length + 1} OR LOWER(client) LIKE $${tenantParams.length + 1})
           ORDER BY created_at DESC LIMIT $${tenantParams.length + 2}`,
          [...tenantParams, searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, name, company, email, role FROM contacts
           WHERE 1=1${tenantClause} AND (LOWER(name) LIKE $${tenantParams.length + 1} OR LOWER(company) LIKE $${tenantParams.length + 1} OR LOWER(email) LIKE $${tenantParams.length + 1})
           ORDER BY created_at DESC LIMIT $${tenantParams.length + 2}`,
          [...tenantParams, searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, number, subject, status, project FROM rfis
           WHERE 1=1${tenantClause} AND (LOWER(number) LIKE $${tenantParams.length + 1} OR LOWER(subject) LIKE $${tenantParams.length + 1})
           ORDER BY created_at DESC LIMIT $${tenantParams.length + 2}`,
          [...tenantParams, searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, name, type, category, project FROM documents
           WHERE 1=1${tenantClause} AND (LOWER(name) LIKE $${tenantParams.length + 1} OR LOWER(category) LIKE $${tenantParams.length + 1})
           ORDER BY created_at DESC LIMIT $${tenantParams.length + 2}`,
          [...tenantParams, searchTerm, limitNum]
        ),
        pool.query(
          `SELECT id, name, role, trade FROM team_members
           WHERE 1=1${tenantClause} AND (LOWER(name) LIKE $${tenantParams.length + 1} OR LOWER(role) LIKE $${tenantParams.length + 1} OR LOWER(trade) LIKE $${tenantParams.length + 1})
           ORDER BY created_at DESC LIMIT $${tenantParams.length + 2}`,
          [...tenantParams, searchTerm, limitNum]
        )
      ]);

      results.projects = projectResults.rows;
      results.invoices = invoiceResults.rows;
      results.contacts = contactResults.rows;
      results.rfis = rfiResults.rows;
      results.documents = docResults.rows;
      results.team = teamResults.rows;
    }

    const totalResults = Object.values(results).flat().length;

    // ── Semantic search with Ollama ────────────────────────────────────────
    let semanticResults = [];
    if (embeddingPromise) {
      try {
        const queryEmbedding = await embeddingPromise;
        if (queryEmbedding) {
          // Try to fetch stored embeddings and compute cosine similarity
          const semFilter = buildTenantFilter(req, 'AND', 'd');
          const semQuery = isSuperAdmin(req)
            ? `SELECT de.chunk_text, de.embedding_vector, de.file_id, d.name as file_name, d.type
               FROM document_embeddings de
               JOIN documents d ON d.id = de.file_id
               LIMIT 200`
            : `SELECT de.chunk_text, de.embedding_vector, de.file_id, d.name as file_name, d.type
               FROM document_embeddings de
               JOIN documents d ON d.id = de.file_id
               WHERE 1=1${semFilter.clause}
               LIMIT 200`;
          const { rows: chunks } = await pool.query(semQuery, semFilter.params);
          // Embeddings are stored as JSON arrays from Ollama
          const scored = chunks.map(row => {
            let emb = null;
            try { emb = JSON.parse(row.embedding_vector); } catch { /* skip */ }
            if (!emb || !Array.isArray(emb)) return null;
            return { ...row, score: cosineSimilarity(queryEmbedding, emb) };
          }).filter(Boolean);

          scored.sort((a, b) => b.score - a.score);
          semanticResults = scored.slice(0, 10).map(s => ({
            type: 'semantic',
            file_name: s.file_name,
            file_id: s.file_id,
            chunk_text: s.chunk_text,
            score: Math.round(s.score * 100) / 100,
            doc_type: s.type,
          }));
        }
      } catch (semErr) {
        console.warn('[Search] Semantic search skipped:', semErr.message);
      }
    }

    res.json({
      results,
      total: totalResults,
      query: q,
      semanticResults,
      searchMode: semanticResults.length ? 'hybrid' : 'text',
    });
  } catch (err) {
    console.error('[Global Search]', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

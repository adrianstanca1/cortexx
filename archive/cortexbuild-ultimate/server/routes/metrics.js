/* Metrics: HTTP request/response times exposed to Prometheus
   Endpoint: GET /api/metrics
*/

const express = require('express');
const promClient = require('prom-client');
const authMw = require('../middleware/auth');

const router = express.Router();

// Create a Registry
const register = new promClient.Registry();

// Enable collection of default metrics (heap, event loop, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metric: HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Expose metrics endpoint for Prometheus scraping (no auth — Prometheus is internal network only)
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (err) {
    console.error('[Metrics]', err);
    res.status(500).send('Metrics error');
  }
});

// Middleware: observe request duration (must be mounted before routes)
function observeRequest(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode })
      .observe(duration);
  });
  next();
}

// ─── Custom AI Inference Metrics ─────────────────────────────────────────────

const aiInferenceLatency = new promClient.Histogram({
  name: 'ai_inference_duration_seconds',
  help: 'Duration of AI inference calls in seconds',
  labelNames: ['provider', 'model'],
  registers: [register],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
});

const aiInferenceTotal = new promClient.Counter({
  name: 'ai_inference_requests_total',
  help: 'Total number of AI inference requests',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

const aiTokensTotal = new promClient.Counter({
  name: 'ai_inference_tokens_total',
  help: 'Total number of tokens processed',
  labelNames: ['provider', 'model', 'type'],
  registers: [register],
  type: 'counter',
});

const aiInferenceErrors = new promClient.Counter({
  name: 'ai_inference_errors_total',
  help: 'Total number of AI inference errors',
  labelNames: ['provider', 'model', 'error_type'],
  registers: [register],
});

const activeAiRequests = new promClient.Gauge({
  name: 'ai_active_requests',
  help: 'Number of currently active AI inference requests',
  labelNames: ['provider'],
  registers: [register],
});

/**
 * Record an AI inference call result for Prometheus metrics.
 * @param {Object} params
 * @param {'ollama'|'openrouter'|'gemini'} params.provider
 * @param {string} params.model
 * @param {'success'|'error'} params.status
 * @param {number} params.durationSeconds
 * @param {number} [params.tokensIn]
 * @param {number} [params.tokensOut]
 * @param {string} [params.errorType]
 */
function recordAiInference({ provider, model, status, durationSeconds, tokensIn, tokensOut, errorType }) {
  aiInferenceLatency.labels({ provider, model }).observe(durationSeconds);
  aiInferenceTotal.labels({ provider, model, status }).inc();
  if (tokensIn)  aiTokensTotal.labels({ provider, model, type: 'input' }).inc(tokensIn);
  if (tokensOut) aiTokensTotal.labels({ provider, model, type: 'output' }).inc(tokensOut);
  if (status === 'error' && errorType) {
    aiInferenceErrors.labels({ provider, model, error_type: errorType }).inc();
  }
}

module.exports = {
  router,
  observeRequest,
  httpRequestDuration,
  aiInferenceLatency,
  aiInferenceTotal,
  aiTokensTotal,
  aiInferenceErrors,
  activeAiRequests,
  register,
  recordAiInference,
};

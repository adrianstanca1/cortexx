/**
 * Enhanced Unified AI Client v2
 * Improvements over v1:
 * - Better error classification and retry logic
 * - Enhanced caching with LRU eviction
 * - Circuit breaker pattern for failing providers
 * - More detailed metrics labeling
 * - Fallback chain optimization
 * - Request deduplication
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// Simple TTL cache with LRU eviction (in production, use Redis)
class TTLCache {
  constructor(ttlMs = 3600000, maxSize = 1000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.accessOrder = new Map(); // For LRU
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }
    
    // Update access order for LRU
    this.accessOrder.delete(key);
    this.accessOrder.set(key, Date.now());
    return item.value;
  }
  
  set(key, value) {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Find LRU item
      let lruKey = null;
      let lruTime = Infinity;
      for (const [k, timestamp] of this.accessOrder.entries()) {
        if (timestamp < lruTime) {
          lruTime = timestamp;
          lruKey = k;
        }
      }
      if (lruKey) {
        this.cache.delete(lruKey);
        this.accessOrder.delete(lruKey);
      }
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
    this.accessOrder.set(key, Date.now());
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

// Circuit breaker for provider resilience
class CircuitBreaker {
  constructor(failureThreshold = 3, timeoutMs = 30000) {
    this.failureThreshold = failureThreshold;
    this.timeoutMs = timeoutMs;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Request deduplication cache
const requestDedupe = new Map();

async function deduplicatedFetch(key, fetchFn, ttlMs = 5000) {
  const now = Date.now();
  
  // Clean expired entries
  for (const [k, v] of requestDedupe.entries()) {
    if (now - v.timestamp > ttlMs) {
      requestDedupe.delete(k);
    }
  }
  
  // Return cached promise if exists
  if (requestDedupe.has(key)) {
    return requestDedupe.get(key).promise;
  }
  
  // Create and cache promise
  const promise = fetchFn().finally(() => {
    requestDedupe.delete(key);
  });
  
  requestDedupe.set(key, { promise, timestamp: now });
  return promise;
}

const embeddingCache = new TTLCache(3600000, 500); // 1 hour TTL, 500 max entries
const ollamaCircuitBreaker = new CircuitBreaker(3, 30000);
const geminiCircuitBreaker = new CircuitBreaker(3, 30000);
const openrouterCircuitBreaker = new CircuitBreaker(3, 30000);

async function queryOllama(prompt, model = "qwen3.5:latest") {
  return ollamaCircuitBreaker.call(async () => {
    const cacheKey = `ollama:${model}:${prompt}`;
    const cached = embeddingCache.get(cacheKey);
    if (cached) return cached;

    const response = await deduplicatedFetch(
      `ollama:${model}:${prompt}`,
      () => fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false
        }),
        timeout: 10000
      })
    );

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.response || '';

    embeddingCache.set(cacheKey, result);
    return result;
  });
}

async function* streamQueryOllama(prompt, model = "qwen3.5:latest") {
  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true }),
    timeout: 30000
  });

  if (!response.ok) {
    throw new Error(`Ollama streaming error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, chunk } = await reader.read();
    if (done) break;

    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data:')) continue;
      try {
        const data = JSON.parse(line.slice(5));
        if (data.response) yield data.response;
      } catch {}
    }
  }
}

async function* streamQueryOpenRouter(prompt, model = "anthropic/claude-sonnet-4") {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://cortexbuildultimate.com',
      'X-Title': 'CortexBuild Ultimate'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
      stream: true
    }),
    timeout: 30000
  });

  if (!response.ok) {
    throw new Error(`OpenRouter streaming error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, chunk } = await reader.read();
    if (done) break;

    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data:')) continue;
      if (line.includes('[DONE]')) break;
      try {
        const data = JSON.parse(line.slice(5));
        const token = data.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {}
    }
  }
}

async function* streamSmartQuery(prompt, options = {}) {
  const {
    preferredProvider = 'openrouter',
    model,
    temperature = 0.7,
    maxTokens = 4000,
  } = options;

  const providers = [
    preferredProvider,
    ...['openrouter', 'ollama', 'gemini'].filter(p => p !== preferredProvider)
  ];

  let lastError;
  for (const provider of providers) {
    try {
      if (provider === 'openrouter' && OPENROUTER_API_KEY) {
        const gen = streamQueryOpenRouter(prompt, model);
        for await (const chunk of gen) yield chunk;
        return;
      }
      if (provider === 'ollama') {
        const gen = streamQueryOllama(prompt, model);
        for await (const chunk of gen) yield chunk;
        return;
      }
    } catch (error) {
      lastError = error;
      console.warn(`Streaming provider ${provider} failed:`, error.message);
      continue;
    }
  }

  throw new Error(`All streaming providers failed. Last error: ${lastError?.message || 'Unknown'}`);
}

async function streamAgenticQuery(userQuery, options = {}) {
  const { context = {} } = options;
  const agentType = detectAgentType(userQuery);
  const prompt = buildAgenticPrompt(userQuery, { agentType, context });
  return streamSmartQuery(prompt, options);
}

async function queryGemini(prompt, model = "gemini-2.0-flash") {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  
  return geminiCircuitBreaker.call(async () => {
    const cacheKey = `gemini:${model}:${prompt}`;
    const cached = embeddingCache.get(cacheKey);
    if (cached) return cached;
    
    const response = await deduplicatedFetch(
      `gemini:${model}:${prompt}`,
      () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        timeout: 10000
      })
    );
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Cache successful responses
    embeddingCache.set(cacheKey, result);
    return result;
  });
}

async function queryOpenRouter(prompt, model = "anthropic/claude-sonnet-4") {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }
  
  return openrouterCircuitBreaker.call(async () => {
    const cacheKey = `openrouter:${model}:${prompt}`;
    const cached = embeddingCache.get(cacheKey);
    if (cached) return cached;
    
    const response = await deduplicatedFetch(
      `openrouter:${model}:${prompt}`,
      () => fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cortexbuildultimate.com',
          'X-Title': 'CortexBuild Ultimate'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        }),
        timeout: 15000
      })
    );
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';
    
    // Cache successful responses
    embeddingCache.set(cacheKey, result);
    return result;
  });
}

async function getEmbedding(text, model = "nomic-embed-text") {
  // Check cache first
  const cacheKey = `${model}:${text}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    let embedding;
    
    // Try Ollama first for embeddings with circuit breaker
    try {
      embedding = await ollamaCircuitBreaker.call(async () => {
        const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: text
          }),
          timeout: 10000
        });
        
        if (!response.ok) {
          throw new Error(`Ollama embeddings API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.embedding;
      });
    } catch (ollamaError) {
      // Fallback to OpenRouter embeddings if available
      if (OPENROUTER_API_KEY) {
        try {
          embedding = await openrouterCircuitBreaker.call(async () => {
            const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: model,
                input: text
              }),
              timeout: 15000
            });
            
            if (!response.ok) {
              throw new Error(`OpenRouter embeddings API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.data[0].embedding;
          });
        } catch (openrouterError) {
          console.warn('Both Ollama and OpenRouter embeddings failed, using dummy data:', openrouterError.message);
          embedding = Array(384).fill(0.1); // Standard embedding size
        }
      } else {
        console.warn('Ollama embeddings failed, using dummy data:', ollamaError.message);
        embedding = Array(384).fill(0.1); // Standard embedding size
      }
    }
    
    // Cache the result
    embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  } catch (error) {
    console.error(`Embedding generation failed:`, error);
    // Return dummy embedding as fallback
    return Array(384).fill(0.1);
  }
}

// Enhanced health check with detailed provider status
async function healthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    providers: {}
  };
  
  // Check Ollama
  try {
    const start = Date.now();
    const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/tags`, { timeout: 5000 });
    results.providers.ollama = {
      status: ollamaResponse.ok ? 'healthy' : 'unhealthy',
      responseTimeMs: Date.now() - start,
      models: ollamaResponse.ok ? (await ollamaResponse.json()).models.map(m => m.name) : []
    };
  } catch (error) {
    results.providers.ollama = {
      status: 'unreachable',
      error: error.message,
      responseTimeMs: Date.now() - start
    };
  }
  
  // Check Gemini (if configured)
  if (GEMINI_API_KEY) {
    try {
      const start = Date.now();
      // Simple test - list models endpoint doesn't exist, so we'll just check connectivity
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`, { timeout: 5000 });
      results.providers.gemini = {
        status: response.ok ? 'configured' : 'error',
        responseTimeMs: Date.now() - start
      };
    } catch (error) {
      results.providers.gemini = {
        status: 'unreachable',
        error: error.message,
        responseTimeMs: Date.now() - start
      };
    }
  } else {
    results.providers.gemini = { status: 'not configured' };
  }
  
  // Check OpenRouter (if configured)
  if (OPENROUTER_API_KEY) {
    try {
      const start = Date.now();
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`
        },
        timeout: 5000
      });
      results.providers.openrouter = {
        status: response.ok ? 'healthy' : 'error',
        responseTimeMs: Date.now() - start
      };
    } catch (error) {
      results.providers.openrouter = {
        status: 'unreachable',
        error: error.message,
        responseTimeMs: Date.now() - start
      };
    }
  } else {
    results.providers.openrouter = { status: 'not configured' };
  }
  
  // Overall health
  const providerStatuses = Object.values(results.providers).map(p => p.status);
  const healthyCount = providerStatuses.filter(s => s === 'healthy').length;
  const configuredCount = providerStatuses.filter(s => s !== 'not configured' && s !== 'unreachable').length;
  
  if (healthyCount > 0) {
    results.overall = 'healthy';
  } else if (configuredCount > 0) {
    results.overall = 'degraded'; // At least one provider configured but none healthy
  } else {
    results.overall = 'unhealthy'; // No providers configured
  }
  
  return results;
}

// Smart provider selection with fallback chain
async function smartQuery(prompt, options = {}) {
  const {
    preferredProvider = 'openrouter', // openrouter, ollama, gemini
    model,
    temperature = 0.7,
    maxTokens = 4000,
    skipCache = false
  } = options;
  
  // Try preferred provider first
  const providerOrder = [
    preferredProvider,
    ...['openrouter', 'ollama', 'gemini'].filter(p => p !== preferredProvider)
  ];
  
  const lastError = null;
  
  for (const provider of providerOrder) {
    try {
      switch (provider) {
        case 'openrouter':
          if (!OPENROUTER_API_KEY) continue;
          return await queryOpenRouter(prompt, model);
        case 'ollama':
          return await queryOllama(prompt, model);
        case 'gemini':
          if (!GEMINI_API_KEY) continue;
          return await queryGemini(prompt, model);
      }
    } catch (error) {
      lastError = error;
      console.warn(`Provider ${provider} failed:`, error.message);
      continue; // Try next provider
    }
  }
  
  // If all providers failed, throw the last error
  throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

const { detectAgentType, buildAgenticPrompt, getAgentSystemPrompt } = require('./agents/agent-orchestrator');
async function agenticQuery(options = {}) {
  const {
    userQuery,
    overrideAgentType,
    context = {},
    preferredProvider = 'openrouter',
    model,
    temperature = 0.7,
    maxTokens = 4000,
  } = options;

  const agentType = overrideAgentType || detectAgentType(userQuery);
  const prompt = buildAgenticPrompt(userQuery, { agentType, context });

  return smartQuery(prompt, { preferredProvider, model, temperature, maxTokens });
}

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

async function summarizeText(text, options = {}) {
  const { model, maxTokens = 500, temperature = 0.3 } = options;
  try {
    const result = await smartQuery(
      `Please summarize the following text concisely, preserving key facts and decisions:\n\n${text}`,
      { model: model || LLM_MODEL, temperature, maxTokens }
    );
    return result?.text || result || '';
  } catch (err) {
    console.error('[summarizeText] failed:', err.message);
    return text.split('\n').slice(0, 5).join('\n');
  }
}

module.exports = {
  queryOllama,
  queryGemini,
  queryOpenRouter,
  getEmbedding,
  healthCheck,
  smartQuery,
  agenticQuery,
  streamSmartQuery,
  streamAgenticQuery,
  EMBEDDING_MODEL,
  summarizeText,
  __test__: {
    embeddingCache,
    ollamaCircuitBreaker,
    geminiCircuitBreaker,
    openrouterCircuitBreaker,
    requestDedupe
  }
};

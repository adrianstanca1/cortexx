import type { VercelRequest, VercelResponse } from '../../types/vercel';
import fetch from 'node-fetch';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
const EXTERNAL_API_BASE_URL = 'https://generativelanguage.googleapis.com';

// Allowed hosts for SSRF protection (used for validation)
const ALLOWED_HOSTS_PATTERN = /^generativelanguage\.googleapis\.com$/;

// Allowed origins for CORS (set via environment variable in production)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://cortexbuildpro.com,https://www.cortexbuildpro.com').split(',');

/**
 * Validate and set CORS headers
 */
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Goog-Api-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Validate target path to prevent SSRF attacks
 */
function validateTargetPath(targetPath: string): { valid: boolean; error?: string } {
  // Block path traversal attempts
  if (targetPath.includes('..') || targetPath.includes('//')) {
    return { valid: false, error: 'Invalid path format' };
  }
  
  // Block internal IP addresses
  const internalPatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^0\.0\.0\.0/,
    /^localhost$/i,
  ];
  
  for (const pattern of internalPatterns) {
    if (pattern.test(targetPath)) {
      return { valid: false, error: 'Access to internal resources is not allowed' };
    }
  }
  
  return { valid: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    return res.status(200).end();
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    let targetPath = url.pathname.replace('/api/api-proxy', '');
    if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);

    if (!targetPath && req.query.path) {
        targetPath = req.query.path as string;
    }

    if (!targetPath) {
        return res.status(400).json({ error: 'No target path specified' });
    }

    // SSRF protection: validate target path
    const validation = validateTargetPath(targetPath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const apiUrl = `${EXTERNAL_API_BASE_URL}/${targetPath}${url.search}`;

    const outgoingHeaders: Record<string, string> = {};
    for (const header in req.headers) {
      if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(header.toLowerCase())) {
        outgoingHeaders[header] = req.headers[header] as string;
      }
    }

    outgoingHeaders['X-Goog-Api-Key'] = GEMINI_API_KEY;

    const fetchOptions: Record<string, unknown> = {
      method: req.method,
      headers: outgoingHeaders,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };

    if (!['GET', 'HEAD'].includes(req.method || '')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const apiResponse = await fetch(apiUrl, fetchOptions);

    // Forward headers
    apiResponse.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    const data = await apiResponse.buffer();
    return res.status(apiResponse.status).send(data);
  } catch (error: any) {
    console.error('Proxy Error:', error.message);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}

/**
 * CORS Middleware for CortexBuild Ultimate
 * 
 * Provides reusable CORS header handling for API endpoints.
 * Centralizes CORS configuration to prevent duplication.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * CORS configuration options.
 */
export interface CorsOptions {
  /** Allowed origins (default: from ALLOWED_ORIGINS env var) */
  allowedOrigins?: string[];
  /** Allowed methods (default: common HTTP methods) */
  allowedMethods?: string[];
  /** Allowed headers (default: common headers) */
  allowedHeaders?: string[];
  /** Max age for preflight cache (default: 86400 seconds) */
  maxAge?: number;
  /** Allow credentials (default: false) */
  allowCredentials?: boolean;
}

/**
 * Default CORS configuration.
 */
const DEFAULT_OPTIONS: CorsOptions = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://cortexbuildpro.com,https://www.cortexbuildpro.com').split(','),
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Goog-Api-Key', 'X-Requested-With'],
  maxAge: 86400,
  allowCredentials: false,
};

/**
 * Get the allowed origin for a given request origin.
 * Returns the origin if allowed, otherwise returns undefined.
 */
export function getAllowedOrigin(requestOrigin: string | undefined, options: CorsOptions = DEFAULT_OPTIONS): string | undefined {
  if (!requestOrigin) {
    return undefined;
  }

  // Allow specific origins
  if (options.allowedOrigins?.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development' && requestOrigin.includes('localhost')) {
    return requestOrigin;
  }

  return undefined;
}

/**
 * Apply CORS headers to a response.
 * Should be called for both regular requests and preflight OPTIONS requests.
 */
export function applyCorsHeaders(
  req: VercelRequest,
  res: VercelResponse,
  options: CorsOptions = DEFAULT_OPTIONS
): void {
  const requestOrigin = req.headers.origin;
  const allowedOrigin = getAllowedOrigin(requestOrigin, options);

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    // Vary header for proper caching with multiple origins
    res.setHeader('Vary', 'Origin');
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', options.allowedMethods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders?.join(', ') || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', options.maxAge?.toString() || '86400');

  if (options.allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

/**
 * CORS middleware handler.
 * Use this as the first handler in your API route to handle CORS.
 * 
 * @example
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   cors(req, res); // Handle CORS first
 *   // ... rest of your handler
 * }
 */
export function cors(req: VercelRequest, res: VercelResponse, options: CorsOptions = DEFAULT_OPTIONS): void {
  applyCorsHeaders(req, res, options);

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
}

/**
 * Creates a CORS middleware with custom options.
 * 
 * @example
 * const apiCors = createCors({
 *   allowedOrigins: ['https://api.example.com'],
 *   allowedMethods: ['GET', 'POST'],
 * });
 * 
 * export default async function handler(req, res) {
 *   apiCors(req, res);
 *   // ... handler logic
 * }
 */
export function createCors(options: CorsOptions) {
  return (req: VercelRequest, res: VercelResponse) => cors(req, res, options);
}

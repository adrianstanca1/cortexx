import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use in-memory limiter only: fake timers do not advance real Redis TTLs (would flake when REDIS_URL is set).
vi.mock('redis', () => ({
  createClient: () => ({
    connect: () => Promise.resolve(),
    on: () => {},
    isOpen: false,
  }),
}));

import rateLimiter, { RATE_LIMITER_MAX, RATE_LIMITER_WINDOW_MS } from '../../server/middleware/rateLimiter';

function createMockReq(path: string, token = 'Bearer test-token-12345') {
  return {
    path,
    headers: { authorization: token },
  } as unknown as { path: string; headers: { authorization?: string } };
}

function createMockRes() {
  const res: Record<string, unknown> = {};
  res.status = (code: number) => { Object.defineProperty(res, 'statusCode', { value: code, writable: true }); return res as typeof res & { statusCode: number }; };
  res.json = (body: unknown) => { Object.defineProperty(res, 'body', { value: body, writable: true }); return res as typeof res & { body: unknown }; };
  res.set = (headers: Record<string, unknown>) => { Object.assign(res, headers); return res as typeof res; };
  return res as unknown as { statusCode?: number; body?: unknown; set: (h: Record<string, unknown>) => typeof res; status: (c: number) => typeof res; json: (b: unknown) => typeof res };
}

describe('rateLimiter middleware', () => {
  beforeEach(() => {
    // Global vitest config only fakes setTimeout/interval; rateLimiter uses Date.now() for windows.
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows first request within limit', () => {
    const req = createMockReq('/api/projects');
    const res = createMockRes();
    const next = vi.fn();

    rateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  it('skips global rate limit for health, agent-debug, and metrics', () => {
    const paths = ['/api/health', '/api/agent-debug', '/api/metrics', '/api/metrics/foo'];
    for (const path of paths) {
      const req = createMockReq(path);
      const res = createMockRes();
      const next = vi.fn();
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeUndefined();
    }
  });

  it('blocks requests exceeding rate limit', () => {
    const req = createMockReq('/api/projects');
    const next = vi.fn();

    for (let i = 0; i < RATE_LIMITER_MAX; i++) {
      const res = createMockRes();
      rateLimiter(req, res, next);
    }

    const lastRes = createMockRes();
    rateLimiter(req, lastRes, next);

    expect(lastRes.statusCode).toBe(429);
    expect(lastRes.body).toHaveProperty('message');
  });

  it('tracks rate limits separately per token', () => {
    const req1 = createMockReq('/api/projects', 'Bearer token1');
    const req2 = createMockReq('/api/projects', 'Bearer token2');
    const next = vi.fn();

    for (let i = 0; i < RATE_LIMITER_MAX; i++) {
      rateLimiter(req1, createMockRes(), next);
    }

    const res2 = createMockRes();
    rateLimiter(req2, res2, next);

    expect(res2.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('tracks rate limits separately per path', () => {
    const req1 = createMockReq('/api/projects');
    const req2 = createMockReq('/api/safety');
    const next = vi.fn();

    for (let i = 0; i < RATE_LIMITER_MAX; i++) {
      rateLimiter(req1, createMockRes(), next);
    }

    const res2 = createMockRes();
    rateLimiter(req2, res2, next);

    expect(res2.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('resets after window expires', () => {
    const req = createMockReq('/api/projects');
    const next = vi.fn();

    for (let i = 0; i < RATE_LIMITER_MAX; i++) {
      rateLimiter(req, createMockRes(), next);
    }
    const blockedRes = createMockRes();
    rateLimiter(req, blockedRes, next);
    expect(blockedRes.statusCode).toBe(429);

    vi.advanceTimersByTime(RATE_LIMITER_WINDOW_MS);

    const allowedRes = createMockRes();
    rateLimiter(req, allowedRes, next);
    expect(allowedRes.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('has correct constants exported', () => {
    expect(RATE_LIMITER_MAX).toBe(100);
    expect(RATE_LIMITER_WINDOW_MS).toBe(60000);
  });
});

/**
 * Push token registration/management tests
 * Tests push token endpoints for registration, removal, and listing
 */

// Set DATABASE_URL to prevent db.js from calling process.exit
process.env.DATABASE_URL = 'postgresql://localhost/test';

const express = require('express');
const request = require('supertest');

describe('Push Tokens Endpoints', () => {
  let app;
  let mockPool;
  let mockAuthMiddleware;
  let createPushRouter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock db
    mockPool = {
      query: vi.fn(),
    };

    // Mock auth middleware - simple middleware that adds user to req
    mockAuthMiddleware = (req, _res, next) => {
      req.user = { id: 'user-123' };
      next();
    };

    // Import the router factory
    createPushRouter = require('../routes/push');

    // Create router with mocked dependencies
    const router = createPushRouter({
      db: mockPool,
      authMiddleware: mockAuthMiddleware,
      dispatcher: {
        sendPushToUser: vi.fn(),
      },
    });

    // Create app and mount router
    app = express();
    app.use(express.json());
    app.use('/api/push', router);
  });

  describe('POST /api/push/register', () => {
    it('should register an iOS device token', async () => {
      const deviceToken = 'a'.repeat(64); // Valid 64-char hex
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'token-1',
          user_id: 'user-123',
          device_token: deviceToken,
          platform: 'ios',
          created_at: new Date(),
        }],
      });

      const res = await request(app)
        .post('/api/push/register')
        .send({
          deviceToken,
          platform: 'ios',
          environment: 'production',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.token).toBeDefined();
      const calls = mockPool.query.mock.calls;
      const registerCall = calls.find(c => c[0].includes('INSERT INTO push_tokens'));
      expect(registerCall).toBeDefined();
      expect(registerCall[1]).toEqual(['user-123', 'ios', deviceToken, null, 'production']);
    });

    it('should reject invalid APNs token format', async () => {
      const res = await request(app)
        .post('/api/push/register')
        .send({
          deviceToken: 'invalid-token',
          platform: 'ios',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid APNs token format');
    });

    it('should accept android tokens without strict format', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'token-2',
          user_id: 'user-123',
          device_token: 'android-fcm-token',
          platform: 'android',
        }],
      });

      const res = await request(app)
        .post('/api/push/register')
        .send({
          deviceToken: 'android-fcm-token',
          platform: 'android',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });

    it('should reject missing deviceToken', async () => {
      const res = await request(app)
        .post('/api/push/register')
        .send({ platform: 'ios' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('deviceToken');
    });

    it('should reject unknown platform', async () => {
      const res = await request(app)
        .post('/api/push/register')
        .send({
          deviceToken: 'token123',
          platform: 'unknown',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ios|android|web');
    });

    it('should upsert on conflict', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'token-3', user_id: 'user-123' }],
      });

      await request(app)
        .post('/api/push/register')
        .send({
          deviceToken: 'a'.repeat(64),
          platform: 'ios',
        });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.anything()
      );
    });
  });

  describe('DELETE /api/push/register', () => {
    it('should unregister a device token', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .delete('/api/push/register')
        .send({ deviceToken: 'token-to-remove' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.removed).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM push_tokens'),
        expect.arrayContaining(['user-123', 'token-to-remove'])
      );
    });

    it('should return 404 if token not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app)
        .delete('/api/push/register')
        .send({ deviceToken: 'nonexistent-token' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should reject missing deviceToken', async () => {
      const res = await request(app)
        .delete('/api/push/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('deviceToken required');
    });
  });

  describe('GET /api/push/tokens', () => {
    it('should list user tokens', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'token-1',
            platform: 'ios',
            bundle_id: 'com.example',
            environment: 'production',
            last_seen_at: new Date(),
            created_at: new Date(),
          },
          {
            id: 'token-2',
            platform: 'android',
            bundle_id: null,
            environment: 'production',
            last_seen_at: new Date(),
            created_at: new Date(),
          },
        ],
      });

      const res = await request(app).get('/api/push/tokens');

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveLength(2);
      expect(res.body.tokens[0].platform).toBe('ios');
      expect(res.body.tokens[1].platform).toBe('android');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['user-123'])
      );
    });

    it('should return empty list if no tokens', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/push/tokens');

      expect(res.status).toBe(200);
      expect(res.body.tokens).toEqual([]);
    });
  });

  describe('GET /api/push/vapid-public-key', () => {
    it('should return VAPID public key', async () => {
      process.env.VAPID_PUBLIC_KEY = 'test-vapid-key';

      const res = await request(app).get('/api/push/vapid-public-key');

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('test-vapid-key');

      delete process.env.VAPID_PUBLIC_KEY;
    });

    it('should return empty key if not configured', async () => {
      delete process.env.VAPID_PUBLIC_KEY;

      const res = await request(app).get('/api/push/vapid-public-key');

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('');
    });
  });
});

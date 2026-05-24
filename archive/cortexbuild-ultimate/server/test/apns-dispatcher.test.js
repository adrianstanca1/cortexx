/**
 * APNs dispatcher tests
 * Tests token lifecycle, multi-device fan-out, and error handling
 */

// Set DATABASE_URL to prevent db.js from calling process.exit
process.env.DATABASE_URL = 'postgresql://localhost/test';

describe('Push Dispatcher (APNs)', () => {
  let mockPool;
  let mockApnsClient;
  let dispatcher;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock db
    mockPool = {
      query: vi.fn(),
    };

    // Mock APNs client
    mockApnsClient = {
      sendApnsNotification: vi.fn(),
      isApnsConfigured: vi.fn(() => true),
    };

    // Create dispatcher with mocked dependencies
    const createDispatcher = require('../lib/push/dispatcher');
    dispatcher = createDispatcher({
      db: mockPool,
      apns: mockApnsClient,
    });
  });

  it('should fan out to multiple iOS tokens', async () => {
    const tokens = [
      { id: 't1', platform: 'ios', device_token: 'token1' },
      { id: 't2', platform: 'ios', device_token: 'token2' },
    ];

    mockPool.query
      .mockResolvedValueOnce({ rows: tokens }) // SELECT tokens
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE t1
      .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE t2

    mockApnsClient.sendApnsNotification
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const payload = { title: 'Test', body: 'Message' };
    await dispatcher.sendPushToUser('user-123', payload);

    expect(mockApnsClient.sendApnsNotification).toHaveBeenCalledTimes(2);
    expect(mockApnsClient.sendApnsNotification).toHaveBeenNthCalledWith(1, 'token1', payload);
    expect(mockApnsClient.sendApnsNotification).toHaveBeenNthCalledWith(2, 'token2', payload);
  });

  it('should filter tokens by 90-day last_seen_at', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('90 days'),
      expect.arrayContaining(['user-123'])
    );
  });

  it('should remove token on BadDeviceToken error', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 't1', platform: 'ios', device_token: 'bad-token' }],
    });

    mockApnsClient.sendApnsNotification.mockResolvedValueOnce({
      ok: false,
      reason: 'BadDeviceToken',
    });

    mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM push_tokens'),
      expect.arrayContaining(['t1'])
    );
  });

  it('should remove token on Unregistered error', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 't2', platform: 'ios', device_token: 'unregistered-token' }],
    });

    mockApnsClient.sendApnsNotification.mockResolvedValueOnce({
      ok: false,
      reason: 'Unregistered',
    });

    mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM push_tokens'),
      expect.anything()
    );
  });

  it('should remove token on InvalidProviderToken error', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 't3', platform: 'ios', device_token: 'invalid-provider' }],
    });

    mockApnsClient.sendApnsNotification.mockResolvedValueOnce({
      ok: false,
      reason: 'InvalidProviderToken',
    });

    mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM push_tokens'),
      expect.anything()
    );
  });

  it('should update last_seen_at on successful send', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 't1', platform: 'ios', device_token: 'token1' }],
    });

    mockApnsClient.sendApnsNotification.mockResolvedValueOnce({ ok: true });

    mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE last_seen_at

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    const updateCall = mockPool.query.mock.calls.find(call =>
      call[0].includes('UPDATE push_tokens SET last_seen_at')
    );

    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toContain('t1');
  });

  it('should skip push if user has no tokens', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await dispatcher.sendPushToUser('user-no-tokens', { title: 'Test' });

    expect(mockApnsClient.sendApnsNotification).not.toHaveBeenCalled();
  });

  it('should handle missing userId gracefully', async () => {
    await dispatcher.sendPushToUser(null, { title: 'Test' });

    expect(mockPool.query).not.toHaveBeenCalled();
    expect(mockApnsClient.sendApnsNotification).not.toHaveBeenCalled();
  });

  it('should log and continue on individual token send errors', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: 't1', platform: 'ios', device_token: 'token1' },
        { id: 't2', platform: 'ios', device_token: 'token2' },
      ],
    });

    // First token fails with generic error, second succeeds
    mockApnsClient.sendApnsNotification
      .mockResolvedValueOnce({ ok: false, reason: 'SomeError', error: 'unknown error' })
      .mockResolvedValueOnce({ ok: true });

    mockPool.query
      .mockResolvedValueOnce({ rowCount: 1 }); // Attempt update for t2

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    // Should still call UPDATE on second token even though first failed
    expect(mockApnsClient.sendApnsNotification).toHaveBeenCalledTimes(2);
  });

  it('should handle APNs not configured', async () => {
    mockApnsClient.isApnsConfigured.mockReturnValueOnce(false);

    await dispatcher.sendPushToUser('user-123', { title: 'Test' });

    expect(mockPool.query).not.toHaveBeenCalled();
    expect(mockApnsClient.sendApnsNotification).not.toHaveBeenCalled();
  });
});

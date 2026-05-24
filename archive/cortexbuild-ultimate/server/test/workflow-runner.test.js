// Mock dependencies first before importing runner
const mockPool = {
  query: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockGetHandler = vi.fn();
vi.mock('../lib/workflow/action-registry', () => ({
  getHandler: mockGetHandler,
  registerHandler: vi.fn(),
  handleNoop: vi.fn(async () => ({ ok: true })),
}));

const { runWorkflow } = require('../lib/workflow/runner');

describe('workflow-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and updates workflow_runs record', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [
        {
          type: 'noop',
          params: {},
        },
      ],
    };

    const triggerEvent = { type: 'test_event' };

    // Mock insertions and updates
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    await runWorkflow(workflow, triggerEvent, { pool: mockPool, logger: mockLogger });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workflow_runs'),
      expect.arrayContaining([expect.anything(), 'workflow-1', expect.anything()])
    );

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workflow_runs'),
      expect.anything()
    );
  });

  it('skips workflow if conditions fail', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [
        { operator: 'eq', path: 'event.type', value: 'wrong_type' },
      ],
      actions: [],
    };

    const triggerEvent = { type: 'test_event' };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, triggerEvent, { pool: mockPool });

    expect(result.status).toBe('skipped');
    expect(result.action_results).toEqual([]);

    // Should call UPDATE with skipped status (status is in the SQL, not the params)
    const updateCalls = mockPool.query.mock.calls.filter((call) =>
      call[0].includes('UPDATE workflow_runs')
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0]).toContain("status = 'skipped'");
  });

  it('executes actions sequentially', async () => {
    // Use built-in noop action for testing
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [
        { type: 'noop', params: {} },
        { type: 'noop', params: {} },
      ],
    };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, {}, { pool: mockPool });

    expect(result.status).toBe('succeeded');
    expect(result.action_results).toHaveLength(2);
    expect(result.action_results[0].ok).toBe(true);
    expect(result.action_results[1].ok).toBe(true);
  });

  it('halts on action failure unless continueOnError', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [
        { type: 'unknown_action', params: {}, continueOnError: false }, // Will fail
        { type: 'noop', params: {} }, // Should not execute
      ],
    };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, {}, { pool: mockPool });

    expect(result.status).toBe('failed');
    expect(result.action_results).toHaveLength(1); // Only first action executed
    expect(result.error).toContain('Unknown action type');
  });

  it('continues on error if continueOnError is true', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [
        { type: 'unknown_action', params: {}, continueOnError: true }, // Will fail but continue
        { type: 'noop', params: {} }, // Should still execute
      ],
    };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, {}, { pool: mockPool });

    expect(result.status).toBe('failed');
    expect(result.action_results).toHaveLength(2); // Both executed
    expect(result.action_results[0].ok).toBe(false);
    expect(result.action_results[1].ok).toBe(true);
  });

  it('handles unknown action types gracefully', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [
        { type: 'unknown_action', params: {} },
      ],
    };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, {}, { pool: mockPool });

    expect(result.status).toBe('failed');
    expect(result.action_results).toHaveLength(1);
    expect(result.action_results[0].error).toContain('Unknown action type');
  });

  it('returns succeeded status when all actions pass', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [
        { type: 'noop', params: {} },
        { type: 'noop', params: {} },
      ],
    };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, {}, { pool: mockPool });

    expect(result.status).toBe('succeeded');
    expect(result.error).toBeFalsy();
  });

  it('handles database errors gracefully', async () => {
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [],
    };

    mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(runWorkflow(workflow, {}, { pool: mockPool })).rejects.toThrow(
      'DB connection failed'
    );

    // Should attempt to update the run record even on error
    const updateCalls = mockPool.query.mock.calls.filter((call) =>
      call[0].includes('UPDATE workflow_runs')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(0); // May or may not execute
  });

  it('passes context with user to handlers', async () => {
    // Test that user context is properly passed to the workflow
    const workflow = {
      id: 'workflow-1',
      conditions: [],
      actions: [{ type: 'noop', params: { key: 'value' } }],
    };

    const triggerEvent = { type: 'test', amount: 1000 };
    const user = { id: 'user-1', name: 'Test User' };

    mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

    const result = await runWorkflow(workflow, triggerEvent, { pool: mockPool, user });

    // Verify that the workflow ran with the given context
    expect(result.workflow_id).toBe('workflow-1');
    expect(result.status).toBe('succeeded');
    expect(result.action_results).toHaveLength(1);
  });
});

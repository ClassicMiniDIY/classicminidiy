/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- chainable
// SELECT chain: .from().select().eq().eq().order() → Promise { data, error }
// ---------------------------------------------------------------------------
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

// The query builder object -- methods return `this` for chaining
const queryBuilder: Record<string, any> = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  // Allows `const { data, error } = await q;` via Promise protocol
  then: vi.fn(),
};

mockSelect.mockReturnValue(queryBuilder);
mockEq.mockReturnValue(queryBuilder);
mockOrder.mockReturnValue(queryBuilder);
mockFrom.mockReturnValue(queryBuilder);

const mockSupabase = { from: mockFrom };

// ---------------------------------------------------------------------------
// Stub Nitro / H3 globals
// NOTE: This endpoint does NOT use requireUserAuth (it is a public endpoint)
// ---------------------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('getRouterParam', vi.fn());
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({
    public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
    SUPABASE_SERVICE_KEY: 'test-service-key',
  }))
);

// ---------------------------------------------------------------------------
// Mock server utility modules
// ---------------------------------------------------------------------------
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockEvent() {
  return { node: { req: {} } } as any;
}

/** Make the query builder resolve with a given result when awaited. */
function resolveQuery(result: { data?: any; error?: any }) {
  queryBuilder.then = vi.fn((resolve: any) => resolve({ data: result.data ?? null, error: result.error ?? null }));
}

// ===========================================================================
//  TESTS
// ===========================================================================

describe('server/api/gear-configs/public/[userId].get', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset defaults
    (getRouterParam as any).mockReturnValue('user-abc');

    // Re-initialise chain
    mockSelect.mockReturnValue(queryBuilder);
    mockEq.mockReturnValue(queryBuilder);
    mockOrder.mockReturnValue(queryBuilder);
    mockFrom.mockReturnValue(queryBuilder);

    // Default: empty list
    resolveQuery({ data: [], error: null });

    const mod = await import('~/server/api/gear-configs/public/[userId].get');
    handler = mod.default;
  });

  it('reads the router param userId from the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(getRouterParam).toHaveBeenCalledWith(event, 'userId');
  });

  it('throws 400 when userId is not provided', async () => {
    (getRouterParam as any).mockReturnValue(undefined);

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      message: 'User ID required',
    });
  });

  it('throws 400 when userId is an empty string', async () => {
    (getRouterParam as any).mockReturnValue('');

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      message: 'User ID required',
    });
  });

  it('does not query the database when userId is missing', async () => {
    (getRouterParam as any).mockReturnValue(undefined);

    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not require authentication (no requireUserAuth called)', async () => {
    // This test verifies the public endpoint is accessible without auth.
    // As long as a userId is provided, the handler should proceed.
    const result = await handler(createMockEvent());
    expect(result).toBeDefined();
  });

  describe('database query', () => {
    it('queries the saved_gear_configs table', async () => {
      await handler(createMockEvent());
      expect(mockFrom).toHaveBeenCalledWith('saved_gear_configs');
    });

    it('selects only public-safe fields (excludes user_id and is_public)', async () => {
      await handler(createMockEvent());
      expect(mockSelect).toHaveBeenCalledWith(
        'id, name, tire, gearset, final_drive, drop_gear, speedo_drive, max_rpm, created_at'
      );
    });

    it('filters by the provided userId', async () => {
      (getRouterParam as any).mockReturnValue('user-xyz');

      await handler(createMockEvent());

      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-xyz');
    });

    it('filters to only public configs', async () => {
      await handler(createMockEvent());
      expect(mockEq).toHaveBeenCalledWith('is_public', true);
    });

    it('orders results by updated_at descending', async () => {
      await handler(createMockEvent());
      expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('returns the list of public configs', async () => {
      const publicConfigs = [
        {
          id: 'cfg-pub-1',
          name: 'Public Config',
          tire: { width: 145, aspectRatio: 70, rimDiameter: 10 },
          gearset: { first: 3.65, second: 2.18, third: 1.43, fourth: 1.0 },
          final_drive: '3.44',
          drop_gear: '1.0',
          speedo_drive: '1.0',
          max_rpm: 7000,
          created_at: '2026-01-01T00:00:00Z',
        },
      ];

      resolveQuery({ data: publicConfigs, error: null });

      const result = await handler(createMockEvent());

      expect(result).toEqual(publicConfigs);
    });

    it('returns an empty array when user has no public configs', async () => {
      resolveQuery({ data: [], error: null });

      const result = await handler(createMockEvent());

      expect(result).toEqual([]);
    });

    it('returns null data as-is when database returns null', async () => {
      resolveQuery({ data: null, error: null });

      const result = await handler(createMockEvent());

      expect(result).toBeNull();
    });

    it('returns multiple public configs in order', async () => {
      const configs = [
        { id: 'cfg-1', name: 'Newest', created_at: '2026-03-01T00:00:00Z' },
        { id: 'cfg-2', name: 'Oldest', created_at: '2025-01-01T00:00:00Z' },
      ];

      resolveQuery({ data: configs, error: null });

      const result = await handler(createMockEvent());

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Newest');
    });

    it('throws 500 when database returns an error', async () => {
      resolveQuery({ data: null, error: { message: 'DB read failed' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to fetch public configs',
      });
    });

    it('throws 500 with the correct message on any database error', async () => {
      resolveQuery({ data: null, error: { message: 'Connection timeout' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to fetch public configs',
      });
    });
  });
});

/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- chainable, with terminal resolution via .then()
// ---------------------------------------------------------------------------
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

// The query builder object -- methods return `this` for chaining by default
const queryBuilder: Record<string, any> = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  // Allows `const { data, error } = await q;` via Promise protocol
  then: vi.fn(),
};

const mockSupabase = { from: mockFrom };

// Mock requireUserAuth -- resolves with a standard user by default
const mockRequireUserAuth = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

// ---------------------------------------------------------------------------
// Stub Nitro / H3 globals
// ---------------------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
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

vi.mock('~/server/utils/userAuth', () => ({
  requireUserAuth: mockRequireUserAuth,
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

describe('server/api/gear-configs/index.get', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset default mock behaviour
    mockRequireUserAuth.mockResolvedValue({ user: { id: 'user-1' } });

    // Re-initialise chainability
    mockSelect.mockReturnValue(queryBuilder);
    mockEq.mockReturnValue(queryBuilder);
    mockOrder.mockReturnValue(queryBuilder);
    mockFrom.mockReturnValue(queryBuilder);

    // Default: return empty list
    resolveQuery({ data: [], error: null });

    const mod = await import('~/server/api/gear-configs/index.get');
    handler = mod.default;
  });

  it('calls requireUserAuth with the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(mockRequireUserAuth).toHaveBeenCalledWith(event);
  });

  it('throws when user auth fails', async () => {
    mockRequireUserAuth.mockRejectedValueOnce(Object.assign(new Error('Authentication required'), { statusCode: 401 }));
    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('queries saved_gear_configs table for the authenticated user', async () => {
    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('saved_gear_configs');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('orders results by updated_at descending', async () => {
    await handler(createMockEvent());

    expect(mockOrder).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('returns the list of configs from the database', async () => {
    const configs = [
      { id: 'cfg-1', name: 'My Config', user_id: 'user-1', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'cfg-2', name: 'Another Config', user_id: 'user-1', updated_at: '2025-12-01T00:00:00Z' },
    ];

    resolveQuery({ data: configs, error: null });

    const result = await handler(createMockEvent());

    expect(result).toEqual(configs);
  });

  it('returns an empty array when user has no configs', async () => {
    resolveQuery({ data: [], error: null });

    const result = await handler(createMockEvent());

    expect(result).toEqual([]);
  });

  it('returns null data as-is when database returns null', async () => {
    resolveQuery({ data: null, error: null });

    const result = await handler(createMockEvent());

    expect(result).toBeNull();
  });

  it('throws 500 when database returns an error', async () => {
    resolveQuery({ data: null, error: { message: 'DB connection failed' } });

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to fetch configs',
    });
  });

  it('uses correct user id from auth when multiple users exist', async () => {
    mockRequireUserAuth.mockResolvedValueOnce({ user: { id: 'user-99' } });

    await handler(createMockEvent());

    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-99');
  });
});

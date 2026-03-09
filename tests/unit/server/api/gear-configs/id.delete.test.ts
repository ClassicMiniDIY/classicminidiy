/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- chainable
// DELETE chain: .from().delete().eq().eq() → Promise { error }
// ---------------------------------------------------------------------------
const mockEq = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();

// The delete chain: delete → eq → eq → Promise
const deleteChain: Record<string, any> = {
  eq: mockEq,
  // Allows `const { error } = await q;` via Promise protocol
  then: vi.fn(),
};

mockEq.mockReturnValue(deleteChain);
mockDelete.mockReturnValue(deleteChain);
mockFrom.mockReturnValue({ delete: mockDelete });

const mockSupabase = { from: mockFrom };

// Mock requireUserAuth -- resolves with a standard user by default
const mockRequireUserAuth = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

// ---------------------------------------------------------------------------
// Stub Nitro / H3 globals
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

vi.mock('~/server/utils/userAuth', () => ({
  requireUserAuth: mockRequireUserAuth,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockEvent() {
  return { node: { req: {} } } as any;
}

/** Make the delete chain resolve with a given error value when awaited. */
function resolveDelete(result: { error?: any }) {
  deleteChain.then = vi.fn((resolve: any) => resolve({ error: result.error ?? null }));
}

// ===========================================================================
//  TESTS
// ===========================================================================

describe('server/api/gear-configs/[id].delete', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset defaults
    mockRequireUserAuth.mockResolvedValue({ user: { id: 'user-1' } });
    (getRouterParam as any).mockReturnValue('cfg-1');

    // Re-initialise chain
    mockEq.mockReturnValue(deleteChain);
    mockDelete.mockReturnValue(deleteChain);
    mockFrom.mockReturnValue({ delete: mockDelete });

    // Default: successful deletion
    resolveDelete({ error: null });

    const mod = await import('~/server/api/gear-configs/[id].delete');
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

  it('reads the router param id from the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(getRouterParam).toHaveBeenCalledWith(event, 'id');
  });

  it('throws 400 when id is not provided', async () => {
    (getRouterParam as any).mockReturnValue(undefined);

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Config ID required',
    });
  });

  it('throws 400 when id is an empty string', async () => {
    (getRouterParam as any).mockReturnValue('');

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      message: 'Config ID required',
    });
  });

  it('does not call the database when id is missing', async () => {
    (getRouterParam as any).mockReturnValue(undefined);

    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 400 });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  describe('database query', () => {
    it('targets the saved_gear_configs table', async () => {
      await handler(createMockEvent());
      expect(mockFrom).toHaveBeenCalledWith('saved_gear_configs');
    });

    it('performs a delete operation', async () => {
      await handler(createMockEvent());
      expect(mockDelete).toHaveBeenCalled();
    });

    it('filters by the config id', async () => {
      await handler(createMockEvent());
      expect(mockEq).toHaveBeenCalledWith('id', 'cfg-1');
    });

    it('filters by user_id to prevent cross-user deletions', async () => {
      await handler(createMockEvent());
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('uses the correct user id from auth', async () => {
      mockRequireUserAuth.mockResolvedValueOnce({ user: { id: 'user-99' } });

      await handler(createMockEvent());

      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-99');
    });

    it('uses the correct config id from the route param', async () => {
      (getRouterParam as any).mockReturnValue('cfg-special-123');

      await handler(createMockEvent());

      expect(mockEq).toHaveBeenCalledWith('id', 'cfg-special-123');
    });

    it('throws 500 when the delete query fails', async () => {
      resolveDelete({ error: { message: 'Delete failed' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to delete config',
      });
    });

    it('throws 500 when delete encounters a constraint error', async () => {
      resolveDelete({ error: { message: 'Foreign key constraint violation' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to delete config',
      });
    });

    it('returns { success: true } on successful deletion', async () => {
      resolveDelete({ error: null });

      const result = await handler(createMockEvent());

      expect(result).toEqual({ success: true });
    });

    it('returns success even when the config did not exist (Supabase does not error on no-op delete)', async () => {
      // Supabase DELETE does not return an error when the row does not exist
      resolveDelete({ error: null });

      const result = await handler(createMockEvent());

      expect(result).toEqual({ success: true });
    });
  });
});

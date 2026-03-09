/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- chainable
// UPDATE chain: .from().update().eq().eq().select().single() → Promise { data, error }
// ---------------------------------------------------------------------------
const mockSingle = vi.fn();
const mockUpdateSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

// Build the chain: update → eq → eq → select → single
const updateChain: Record<string, any> = {
  eq: mockEq,
  select: mockUpdateSelect,
  single: mockSingle,
};

mockEq.mockReturnValue(updateChain);
mockUpdateSelect.mockReturnValue({ single: mockSingle });
mockUpdate.mockReturnValue(updateChain);
mockFrom.mockReturnValue({ update: mockUpdate });

const mockSupabase = { from: mockFrom };

// Mock requireUserAuth -- resolves with a standard user by default
const mockRequireUserAuth = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

// ---------------------------------------------------------------------------
// Stub Nitro / H3 globals
// ---------------------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('readBody', vi.fn());
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

const existingConfig = {
  id: 'cfg-1',
  user_id: 'user-1',
  name: 'Original Name',
  tire: { width: 145, aspectRatio: 70, rimDiameter: 10 },
  gearset: { first: 3.65, second: 2.18, third: 1.43, fourth: 1.0 },
  final_drive: '3.44',
  drop_gear: '1.0',
  speedo_drive: '1.0',
  max_rpm: 7000,
  is_public: false,
};

// ===========================================================================
//  TESTS
// ===========================================================================

describe('server/api/gear-configs/[id].put', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset defaults
    mockRequireUserAuth.mockResolvedValue({ user: { id: 'user-1' } });
    (getRouterParam as any).mockReturnValue('cfg-1');
    (readBody as any).mockResolvedValue({ name: 'Updated Name' });

    // Re-initialise chain
    mockEq.mockReturnValue(updateChain);
    mockUpdateSelect.mockReturnValue({ single: mockSingle });
    mockUpdate.mockReturnValue(updateChain);
    mockFrom.mockReturnValue({ update: mockUpdate });
    mockSingle.mockResolvedValue({ data: { ...existingConfig, name: 'Updated Name' }, error: null });

    const mod = await import('~/server/api/gear-configs/[id].put');
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

  it('reads the request body from the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(readBody).toHaveBeenCalledWith(event);
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

  describe('name validation', () => {
    it('throws 400 when name is not a string', async () => {
      (readBody as any).mockResolvedValue({ name: 123 });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Name must be 1-100 characters',
      });
    });

    it('throws 400 when name is only whitespace', async () => {
      (readBody as any).mockResolvedValue({ name: '   ' });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Name must be 1-100 characters',
      });
    });

    it('throws 400 when name exceeds 100 characters', async () => {
      (readBody as any).mockResolvedValue({ name: 'x'.repeat(101) });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Name must be 1-100 characters',
      });
    });

    it('accepts name of exactly 100 characters', async () => {
      (readBody as any).mockResolvedValue({ name: 'a'.repeat(100) });

      const result = await handler(createMockEvent());
      expect(result).toBeDefined();
    });

    it('skips name validation when name is not in the body', async () => {
      (readBody as any).mockResolvedValue({ max_rpm: 6500 });

      const result = await handler(createMockEvent());
      expect(result).toBeDefined();
    });
  });

  describe('no fields to update', () => {
    it('throws 400 when body contains no recognized fields', async () => {
      (readBody as any).mockResolvedValue({});

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'No fields to update',
      });
    });

    it('throws 400 when body contains only unrecognized fields', async () => {
      (readBody as any).mockResolvedValue({ unrelated: 'value', another: 42 });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'No fields to update',
      });
    });
  });

  describe('partial update fields', () => {
    it('builds update object with only provided fields', async () => {
      (readBody as any).mockResolvedValue({ name: 'New Name' });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith({ name: 'New Name' });
    });

    it('includes tire when provided', async () => {
      const tire = { width: 165, aspectRatio: 65, rimDiameter: 12 };
      (readBody as any).mockResolvedValue({ tire });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ tire }));
    });

    it('includes gearset when provided', async () => {
      const gearset = { first: 3.2, second: 2.0, third: 1.4, fourth: 1.0 };
      (readBody as any).mockResolvedValue({ gearset });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ gearset }));
    });

    it('coerces final_drive to string', async () => {
      (readBody as any).mockResolvedValue({ final_drive: 3.9 });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ final_drive: '3.9' }));
    });

    it('coerces drop_gear to string', async () => {
      (readBody as any).mockResolvedValue({ drop_gear: 0.76 });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ drop_gear: '0.76' }));
    });

    it('coerces speedo_drive to string', async () => {
      (readBody as any).mockResolvedValue({ speedo_drive: 1.05 });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ speedo_drive: '1.05' }));
    });

    it('coerces max_rpm to number', async () => {
      (readBody as any).mockResolvedValue({ max_rpm: '8000' });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ max_rpm: 8000 }));
    });

    it('sets is_public to true when explicitly true', async () => {
      (readBody as any).mockResolvedValue({ is_public: true });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_public: true }));
    });

    it('sets is_public to false when not strictly true', async () => {
      (readBody as any).mockResolvedValue({ is_public: 'yes' });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }));
    });

    it('trims whitespace from the name before updating', async () => {
      (readBody as any).mockResolvedValue({ name: '  Trimmed Name  ' });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trimmed Name' }));
    });

    it('updates multiple fields at once', async () => {
      (readBody as any).mockResolvedValue({ name: 'New Name', max_rpm: 7500, is_public: true });

      await handler(createMockEvent());

      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'New Name',
        max_rpm: 7500,
        is_public: true,
      });
    });
  });

  describe('database query', () => {
    it('targets the saved_gear_configs table', async () => {
      await handler(createMockEvent());
      expect(mockFrom).toHaveBeenCalledWith('saved_gear_configs');
    });

    it('filters by config id', async () => {
      await handler(createMockEvent());
      expect(mockEq).toHaveBeenCalledWith('id', 'cfg-1');
    });

    it('filters by user_id to prevent cross-user updates', async () => {
      await handler(createMockEvent());
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws 500 when the update query fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to update config',
      });
    });

    it('throws 404 when the config is not found (data is null, no error)', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 404,
        message: 'Config not found',
      });
    });

    it('returns the updated config on success', async () => {
      const updated = { ...existingConfig, name: 'Updated Name' };
      mockSingle.mockResolvedValueOnce({ data: updated, error: null });

      const result = await handler(createMockEvent());

      expect(result).toEqual(updated);
    });
  });
});

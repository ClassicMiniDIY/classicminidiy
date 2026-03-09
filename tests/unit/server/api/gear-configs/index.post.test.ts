/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- two independent chains needed:
//   1. Count check: .from().select('*', { count, head }).eq() → Promise { count, error }
//   2. Insert:      .from().insert().select().single()        → Promise { data, error }
// ---------------------------------------------------------------------------
const mockSingle = vi.fn();
const mockInsertSelect = vi.fn();
const mockInsert = vi.fn();
const mockCountEq = vi.fn();
const mockCountSelect = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = { from: mockFrom };

// Mock requireUserAuth -- resolves with a standard user by default
const mockRequireUserAuth = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

// ---------------------------------------------------------------------------
// Stub Nitro / H3 globals
// ---------------------------------------------------------------------------
vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('readBody', vi.fn());
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

/** A complete valid request body for creating a gear config. */
const validBody = {
  name: 'My Gearing Setup',
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

describe('server/api/gear-configs/index.post', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset defaults
    mockRequireUserAuth.mockResolvedValue({ user: { id: 'user-1' } });
    (readBody as any).mockResolvedValue({ ...validBody });

    // Insert chain: insert() → { select } → { single } → Promise { data, error }
    mockSingle.mockResolvedValue({ data: { id: 'new-cfg', ...validBody, user_id: 'user-1' }, error: null });
    mockInsertSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockInsertSelect });

    // Count chain: select() → { eq } → Promise { count, error }
    mockCountEq.mockResolvedValue({ count: 0, error: null });
    mockCountSelect.mockReturnValue({ eq: mockCountEq });

    // from() uses mockImplementation to handle both calls dynamically
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return { select: mockCountSelect };
      }
      return { insert: mockInsert };
    });

    // Only import once - the handler reference stays valid
    if (!handler) {
      const mod = await import('~/server/api/gear-configs/index.post');
      handler = mod.default;
    }
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

  it('reads the request body from the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(readBody).toHaveBeenCalledWith(event);
  });

  describe('required field validation', () => {
    it('throws 400 when name is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when tire is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, tire: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when gearset is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, gearset: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when final_drive is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, final_drive: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when drop_gear is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, drop_gear: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when speedo_drive is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, speedo_drive: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when max_rpm is missing', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, max_rpm: undefined });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });
  });

  describe('name validation', () => {
    it('throws 400 when name is not a string', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: 42 });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Name must be 1-100 characters',
      });
    });

    it('throws 400 when name is an empty string', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: '' });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields',
      });
    });

    it('throws 400 when name is only whitespace', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: '   ' });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Name must be 1-100 characters',
      });
    });

    it('throws 400 when name exceeds 100 characters', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: 'a'.repeat(101) });
      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Name must be 1-100 characters',
      });
    });

    it('accepts a name of exactly 100 characters', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: 'a'.repeat(100) });
      const result = await handler(createMockEvent());
      expect(result).toBeDefined();
    });

    it('accepts a name of 1 character', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: 'X' });
      const result = await handler(createMockEvent());
      expect(result).toBeDefined();
    });
  });

  describe('config count enforcement', () => {
    it('checks the count of existing configs for the user', async () => {
      await handler(createMockEvent());

      expect(mockFrom).toHaveBeenCalledWith('saved_gear_configs');
      expect(mockCountSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockCountEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws 500 when the count check fails', async () => {
      mockCountEq.mockResolvedValueOnce({ count: null, error: { message: 'Count query failed' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to check config count',
      });
    });

    it('throws 400 when user already has 25 configs', async () => {
      mockCountEq.mockResolvedValueOnce({ count: 25, error: null });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Maximum of 25 saved configurations reached',
      });
    });

    it('throws 400 when count is greater than 25', async () => {
      mockCountEq.mockResolvedValueOnce({ count: 30, error: null });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Maximum of 25 saved configurations reached',
      });
    });

    it('allows creation when user has exactly 24 configs', async () => {
      mockCountEq.mockResolvedValueOnce({ count: 24, error: null });

      const result = await handler(createMockEvent());

      expect(result).toBeDefined();
    });

    it('allows creation when count is null (treats as 0)', async () => {
      mockCountEq.mockResolvedValueOnce({ count: null, error: null });

      const result = await handler(createMockEvent());

      expect(result).toBeDefined();
    });
  });

  describe('insert operation', () => {
    it('inserts into the saved_gear_configs table with correct fields', async () => {
      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          name: 'My Gearing Setup',
          tire: validBody.tire,
          gearset: validBody.gearset,
          final_drive: '3.44',
          drop_gear: '1.0',
          speedo_drive: '1.0',
          max_rpm: 7000,
          is_public: false,
        })
      );
    });

    it('trims whitespace from the name before inserting', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, name: '  My Config  ' });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Config' }));
    });

    it('coerces final_drive to string', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, final_drive: 3.44 });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ final_drive: '3.44' }));
    });

    it('coerces drop_gear to string', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, drop_gear: 1 });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ drop_gear: '1' }));
    });

    it('coerces speedo_drive to string', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, speedo_drive: 1.083 });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ speedo_drive: '1.083' }));
    });

    it('coerces max_rpm to a number', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, max_rpm: '6500' });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ max_rpm: 6500 }));
    });

    it('sets is_public to true when explicitly true', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, is_public: true });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ is_public: true }));
    });

    it('sets is_public to false when not true (e.g., string "true")', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, is_public: 'true' });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }));
    });

    it('sets is_public to false when not provided', async () => {
      (readBody as any).mockResolvedValue({ ...validBody, is_public: undefined });

      await handler(createMockEvent());

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }));
    });

    it('throws 500 when insert fails', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      await expect(handler(createMockEvent())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to create config',
      });
    });

    it('returns the newly created config on success', async () => {
      const newConfig = { id: 'new-cfg-1', name: 'My Gearing Setup', user_id: 'user-1' };
      mockSingle.mockResolvedValueOnce({ data: newConfig, error: null });

      const result = await handler(createMockEvent());

      expect(result).toEqual(newConfig);
    });
  });
});

/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- chainable, with async resolution via .then()
// ---------------------------------------------------------------------------
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();

// The query builder object itself -- every chainable method returns `this`
const queryBuilder: Record<string, any> = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  // Allows `const { data, error } = await q;` via `await` on the builder
  then: vi.fn(),
};

const mockFrom = vi.fn(() => queryBuilder);
const mockSupabase = { from: mockFrom };

// Admin auth mock -- resolves with an admin user by default
const mockRequireAdminAuth = vi.fn().mockResolvedValue({ user: { id: 'admin-123' } });

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
vi.stubGlobal('getQuery', vi.fn().mockReturnValue({}));
vi.stubGlobal('readBody', vi.fn().mockResolvedValue({}));
vi.stubGlobal('setResponseHeaders', vi.fn());
vi.stubGlobal('useRuntimeConfig', vi.fn(() => ({
  public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
  SUPABASE_SERVICE_KEY: 'test-service-key',
})));

// ---------------------------------------------------------------------------
// Mock server utility modules
// ---------------------------------------------------------------------------
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

vi.mock('~/server/utils/adminAuth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

// ---------------------------------------------------------------------------
// Helper to build a minimal H3 event
// ---------------------------------------------------------------------------
function createMockEvent() {
  return { node: { req: {} } } as any;
}

// ---------------------------------------------------------------------------
// Helpers to configure query builder resolution
// ---------------------------------------------------------------------------

/** Make the next await on the query builder resolve with { data, error, count }. */
function resolveQuery(result: { data?: any; error?: any; count?: any }) {
  queryBuilder.then = vi.fn((resolve: any) =>
    resolve({ data: result.data ?? null, error: result.error ?? null, count: result.count ?? undefined }),
  );
}

/** Make .single() resolve with { data, error }. */
function resolveSingle(result: { data?: any; error?: any }) {
  mockSingle.mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
}

/** Make .eq() return an object whose .single() resolves with given result
 *  but otherwise still chain normally for non-single paths. */
function resolveEqChain(result: { data?: any; error?: any }) {
  // For approve handler: the first .eq() chain ends with .single()
  // Subsequent .eq() chains end with await (then)
  mockSingle.mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
}

// ===========================================================================
//  TEST SUITES
// ===========================================================================

describe('server/api/admin/queue/list', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset default mocks
    mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
    (getQuery as any).mockReturnValue({});

    // Re-initialise query builder chainability
    mockSelect.mockReturnThis();
    mockOrder.mockReturnThis();
    mockEq.mockReturnThis();
    mockFrom.mockReturnValue(queryBuilder);

    // Default: resolve with empty array
    resolveQuery({ data: [], error: null });

    const mod = await import('~/server/api/admin/queue/list');
    handler = mod.default;
  });

  it('calls requireAdminAuth with the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(mockRequireAdminAuth).toHaveBeenCalledWith(event);
  });

  it('throws when admin auth fails', async () => {
    const event = createMockEvent();
    mockRequireAdminAuth.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 }),
    );
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('queries submission_queue with submitter join and descending order', async () => {
    const event = createMockEvent();
    await handler(event);

    expect(mockFrom).toHaveBeenCalledWith('submission_queue');
    expect(mockSelect).toHaveBeenCalledWith(
      '*, submitter:profiles!submission_queue_submitted_by_fkey(display_name, email, avatar_url, trust_level)',
    );
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('filters by status=pending by default', async () => {
    (getQuery as any).mockReturnValue({});
    const event = createMockEvent();
    await handler(event);

    // Should call .eq('status', 'pending') since default status is 'pending'
    expect(mockEq).toHaveBeenCalledWith('status', 'pending');
  });

  it('does not filter by status when status=all', async () => {
    (getQuery as any).mockReturnValue({ status: 'all' });
    const event = createMockEvent();
    await handler(event);

    // .eq should NOT have been called with 'status' argument
    const statusCalls = mockEq.mock.calls.filter((c: any[]) => c[0] === 'status');
    expect(statusCalls).toHaveLength(0);
  });

  it('filters by targetType when provided', async () => {
    (getQuery as any).mockReturnValue({ targetType: 'color' });
    const event = createMockEvent();
    await handler(event);

    expect(mockEq).toHaveBeenCalledWith('target_type', 'color');
  });

  it('applies both status and targetType filters together', async () => {
    (getQuery as any).mockReturnValue({ status: 'approved', targetType: 'wheel' });
    const event = createMockEvent();
    await handler(event);

    expect(mockEq).toHaveBeenCalledWith('status', 'approved');
    expect(mockEq).toHaveBeenCalledWith('target_type', 'wheel');
  });

  it('returns mapped submissions with all expected fields', async () => {
    const rawItem = {
      id: 'sub-1',
      type: 'new_item',
      target_type: 'color',
      target_id: null,
      status: 'pending',
      data: { name: 'Almond Green' },
      reviewer_notes: null,
      reviewed_at: null,
      created_at: '2026-01-15T00:00:00Z',
      submitted_by: 'user-456',
      submitter: {
        display_name: 'John Doe',
        email: 'john@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        trust_level: 'trusted',
      },
    };

    resolveQuery({ data: [rawItem], error: null });
    const event = createMockEvent();
    const result = await handler(event);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'sub-1',
      type: 'new_item',
      targetType: 'color',
      targetId: null,
      status: 'pending',
      data: { name: 'Almond Green' },
      reviewerNotes: null,
      reviewedAt: null,
      createdAt: '2026-01-15T00:00:00Z',
      submittedBy: 'user-456',
      submitterName: 'John Doe',
      submitterEmail: 'john@example.com',
      submitterAvatar: 'https://example.com/avatar.jpg',
      submitterTrustLevel: 'trusted',
    });
  });

  it('falls back to email for submitterName when display_name is missing', async () => {
    resolveQuery({
      data: [{
        id: 'sub-2', type: 'new_item', target_type: 'wheel', target_id: null,
        status: 'pending', data: {}, reviewer_notes: null, reviewed_at: null,
        created_at: '2026-01-01', submitted_by: 'u1',
        submitter: { display_name: null, email: 'fallback@email.com', avatar_url: null, trust_level: null },
      }],
    });

    const result = await handler(createMockEvent());
    expect(result[0].submitterName).toBe('fallback@email.com');
  });

  it('returns "Unknown" when submitter has no display_name or email', async () => {
    resolveQuery({
      data: [{
        id: 'sub-3', type: 'edit_suggestion', target_type: 'registry', target_id: 'r1',
        status: 'pending', data: {}, reviewer_notes: null, reviewed_at: null,
        created_at: '2026-01-01', submitted_by: 'u2',
        submitter: { display_name: null, email: null, avatar_url: null, trust_level: null },
      }],
    });

    const result = await handler(createMockEvent());
    expect(result[0].submitterName).toBe('Unknown');
  });

  it('returns "Unknown" when submitter object is null', async () => {
    resolveQuery({
      data: [{
        id: 'sub-4', type: 'new_item', target_type: 'document', target_id: null,
        status: 'pending', data: {}, reviewer_notes: null, reviewed_at: null,
        created_at: '2026-01-01', submitted_by: 'u3',
        submitter: null,
      }],
    });

    const result = await handler(createMockEvent());
    expect(result[0].submitterName).toBe('Unknown');
    expect(result[0].submitterEmail).toBeNull();
    expect(result[0].submitterAvatar).toBeNull();
    expect(result[0].submitterTrustLevel).toBe('new');
  });

  it('returns empty array when data is null', async () => {
    resolveQuery({ data: null, error: null });
    const result = await handler(createMockEvent());
    expect(result).toEqual([]);
  });

  it('throws 500 on database error', async () => {
    resolveQuery({ data: null, error: { message: 'DB connection failed' } });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      message: 'DB connection failed',
    });
  });
});

// ===========================================================================

describe('server/api/admin/queue/count', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
    (getQuery as any).mockReturnValue({});
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockFrom.mockReturnValue(queryBuilder);

    resolveQuery({ data: null, error: null, count: 0 });

    const mod = await import('~/server/api/admin/queue/count');
    handler = mod.default;
  });

  it('calls requireAdminAuth with the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(mockRequireAdminAuth).toHaveBeenCalledWith(event);
  });

  it('throws when admin auth fails', async () => {
    mockRequireAdminAuth.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );
    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('queries submission_queue for pending count with head:true', async () => {
    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('submission_queue');
    expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(mockEq).toHaveBeenCalledWith('status', 'pending');
  });

  it('returns count of pending submissions', async () => {
    resolveQuery({ count: 7, error: null });
    const result = await handler(createMockEvent());
    expect(result).toEqual({ count: 7 });
  });

  it('filters by targetType when provided', async () => {
    (getQuery as any).mockReturnValue({ targetType: 'wheel' });
    await handler(createMockEvent());
    expect(mockEq).toHaveBeenCalledWith('target_type', 'wheel');
  });

  it('returns 0 when count is null', async () => {
    resolveQuery({ count: null, error: null });
    const result = await handler(createMockEvent());
    expect(result).toEqual({ count: 0 });
  });

  it('returns 0 when count is undefined', async () => {
    resolveQuery({ error: null });
    const result = await handler(createMockEvent());
    expect(result).toEqual({ count: 0 });
  });

  it('throws 500 on database error', async () => {
    resolveQuery({ error: { message: 'Connection timeout' } });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      message: 'Connection timeout',
    });
  });
});

// ===========================================================================

describe('server/api/admin/queue/approve.post', () => {
  let handler: Function;

  // Helper: set up a fetched submission from supabase .single()
  function mockFetchSubmission(submission: any) {
    mockSingle.mockResolvedValue({ data: submission, error: null });
  }

  // Helper: after insert/update the remaining .eq() chain resolves via .then()
  function mockUpdateSuccess() {
    resolveQuery({ data: null, error: null });
  }

  function mockUpdateError(message: string) {
    resolveQuery({ data: null, error: { message } });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
    (readBody as any).mockResolvedValue({ id: 'sub-1' });

    // Default chainability
    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockEq.mockReturnThis();
    mockFrom.mockReturnValue(queryBuilder);

    // Default: single fetch succeeds, update succeeds
    mockSingle.mockResolvedValue({
      data: { id: 'sub-1', type: 'new_item', target_type: 'color', target_id: null, data: { name: 'Test' } },
      error: null,
    });
    resolveQuery({ data: null, error: null });

    const mod = await import('~/server/api/admin/queue/approve.post');
    handler = mod.default;
  });

  it('calls requireAdminAuth with the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(mockRequireAdminAuth).toHaveBeenCalledWith(event);
  });

  it('reads request body from the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(readBody).toHaveBeenCalledWith(event);
  });

  it('throws 400 when id is missing', async () => {
    (readBody as any).mockResolvedValue({});
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('throws 400 when id is not a string', async () => {
    (readBody as any).mockResolvedValue({ id: 123 });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('throws 400 when id is an empty string', async () => {
    (readBody as any).mockResolvedValue({ id: '' });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('throws 404 when submission is not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Submission not found',
    });
  });

  it('throws 404 when submission data is null even without error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Submission not found',
    });
  });

  it('inserts into colors table for new_item color submission', async () => {
    const colorData = {
      name: 'Almond Green',
      code: 'AG',
      shortCode: 'ALG',
      ditzlerPpgCode: '12345',
      duluxCode: 'DX99',
      primaryColor: '#556B2F',
      hasSwatch: true,
      imageSwatch: '/swatches/almond.png',
      images: ['/img1.jpg'],
      submittedBy: 'contributor-1',
      submittedByEmail: 'contributor@test.com',
    };

    mockFetchSubmission({
      id: 'sub-1', type: 'new_item', target_type: 'color', target_id: null, data: colorData,
    });

    (readBody as any).mockResolvedValue({ id: 'sub-1' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('colors');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Almond Green',
      code: 'AG',
      short_code: 'ALG',
      ditzler_ppg_code: '12345',
      dulux_code: 'DX99',
      hex_value: '#556B2F',
      has_swatch: true,
      swatch_path: '/swatches/almond.png',
      contributor_images: ['/img1.jpg'],
      status: 'approved',
      legacy_submitted_by: 'contributor-1',
      legacy_submitted_by_email: 'contributor@test.com',
    }));
  });

  it('inserts into wheels table for new_item wheel submission', async () => {
    const wheelData = {
      name: 'Minilite',
      type: 'alloy',
      size: '10',
      width: '6J',
      offset: 'ET25',
      boltPattern: '4x101.6',
      centerBore: '67.1',
      manufacturer: 'Minilite',
      weight: '4.5kg',
      notes: 'Classic look',
      photos: ['/wheel1.jpg'],
      userName: 'WheelGuy',
      emailAddress: 'wheels@test.com',
    };

    mockFetchSubmission({
      id: 'sub-2', type: 'new_item', target_type: 'wheel', target_id: null, data: wheelData,
    });

    (readBody as any).mockResolvedValue({ id: 'sub-2' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('wheels');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Minilite',
      wheel_type: 'alloy',
      size: 10,
      width: '6J',
      offset_value: 'ET25',
      bolt_pattern: '4x101.6',
      center_bore: '67.1',
      manufacturer: 'Minilite',
      weight: '4.5kg',
      notes: 'Classic look',
      status: 'approved',
      legacy_submitted_by: 'WheelGuy',
      legacy_submitted_by_email: 'wheels@test.com',
    }));
  });

  it('inserts into registry_entries table for new_item registry submission', async () => {
    const registryData = {
      year: 1967,
      model: 'Cooper S',
      bodyNum: 'KA2S7-123456',
      engineNum: '9F-SA-H-12345',
      engineSize: '1275',
      bodyType: 'saloon',
      color: 'Almond Green',
      trim: 'Porcelain Green',
      buildDate: '1967-03-15',
      owner: 'John Smith',
      location: 'Austin, TX',
      notes: 'Original condition',
      submittedBy: 'RegistryUser',
      submittedByEmail: 'registry@test.com',
    };

    mockFetchSubmission({
      id: 'sub-3', type: 'new_item', target_type: 'registry', target_id: null, data: registryData,
    });

    (readBody as any).mockResolvedValue({ id: 'sub-3' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('registry_entries');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      year: 1967,
      model: 'Cooper S',
      body_number: 'KA2S7-123456',
      engine_number: '9F-SA-H-12345',
      engine_size: '1275',
      body_type: 'saloon',
      color: 'Almond Green',
      trim: 'Porcelain Green',
      build_date: '1967-03-15',
      owner: 'John Smith',
      location: 'Austin, TX',
      notes: 'Original condition',
      status: 'approved',
    }));
  });

  it('inserts into archive_documents table for new_item document submission', async () => {
    const docData = {
      title: 'Workshop Manual',
      type: 'manual',
      description: 'Official BMC workshop manual',
      code: 'AKD4935',
      author: 'BMC',
      year: 1967,
      filePath: '/docs/workshop-manual.pdf',
      thumbnailPath: '/thumbs/workshop-manual.jpg',
    };

    mockFetchSubmission({
      id: 'sub-4', type: 'new_item', target_type: 'document', target_id: null, data: docData,
    });

    (readBody as any).mockResolvedValue({ id: 'sub-4' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('archive_documents');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'workshop-manual',
      type: 'manual',
      title: 'Workshop Manual',
      description: 'Official BMC workshop manual',
      code: 'AKD4935',
      author: 'BMC',
      year: 1967,
      file_path: '/docs/workshop-manual.pdf',
      thumbnail_path: '/thumbs/workshop-manual.jpg',
      status: 'approved',
    }));
  });

  it('throws 500 for unsupported target type on new_item', async () => {
    mockFetchSubmission({
      id: 'sub-5', type: 'new_item', target_type: 'unknown_type', target_id: null, data: {},
    });

    (readBody as any).mockResolvedValue({ id: 'sub-5' });
    mockUpdateSuccess();

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Unsupported target type: unknown_type',
    });
  });

  it('applies edit suggestion changes to the target record', async () => {
    const editData = {
      changes: {
        name: { from: 'Old Name', to: 'New Name' },
        code: { from: 'OC', to: 'NC' },
      },
    };

    mockFetchSubmission({
      id: 'sub-6', type: 'edit_suggestion', target_type: 'color', target_id: 'color-99', data: editData,
    });

    (readBody as any).mockResolvedValue({ id: 'sub-6' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    // Should update the colors table with the 'to' values
    expect(mockFrom).toHaveBeenCalledWith('colors');
    expect(mockUpdate).toHaveBeenCalledWith({ name: 'New Name', code: 'NC' });
    expect(mockEq).toHaveBeenCalledWith('id', 'color-99');
  });

  it('does not apply edit_suggestion when target_id is null', async () => {
    mockFetchSubmission({
      id: 'sub-7', type: 'edit_suggestion', target_type: 'wheel', target_id: null,
      data: { changes: { name: { from: 'A', to: 'B' } } },
    });

    (readBody as any).mockResolvedValue({ id: 'sub-7' });
    mockUpdateSuccess();

    const result = await handler(createMockEvent());
    expect(result).toEqual({ success: true });

    // update should only be called for the status update, not for applying changes
    // (since target_id is falsy, the edit_suggestion branch is skipped)
  });

  it('uses editedData when provided instead of submission.data', async () => {
    const submissionData = { name: 'Original' };
    const editedData = { name: 'Admin Edited' };

    mockFetchSubmission({
      id: 'sub-8', type: 'new_item', target_type: 'color', target_id: null, data: submissionData,
    });

    (readBody as any).mockResolvedValue({ id: 'sub-8', editedData });
    mockUpdateSuccess();

    await handler(createMockEvent());

    // The insert should use editedData, not submissionData
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Admin Edited',
    }));
  });

  it('updates submission status to approved with reviewer info', async () => {
    mockFetchSubmission({
      id: 'sub-9', type: 'new_item', target_type: 'color', target_id: null, data: { name: 'Test' },
    });

    (readBody as any).mockResolvedValue({ id: 'sub-9', reviewerNotes: 'Looks good!' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('submission_queue');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approved',
      reviewed_by: 'admin-123',
      reviewer_notes: 'Looks good!',
    }));
    expect(mockEq).toHaveBeenCalledWith('id', 'sub-9');
  });

  it('sets reviewer_notes to null when not provided', async () => {
    mockFetchSubmission({
      id: 'sub-10', type: 'new_item', target_type: 'color', target_id: null, data: { name: 'Test' },
    });

    (readBody as any).mockResolvedValue({ id: 'sub-10' });
    mockUpdateSuccess();

    await handler(createMockEvent());

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      reviewer_notes: null,
    }));
  });

  it('returns { success: true } on successful approval', async () => {
    (readBody as any).mockResolvedValue({ id: 'sub-1' });
    mockUpdateSuccess();

    const result = await handler(createMockEvent());
    expect(result).toEqual({ success: true });
  });

  it('throws 500 when status update fails', async () => {
    mockFetchSubmission({
      id: 'sub-err', type: 'new_item', target_type: 'color', target_id: null, data: { name: 'Test' },
    });

    (readBody as any).mockResolvedValue({ id: 'sub-err' });
    mockUpdateError('Update failed');

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      message: 'Update failed',
    });
  });

  it('throws 500 when insert for new_item fails', async () => {
    mockFetchSubmission({
      id: 'sub-insert-err', type: 'new_item', target_type: 'color', target_id: null, data: { name: 'Fail' },
    });

    // Make the insert chain return an error via then()
    // The first "then" call is for the insert, so it should return error
    resolveQuery({ data: null, error: { message: 'Insert failed' } });

    (readBody as any).mockResolvedValue({ id: 'sub-insert-err' });

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

// ===========================================================================

describe('server/api/admin/queue/reject.post', () => {
  let handler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
    (readBody as any).mockResolvedValue({ id: 'rej-1' });

    mockUpdate.mockReturnThis();
    mockEq.mockReturnThis();
    mockFrom.mockReturnValue(queryBuilder);

    resolveQuery({ data: null, error: null });

    const mod = await import('~/server/api/admin/queue/reject.post');
    handler = mod.default;
  });

  it('calls requireAdminAuth with the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(mockRequireAdminAuth).toHaveBeenCalledWith(event);
  });

  it('reads request body from the event', async () => {
    const event = createMockEvent();
    await handler(event);
    expect(readBody).toHaveBeenCalledWith(event);
  });

  it('throws 400 when id is missing', async () => {
    (readBody as any).mockResolvedValue({});
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('throws 400 when id is not a string', async () => {
    (readBody as any).mockResolvedValue({ id: 42 });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('throws 400 when id is empty string', async () => {
    (readBody as any).mockResolvedValue({ id: '' });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('throws 400 when id is null', async () => {
    (readBody as any).mockResolvedValue({ id: null });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing submission id',
    });
  });

  it('updates submission to rejected status with reviewer info', async () => {
    (readBody as any).mockResolvedValue({ id: 'rej-1', reviewerNotes: 'Duplicate entry' });

    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('submission_queue');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected',
      reviewed_by: 'admin-123',
      reviewer_notes: 'Duplicate entry',
    }));
    expect(mockEq).toHaveBeenCalledWith('id', 'rej-1');
  });

  it('sets reviewer_notes to null when not provided', async () => {
    (readBody as any).mockResolvedValue({ id: 'rej-2' });

    await handler(createMockEvent());

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      reviewer_notes: null,
    }));
  });

  it('includes reviewed_at timestamp in update', async () => {
    (readBody as any).mockResolvedValue({ id: 'rej-3' });

    await handler(createMockEvent());

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      reviewed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }));
  });

  it('returns { success: true } on successful rejection', async () => {
    resolveQuery({ data: null, error: null });
    const result = await handler(createMockEvent());
    expect(result).toEqual({ success: true });
  });

  it('throws 500 on database error', async () => {
    resolveQuery({ data: null, error: { message: 'Database write error' } });

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      message: 'Database write error',
    });
  });

  it('throws when admin auth fails', async () => {
    mockRequireAdminAuth.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );
    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 403 });
  });
});

/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase query builder -- chainable, with async resolution via .then()
// ---------------------------------------------------------------------------
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();

const queryBuilder: Record<string, any> = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  then: vi.fn(),
};

const mockFrom = vi.fn(() => queryBuilder);
const mockSupabase = { from: mockFrom };

const mockRequireAdminAuth = vi.fn().mockResolvedValue({ user: { id: 'admin-123' } });

vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});
vi.stubGlobal('readBody', vi.fn().mockResolvedValue({}));
vi.stubGlobal(
  'useRuntimeConfig',
  vi.fn(() => ({
    public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
    SUPABASE_SERVICE_KEY: 'test-service-key',
  }))
);

vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

vi.mock('~/server/utils/adminAuth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

function createMockEvent() {
  return { node: { req: {} } } as any;
}

function resolveQuery(result: { data?: any; error?: any }) {
  queryBuilder.then = vi.fn((resolve: any) => resolve({ data: result.data ?? null, error: result.error ?? null }));
}

// ===========================================================================
//  server/api/colors/queue/save
//
//  The older /admin/colors/review approval surface. It is not linked from any
//  nav, but it is reachable by URL and /api/colors/queue/list spreads
//  ...item.data, so the same submissions are approvable from it -- which is why
//  it has to make the same four decisions the admin inbox makes. Before
//  2026-08 it made none of them: it ignored originalColorId (minting the
//  duplicate colours supabase PR #77 folded), replaced contributor_images
//  instead of appending, never validated upload URLs, and never wrote
//  submitted_by.
// ===========================================================================

describe('server/api/colors/queue/save', () => {
  let handler: Function;

  const SUBMISSION_ID = 'sub-legacy-1';
  const EXISTING_COLOR_ID = '843cc36e-cf46-4085-a22b-8a563f2dde63';

  /** Real uploads look exactly like this -- see server/api/archive/upload.ts. */
  const ownUrl = (name: string, submissionId = SUBMISSION_ID) =>
    `https://test.supabase.co/storage/v1/object/public/archive-colors/uploads/${submissionId}/${name}`;

  function mockSubmission(submission: any) {
    mockSingle.mockResolvedValue({ data: submission, error: null });
  }

  function mockExistingColor(row: any) {
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });
  }

  /** The colour write, picked out from the submission_queue status update. */
  const colorImageUpdate = () => mockUpdate.mock.calls.find((call: any[]) => 'contributor_images' in call[0])?.[0];
  const colorFieldUpdate = () => mockUpdate.mock.calls.find((call: any[]) => 'hex_value' in call[0])?.[0];

  const details = (overrides: Record<string, any> = {}) => ({
    name: 'Willow Green',
    code: 'WG',
    primaryColor: '#8DB600',
    submittedBy: 'PhotoContributor',
    uploadedFiles: [{ url: ownUrl('my-mini.jpg'), category: 'car-photos' }],
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });

    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockEq.mockReturnThis();
    mockFrom.mockReturnValue(queryBuilder);

    // vi.clearAllMocks() only clears call history, so every default has to be
    // restored here or it leaks from the previous test.
    mockSingle.mockResolvedValue({
      data: { type: 'new_item', target_id: null, data: {}, submitted_by: 'user-abc' },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    resolveQuery({ data: null, error: null });

    (readBody as any).mockResolvedValue({ uuid: SUBMISSION_ID, details: details() });

    const mod = await import('~/server/api/colors/queue/save');
    handler = mod.default;
  });

  it('throws 400 when uuid is missing', async () => {
    (readBody as any).mockResolvedValue({ details: details() });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid or missing uuid',
    });
  });

  it('throws 400 when details have no name', async () => {
    (readBody as any).mockResolvedValue({ uuid: SUBMISSION_ID, details: { code: 'WG' } });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid or missing color details',
    });
  });

  it('throws 404 when the submission is gone', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Submission not found',
    });
  });

  it('attaches to the named colour instead of inserting a duplicate', async () => {
    (readBody as any).mockResolvedValue({
      uuid: SUBMISSION_ID,
      details: details({ originalColorId: EXISTING_COLOR_ID }),
    });
    mockExistingColor({
      id: EXISTING_COLOR_ID,
      submitted_by: null,
      swatch_path: '/swatches/willow.png',
      contributor_images: [{ url: '/existing/photo.jpg', contributor: 'SomeoneElse' }],
    });

    await handler(createMockEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(colorImageUpdate()).toEqual({
      contributor_images: [
        { url: '/existing/photo.jpg', contributor: 'SomeoneElse' },
        { url: ownUrl('my-mini.jpg'), contributor: 'PhotoContributor' },
      ],
      submitted_by: 'user-abc',
    });
    // A new_item never rewrites the existing colour's fields.
    expect(colorFieldUpdate()).toBeUndefined();
  });

  it('appends to contributor_images on an edit suggestion rather than replacing them', async () => {
    mockSubmission({
      type: 'edit_suggestion',
      target_id: EXISTING_COLOR_ID,
      data: {},
      submitted_by: 'user-abc',
    });
    mockExistingColor({
      id: EXISTING_COLOR_ID,
      submitted_by: 'original-owner',
      swatch_path: '/swatches/willow.png',
      contributor_images: [{ url: '/existing/photo.jpg', contributor: 'SomeoneElse' }],
    });

    await handler(createMockEvent());

    expect(mockInsert).not.toHaveBeenCalled();
    expect(colorImageUpdate().contributor_images).toEqual([
      { url: '/existing/photo.jpg', contributor: 'SomeoneElse' },
      { url: ownUrl('my-mini.jpg'), contributor: 'PhotoContributor' },
    ]);
    // The reviewed field values still land -- this surface is a field review too.
    expect(colorFieldUpdate()).toMatchObject({ name: 'Willow Green', code: 'WG', hex_value: '#8DB600' });
  });

  it('does not reassign a colour that already has an owner', async () => {
    mockSubmission({ type: 'edit_suggestion', target_id: EXISTING_COLOR_ID, data: {}, submitted_by: 'user-abc' });
    mockExistingColor({
      id: EXISTING_COLOR_ID,
      submitted_by: 'original-owner',
      swatch_path: '/swatches/willow.png',
      contributor_images: [],
    });

    await handler(createMockEvent());

    expect(colorImageUpdate()).not.toHaveProperty('submitted_by');
  });

  it('drops asset URLs that did not come from this submission’s uploads', async () => {
    (readBody as any).mockResolvedValue({
      uuid: SUBMISSION_ID,
      details: details({
        uploadedFiles: [
          { url: 'https://evil.example.com/tracker.png', category: 'car-photos' },
          { url: ownUrl('stolen.jpg', 'someone-elses-submission'), category: 'car-photos' },
          { url: ownUrl('mine.jpg'), category: 'car-photos' },
        ],
        imageSwatch: 'https://evil.example.com/swatch.png',
      }),
    });

    await handler(createMockEvent());

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        swatch_path: null,
        contributor_images: [{ url: ownUrl('mine.jpg'), contributor: 'PhotoContributor' }],
      })
    );
  });

  it('credits the submitter on a newly inserted colour', async () => {
    await handler(createMockEvent());

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Willow Green',
        status: 'approved',
        submitted_by: 'user-abc',
        legacy_submitted_by: 'PhotoContributor',
      })
    );
  });

  it('inserts when originalColorId no longer resolves', async () => {
    (readBody as any).mockResolvedValue({
      uuid: SUBMISSION_ID,
      details: details({ originalColorId: EXISTING_COLOR_ID }),
    });
    mockExistingColor(null);

    await handler(createMockEvent());

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Willow Green' }));
  });

  it('ignores an originalColorId that is not a uuid rather than 500ing on 22P02', async () => {
    (readBody as any).mockResolvedValue({
      uuid: SUBMISSION_ID,
      details: details({ originalColorId: 'not-a-uuid' }),
    });

    await handler(createMockEvent());

    expect(mockMaybeSingle).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('falls back to the stored uploadedFiles when the review table did not round-trip them', async () => {
    mockSubmission({
      type: 'new_item',
      target_id: null,
      data: { uploadedFiles: [{ url: ownUrl('stored.jpg'), category: 'car-photos' }] },
      submitted_by: 'user-abc',
    });
    (readBody as any).mockResolvedValue({
      uuid: SUBMISSION_ID,
      details: details({ uploadedFiles: undefined }),
    });

    await handler(createMockEvent());

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        contributor_images: [{ url: ownUrl('stored.jpg'), contributor: 'PhotoContributor' }],
      })
    );
  });

  it('marks the submission approved with the reviewing admin', async () => {
    await handler(createMockEvent());

    expect(mockFrom).toHaveBeenCalledWith('submission_queue');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', reviewed_by: 'admin-123' }));
  });

  it('surfaces a colour read failure as a 500', async () => {
    (readBody as any).mockResolvedValue({
      uuid: SUBMISSION_ID,
      details: details({ originalColorId: EXISTING_COLOR_ID }),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'colors read failed' } });

    await expect(handler(createMockEvent())).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'colors read failed',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

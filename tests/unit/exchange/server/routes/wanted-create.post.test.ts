/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mock the auth + service deps the route imports. The route imports them via
// relative specifiers (../../../utils/userAuth, ../../../utils/supabase,
// ../../../utils/exchange/notificationQueue) which resolve to the same absolute
// modules as the `~~/server/utils/*` ids below; vi.mock matches by resolved id.
//
// The pure utils (sanitize, contentFilter, validators, constants) are NOT
// mocked — we exercise the real validation/moderation logic.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));
vi.mock('~~/server/utils/exchange/notificationQueue', () => ({
  queueAdminNotification: vi.fn(),
  queueNotification: vi.fn(),
  buildBatchKey: vi.fn(() => 'bk'),
}));

// The rate-limit middleware calls setResponseHeader, which is not part of the
// shared h3 global setup. Stub it so the middleware doesn't throw.
vi.stubGlobal('setResponseHeader', vi.fn());

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';
import { queueAdminNotification } from '~~/server/utils/exchange/notificationQueue';

const handler = (await import('~~/server/api/exchange/wanted/create.post')).default;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'user-1', email: 'buyer@example.com' };

/**
 * Minimal h3 event. The rate-limit middleware reads `event.context.user?.id`,
 * so `context` must exist. All request accessors (readBody/getHeader/...) are
 * globally mocked and ignore the event arg.
 */
function evt(): any {
  return { context: {} };
}

const VALID_PROFILE = {
  id: 'user-1',
  is_banned: false,
  display_name: 'Mini Mike',
  email: 'buyer@example.com',
};

/** A complete, clean (non-flagged) wanted-post body. */
function validBody(overrides: Record<string, any> = {}) {
  return {
    title: 'Looking for a 1275 engine',
    description: 'Want a good condition A-series 1275 short block for my Cooper restoration project.',
    category: 'engine',
    conditionPreference: 'good',
    budgetMin: 500,
    budgetMax: 2000,
    currency: 'GBP',
    city: 'Oxford',
    stateProvince: 'Oxfordshire',
    country: 'UK',
    ...overrides,
  };
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Configure the service-client mock so that the FIRST `.single()` (profile
 * lookup) resolves `profile`, and the SECOND `.single()` (wanted_posts insert)
 * resolves `insert`. The route calls `.single()` exactly twice in the happy path.
 */
function wireSupabase(opts: {
  profile?: { data: any; error: any };
  insert?: { data: any; error: any };
} = {}) {
  mockSupabase = createMockSupabaseClient();
  const profileRes = opts.profile ?? { data: { ...VALID_PROFILE }, error: null };
  const insertRes = opts.insert ?? { data: { id: 'wp-1', title: 'x' }, error: null };
  mockSupabase._mockSingle.mockResolvedValueOnce(profileRes).mockResolvedValueOnce(insertRes);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  _resetRateLimitStore();
  vi.clearAllMocks();

  // Default: authenticated, non-banned, clean post that inserts successfully.
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  (readBody as any).mockResolvedValue(validBody());
  (getHeader as any).mockImplementation((_e: any, n: string) =>
    n === 'x-real-ip' ? '9.9.9.9' : n === 'authorization' ? 'Bearer tok' : undefined
  );
  wireSupabase();
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/exchange/wanted/create.post', () => {
  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------
  describe('authentication', () => {
    it('verifies authentication via requireUserClient', async () => {
      await handler(evt());
      expect(requireUserClient).toHaveBeenCalledTimes(1);
    });

    it('propagates a 401 when auth fails', async () => {
      (requireUserClient as any).mockRejectedValueOnce(
        Object.assign(new Error('Authentication required'), { statusCode: 401 })
      );
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    });

    it('propagates a 403 banned-token error from requireUserClient', async () => {
      (requireUserClient as any).mockRejectedValueOnce(
        Object.assign(new Error('Account suspended'), { statusCode: 403 })
      );
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // -------------------------------------------------------------------------
  // Required field validation
  // -------------------------------------------------------------------------
  describe('required field validation', () => {
    it('throws 400 when title is missing', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: undefined }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields: title, description, and category',
      });
    });

    it('throws 400 when description is missing', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: undefined }));
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when category is missing', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: undefined }));
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when title is an empty string (falsy)', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: '' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Missing required fields: title, description, and category',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Category validation
  // -------------------------------------------------------------------------
  describe('category validation', () => {
    it('throws 400 for an invalid category', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'spaceship' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Invalid category'),
      });
    });

    it('accepts the "vehicle" category', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'vehicle' }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('requires partsSubcategory when category is "parts"', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'parts', partsSubcategory: undefined }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Parts subcategory is required when category is parts',
      });
    });

    it('accepts "parts" when partsSubcategory is provided and stores it', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'parts', partsSubcategory: 'brakes' }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'parts', parts_subcategory: 'brakes' })
      );
    });

    it('nulls parts_subcategory for non-parts categories even if one is sent', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'engine', partsSubcategory: 'brakes' }));
      await handler(evt());
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(expect.objectContaining({ parts_subcategory: null }));
    });
  });

  // -------------------------------------------------------------------------
  // Condition preference validation
  // -------------------------------------------------------------------------
  describe('condition preference validation', () => {
    it('throws 400 for an invalid condition preference', async () => {
      (readBody as any).mockResolvedValue(validBody({ conditionPreference: 'mint' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Invalid condition preference'),
      });
    });

    it('allows an undefined condition preference and defaults insert to "any"', async () => {
      (readBody as any).mockResolvedValue(validBody({ conditionPreference: undefined }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(expect.objectContaining({ condition_preference: 'any' }));
    });
  });

  // -------------------------------------------------------------------------
  // Length validation (post-sanitization)
  // -------------------------------------------------------------------------
  describe('length validation', () => {
    it('throws 400 when sanitized title is empty (HTML stripped to nothing)', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: '<p></p>' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Title must be between 1 and 200 characters',
      });
    });

    it('throws 400 when title exceeds 200 characters', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: 'a'.repeat(201) }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Title must be between 1 and 200 characters',
      });
    });

    it('throws 400 when description exceeds MAX_CONTENT_LENGTH (2000)', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: 'a'.repeat(2001) }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Description must be between 1 and 2000 characters',
      });
    });

    it('throws 400 when sanitized description is empty', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: '<script></script>' }));
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts a title of exactly 200 chars', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: 'a'.repeat(200) }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Sanitization side-effects on stored values
  // -------------------------------------------------------------------------
  describe('sanitization', () => {
    it('strips HTML from title/description before inserting', async () => {
      (readBody as any).mockResolvedValue(
        validBody({ title: 'Wanted <b>1275</b> engine', description: 'Good <i>condition</i> please' })
      );
      await handler(evt());
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Wanted 1275 engine', description: 'Good condition please' })
      );
    });

    it('nulls optional location fields when not provided', async () => {
      (readBody as any).mockResolvedValue(
        validBody({ city: undefined, stateProvince: undefined, country: undefined })
      );
      await handler(evt());
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ city: null, state_province: null, country: null })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Content moderation -> status / moderation_status / flagged
  // -------------------------------------------------------------------------
  describe('content moderation', () => {
    it('clean content -> status active, moderation_status approved, flagged=false', async () => {
      const res = await handler(evt());
      expect(res.flagged).toBe(false);
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          moderation_status: 'approved',
          moderation_issues: null,
        })
      );
    });

    it('flagged content (email in description) -> status flagged, moderation_status flagged, flagged=true', async () => {
      (readBody as any).mockResolvedValue(
        validBody({ description: 'Contact me at scammer@evil.com for the engine details thanks' })
      );
      const res = await handler(evt());
      expect(res.flagged).toBe(true);
      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.status).toBe('flagged');
      expect(insertArg.moderation_status).toBe('flagged');
      expect(insertArg.moderation_issues).toContain('email');
    });

    it('forwards isFlagged=true to the admin notification when flagged', async () => {
      (readBody as any).mockResolvedValue(
        validBody({ description: 'Reach me at scammer@evil.com to discuss the 1275 block today' })
      );
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ isFlagged: true }) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Profile / ban gates
  // -------------------------------------------------------------------------
  describe('profile and ban gates', () => {
    it('selects the profile by the authed user id', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('throws 404 when the profile lookup errors', async () => {
      wireSupabase({ profile: { data: null, error: { message: 'boom' } } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 404,
        message: 'User profile not found',
      });
    });

    it('throws 404 when the profile is missing (null data, no error)', async () => {
      wireSupabase({ profile: { data: null, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when the user is banned', async () => {
      wireSupabase({ profile: { data: { ...VALID_PROFILE, is_banned: true }, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('suspended'),
      });
    });

    it('does NOT insert or notify when the user is banned', async () => {
      wireSupabase({ profile: { data: { ...VALID_PROFILE, is_banned: true }, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
      expect(queueAdminNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Budget validation (real validators)
  // -------------------------------------------------------------------------
  describe('budget validation', () => {
    it('throws 400 when budgetMin is negative', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: -5 }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Minimum budget'),
      });
    });

    it('throws 400 when budgetMax exceeds MAX_BUDGET', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMax: 10_000_001 }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Maximum budget'),
      });
    });

    it('throws 400 when a budget value is not a number', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: '500' }));
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when budgetMin exceeds budgetMax', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 3000, budgetMax: 1000 }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Minimum budget cannot exceed maximum budget',
      });
    });

    it('allows omitted budgets and stores them as null', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: undefined, budgetMax: undefined }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ budget_min: null, budget_max: null })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Insert error path
  // -------------------------------------------------------------------------
  describe('insert error handling', () => {
    it('throws 500 when the insert errors', async () => {
      wireSupabase({ insert: { data: null, error: { message: 'db down' } } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to create wanted post',
      });
    });

    it('does NOT notify admins when the insert fails', async () => {
      wireSupabase({ insert: { data: null, error: { message: 'db down' } } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
      expect(queueAdminNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: return shape + admin notification side-effect
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('returns { success, post, flagged } with the inserted row', async () => {
      const inserted = { id: 'wp-99', title: 'Looking for a 1275 engine' };
      wireSupabase({ insert: { data: inserted, error: null } });
      const res = await handler(evt());
      expect(res).toEqual({ success: true, post: inserted, flagged: false });
    });

    it('inserts with user_id, defaults (currency default not overridden here), and sanitized fields', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          title: 'Looking for a 1275 engine',
          category: 'engine',
          condition_preference: 'good',
          currency: 'GBP',
          budget_min: 500,
          budget_max: 2000,
          city: 'Oxford',
        })
      );
    });

    it('defaults currency to USD when omitted', async () => {
      (readBody as any).mockResolvedValue(validBody({ currency: undefined }));
      await handler(evt());
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
    });

    it('enqueues admin_wanted_pending with postTitle, posterName, isFlagged', async () => {
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledTimes(1);
      expect(queueAdminNotification).toHaveBeenCalledWith({
        eventType: 'admin_wanted_pending',
        payload: {
          postTitle: 'Looking for a 1275 engine',
          posterName: 'Mini Mike',
          isFlagged: false,
        },
      });
    });

    it('falls back posterName to "a member" when display_name is missing', async () => {
      wireSupabase({ profile: { data: { ...VALID_PROFILE, display_name: null }, error: null } });
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ posterName: 'a member' }) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Catch-all error wrapping
  // -------------------------------------------------------------------------
  describe('unexpected error wrapping', () => {
    it('wraps a non-H3 error (no statusCode) thrown after auth as a 500', async () => {
      // readBody throwing a plain Error inside the try block hits the catch-all.
      (readBody as any).mockRejectedValueOnce(new Error('parse exploded'));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to create wanted post',
      });
    });

    it('re-throws an H3 error unchanged (preserves its statusCode)', async () => {
      // getServiceClient throwing an H3-shaped error should pass through as-is.
      (getServiceClient as any).mockImplementationOnce(() => {
        throw Object.assign(new Error('teapot'), { statusCode: 418 });
      });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 418 });
    });
  });
});

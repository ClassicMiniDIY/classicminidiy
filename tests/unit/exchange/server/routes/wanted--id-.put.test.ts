/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetExchangeRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mock the auth + service deps the route imports. The route imports them via
// relative specifiers (../../../utils/userAuth, ../../../utils/supabase) which
// resolve to the same absolute modules as the `~~/server/utils/*` ids below;
// vi.mock matches by resolved id.
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

// The rate-limit middleware calls setResponseHeader, which is not part of the
// shared h3 global setup. Stub it so the middleware doesn't throw.
vi.stubGlobal('setResponseHeader', vi.fn());

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';

const handler = (await import('~~/server/api/exchange/wanted/[id].put')).default;

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

const POST_ID = 'wp-1';

/** Existing wanted post owned by USER, not flagged, with a stored budget pair. */
const EXISTING_POST = {
  id: POST_ID,
  user_id: 'user-1',
  status: 'active',
  moderation_status: 'approved',
  budget_min: 100,
  budget_max: 5000,
};

/** Owner profile (non-admin, non-banned). */
const OWNER_PROFILE = { is_admin: false, is_banned: false };

/** A minimal valid update body. */
function validBody(overrides: Record<string, any> = {}) {
  return {
    title: 'Updated: looking for a 1275 engine',
    ...overrides,
  };
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Configure the service-client mock. The route calls `.single()` up to three
 * times in order:
 *   1. wanted_posts fetch (ownership check)
 *   2. profiles fetch (admin / ban)
 *   3. wanted_posts update (final write)
 * Provide the resolutions in that order. The update resolution is omitted when
 * an earlier branch short-circuits.
 */
function wireSupabase(
  opts: {
    existing?: { data: any; error: any };
    profile?: { data: any; error: any };
    update?: { data: any; error: any };
  } = {}
) {
  mockSupabase = createMockSupabaseClient();
  const existingRes = opts.existing ?? { data: { ...EXISTING_POST }, error: null };
  const profileRes = opts.profile ?? { data: { ...OWNER_PROFILE }, error: null };
  const updateRes = opts.update ?? { data: { ...EXISTING_POST, ...{ id: POST_ID } }, error: null };
  mockSupabase._mockSingle
    .mockResolvedValueOnce(existingRes)
    .mockResolvedValueOnce(profileRes)
    .mockResolvedValueOnce(updateRes);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

/** The object passed to `.update(...)` in the final write. */
function lastUpdateArg() {
  return mockSupabase._mockUpdate.mock.calls[mockSupabase._mockUpdate.mock.calls.length - 1][0];
}

beforeEach(() => {
  _resetExchangeRateLimitStore();
  vi.clearAllMocks();

  // Default: authenticated owner, existing post, clean partial update.
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  (readBody as any).mockResolvedValue(validBody());
  (getRouterParam as any).mockReturnValue(POST_ID);
  (getHeader as any).mockImplementation((_e: any, n: string) =>
    n === 'x-real-ip' ? '9.9.9.9' : n === 'authorization' ? 'Bearer tok' : undefined
  );
  wireSupabase();
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
  (getRouterParam as any).mockReturnValue(undefined);
});

describe('server/api/exchange/wanted/[id].put', () => {
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

    it('does NOT update when auth fails', async () => {
      (requireUserClient as any).mockRejectedValueOnce(
        Object.assign(new Error('Authentication required'), { statusCode: 401 })
      );
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Route param
  // -------------------------------------------------------------------------
  describe('route param', () => {
    it('throws 400 when the post id is missing from the route', async () => {
      (getRouterParam as any).mockReturnValueOnce(undefined);
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Wanted post ID is required',
      });
    });

    it('fetches the existing post by the route id', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', POST_ID);
    });

    it('does NOT select email when fetching the existing post', async () => {
      await handler(evt());
      const firstSelect = mockSupabase._mockSelect.mock.calls[0][0] as string;
      expect(firstSelect).not.toContain('email');
    });
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------
  describe('not found', () => {
    it('throws 404 when the fetch errors', async () => {
      wireSupabase({ existing: { data: null, error: { message: 'boom' } } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 404,
        message: 'Wanted post not found',
      });
    });

    it('throws 404 when the post is missing (null data, no error)', async () => {
      wireSupabase({ existing: { data: null, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    });

    it('does NOT update when the post is not found', async () => {
      wireSupabase({ existing: { data: null, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Ownership / admin
  // -------------------------------------------------------------------------
  describe('ownership and admin access', () => {
    it('throws 403 when the user is neither owner nor admin', async () => {
      wireSupabase({
        existing: { data: { ...EXISTING_POST, user_id: 'someone-else' }, error: null },
        profile: { data: { is_admin: false, is_banned: false }, error: null },
      });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to update this wanted post',
      });
    });

    it('does NOT update when forbidden', async () => {
      wireSupabase({
        existing: { data: { ...EXISTING_POST, user_id: 'someone-else' }, error: null },
        profile: { data: { is_admin: false, is_banned: false }, error: null },
      });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('allows an admin to update a post they do not own', async () => {
      wireSupabase({
        existing: { data: { ...EXISTING_POST, user_id: 'someone-else' }, error: null },
        profile: { data: { is_admin: true, is_banned: false }, error: null },
      });
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('allows the owner to update their own post', async () => {
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('selects the profile by the authed user id', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('treats a missing profile (null) as non-admin -> 403 for a non-owner', async () => {
      wireSupabase({
        existing: { data: { ...EXISTING_POST, user_id: 'someone-else' }, error: null },
        profile: { data: null, error: null },
      });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // -------------------------------------------------------------------------
  // Ban gate
  // -------------------------------------------------------------------------
  describe('ban gate', () => {
    it('throws 403 when the owner is banned', async () => {
      wireSupabase({ profile: { data: { is_admin: false, is_banned: true }, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('suspended'),
      });
    });

    it('does NOT update when the user is banned', async () => {
      wireSupabase({ profile: { data: { is_admin: false, is_banned: true }, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Empty update guard
  // -------------------------------------------------------------------------
  describe('empty update', () => {
    it('throws 400 when no updatable fields are provided', async () => {
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'No fields provided to update',
      });
    });

    it('does NOT update when no fields are provided', async () => {
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Title validation / sanitization
  // -------------------------------------------------------------------------
  describe('title', () => {
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

    it('accepts a title of exactly 200 chars', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: 'a'.repeat(200) }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('strips HTML from the title before persisting', async () => {
      (readBody as any).mockResolvedValue(validBody({ title: 'Wanted <b>1275</b> engine' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ title: 'Wanted 1275 engine' });
    });

    it('does not include title in the update when not provided', async () => {
      (readBody as any).mockResolvedValue({ currency: 'USD' });
      await handler(evt());
      expect(lastUpdateArg()).not.toHaveProperty('title');
    });
  });

  // -------------------------------------------------------------------------
  // Description validation / sanitization
  // -------------------------------------------------------------------------
  describe('description', () => {
    it('throws 400 when sanitized description is empty', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: '<script></script>' }));
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when description exceeds MAX_CONTENT_LENGTH (2000)', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: 'a'.repeat(2001) }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Description must be between 1 and 2000 characters',
      });
    });

    it('accepts a description of exactly 2000 chars', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: 'a'.repeat(2000) }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('strips HTML from the description before persisting', async () => {
      (readBody as any).mockResolvedValue(validBody({ description: 'Good <i>condition</i> please' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ description: 'Good condition please' });
    });
  });

  // -------------------------------------------------------------------------
  // Category validation
  // -------------------------------------------------------------------------
  describe('category', () => {
    it('throws 400 for an invalid category', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'spaceship' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Invalid category'),
      });
    });

    it('accepts the "vehicle" category and sets it', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'vehicle' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ category: 'vehicle' });
    });

    it('requires partsSubcategory when category is "parts"', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'parts' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Parts subcategory is required when category is parts',
      });
    });

    it('accepts "parts" when partsSubcategory is provided and stores it', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'parts', partsSubcategory: 'brakes' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ category: 'parts', parts_subcategory: 'brakes' });
    });

    it('accepts the snake_case parts_subcategory fallback', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'parts', parts_subcategory: 'engine-internals' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ category: 'parts', parts_subcategory: 'engine-internals' });
    });

    it('nulls parts_subcategory when switching to a non-parts category', async () => {
      (readBody as any).mockResolvedValue(validBody({ category: 'engine', partsSubcategory: 'brakes' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ category: 'engine', parts_subcategory: null });
    });

    it('updates partsSubcategory without changing the category', async () => {
      (readBody as any).mockResolvedValue({ partsSubcategory: 'suspension' });
      await handler(evt());
      const arg = lastUpdateArg();
      expect(arg).toMatchObject({ parts_subcategory: 'suspension' });
      expect(arg).not.toHaveProperty('category');
    });
  });

  // -------------------------------------------------------------------------
  // Condition preference validation
  // -------------------------------------------------------------------------
  describe('condition preference', () => {
    it('throws 400 for an invalid condition preference', async () => {
      (readBody as any).mockResolvedValue(validBody({ conditionPreference: 'mint' }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Invalid condition preference'),
      });
    });

    it('accepts a valid condition preference and maps it to condition_preference', async () => {
      (readBody as any).mockResolvedValue(validBody({ conditionPreference: 'excellent' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ condition_preference: 'excellent' });
    });

    it('accepts "any" as a valid condition preference', async () => {
      (readBody as any).mockResolvedValue(validBody({ conditionPreference: 'any' }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Budget validation (single values + would-be-persisted range)
  // -------------------------------------------------------------------------
  describe('budget', () => {
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

    it('persists both budget fields when valid', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 200, budgetMax: 800 }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ budget_min: 200, budget_max: 800 });
    });

    it('throws 400 when both budgets are in the body and min > max', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 3000, budgetMax: 1000 }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Minimum budget cannot exceed maximum budget',
      });
    });

    // The invariant: range is validated against the WOULD-BE-PERSISTED pair,
    // defaulting the side not in the body to the existing stored value.
    it('throws 400 when only budgetMin is sent and it exceeds the stored budget_max', async () => {
      // stored max is 5000; new min 6000 would persist an invalid pair.
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 6000 }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Minimum budget cannot exceed maximum budget',
      });
    });

    it('throws 400 when only budgetMax is sent and it is below the stored budget_min', async () => {
      // stored min is 100; new max 50 would persist an invalid pair.
      (readBody as any).mockResolvedValue(validBody({ budgetMax: 50 }));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'Minimum budget cannot exceed maximum budget',
      });
    });

    it('allows a partial budgetMin update that is still valid against the stored max', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 4000 }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
      expect(lastUpdateArg()).toMatchObject({ budget_min: 4000 });
    });

    it('does NOT validate range when the stored counterpart side is null', async () => {
      // existing.budget_max is null; sending only budgetMin can't form a range,
      // so no range error even though there is no max to compare against.
      wireSupabase({ existing: { data: { ...EXISTING_POST, budget_max: null }, error: null } });
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 9_000_000 }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });

    it('allows budgetMin equal to stored budgetMax (boundary)', async () => {
      (readBody as any).mockResolvedValue(validBody({ budgetMin: 5000 }));
      const res = await handler(evt());
      expect(res.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Currency + location
  // -------------------------------------------------------------------------
  describe('currency and location', () => {
    it('persists currency when provided', async () => {
      (readBody as any).mockResolvedValue(validBody({ currency: 'EUR' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ currency: 'EUR' });
    });

    it('sanitizes location fields and maps stateProvince -> state_province', async () => {
      (readBody as any).mockResolvedValue(
        validBody({ city: 'Ox<b>ford</b>', stateProvince: 'Oxfordshire', country: 'UK' })
      );
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({
        city: 'Oxford',
        state_province: 'Oxfordshire',
        country: 'UK',
      });
    });

    it('nulls a location field when provided as an empty string', async () => {
      (readBody as any).mockResolvedValue(validBody({ city: '' }));
      await handler(evt());
      expect(lastUpdateArg()).toMatchObject({ city: null });
    });
  });

  // -------------------------------------------------------------------------
  // Moderation status transitions
  // -------------------------------------------------------------------------
  describe('moderation transitions', () => {
    it('flags the post when updated content trips moderation', async () => {
      (readBody as any).mockResolvedValue(
        validBody({ description: 'Contact me at scammer@evil.com for the engine details thanks' })
      );
      const res = await handler(evt());
      expect(res.flagged).toBe(true);
      const arg = lastUpdateArg();
      expect(arg.status).toBe('flagged');
      expect(arg.moderation_status).toBe('flagged');
      expect(arg.moderation_issues).toContain('email');
    });

    it('clears a previously-flagged post when clean content passes re-moderation', async () => {
      wireSupabase({
        existing: { data: { ...EXISTING_POST, moderation_status: 'flagged' }, error: null },
      });
      (readBody as any).mockResolvedValue(validBody({ description: 'A clean honest description of what I want' }));
      const res = await handler(evt());
      expect(res.flagged).toBe(false);
      const arg = lastUpdateArg();
      expect(arg.status).toBe('active');
      expect(arg.moderation_status).toBe('approved');
      expect(arg.moderation_issues).toEqual([]);
    });

    it('does NOT clear a flagged post when the update touches neither title nor description', async () => {
      wireSupabase({
        existing: { data: { ...EXISTING_POST, moderation_status: 'flagged' }, error: null },
      });
      (readBody as any).mockResolvedValue({ currency: 'USD' });
      const res = await handler(evt());
      expect(res.flagged).toBe(false);
      const arg = lastUpdateArg();
      expect(arg).not.toHaveProperty('status');
      expect(arg).not.toHaveProperty('moderation_status');
    });

    it('does not set moderation fields on a clean update to a non-flagged post', async () => {
      const arg = await handler(evt()).then(() => lastUpdateArg());
      expect(arg).not.toHaveProperty('status');
      expect(arg).not.toHaveProperty('moderation_status');
      expect(arg).not.toHaveProperty('moderation_issues');
    });

    it('dedupes moderation_issues when flagged', async () => {
      // Both title and description carry an email -> issue 'email' appears twice
      // before the Set dedupe.
      (readBody as any).mockResolvedValue(
        validBody({
          title: 'email me a@b.com',
          description: 'also email c@d.com please for details about the engine',
        })
      );
      const res = await handler(evt());
      expect(res.flagged).toBe(true);
      const issues = lastUpdateArg().moderation_issues as string[];
      expect(issues.filter((i) => i === 'email')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Update write target + error path
  // -------------------------------------------------------------------------
  describe('update write', () => {
    it('updates the wanted_posts row scoped to the route id', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('wanted_posts');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledTimes(1);
      // The final .eq for the update is scoped to the post id.
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', POST_ID);
    });

    it('throws 500 when the update errors', async () => {
      wireSupabase({ update: { data: null, error: { message: 'db down' } } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to update wanted post',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: return shape
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('returns { success, post, flagged } with the updated row', async () => {
      const updated = { id: POST_ID, title: 'Updated: looking for a 1275 engine' };
      wireSupabase({ update: { data: updated, error: null } });
      const res = await handler(evt());
      expect(res).toEqual({ success: true, post: updated, flagged: false });
    });
  });

  // -------------------------------------------------------------------------
  // Catch-all error wrapping
  // -------------------------------------------------------------------------
  describe('unexpected error wrapping', () => {
    it('wraps a non-H3 error (no statusCode) thrown after auth as a 500', async () => {
      (readBody as any).mockRejectedValueOnce(new Error('parse exploded'));
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 500,
        message: 'Failed to update wanted post',
      });
    });

    it('re-throws an H3 error unchanged (preserves its statusCode)', async () => {
      (getServiceClient as any).mockImplementationOnce(() => {
        throw Object.assign(new Error('teapot'), { statusCode: 418 });
      });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 418 });
    });
  });
});

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
// rateLimit is NOT mocked — the real middleware runs (with setResponseHeader
// stubbed) so the moderate preset (10/min) genuinely gates; we reset its store
// in beforeEach.
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

const handler = (await import('~~/server/api/exchange/external-listings/notify-submit.post')).default;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const USER = { id: 'user-1', email: 'submitter@example.com' };

/**
 * Minimal h3 event. The rate-limit middleware reads `event.context.user?.id`,
 * so `context` must exist. All request accessors (readBody/getHeader/...) are
 * globally mocked and ignore the event arg.
 */
function evt(): any {
  return { context: {} };
}

/** A complete external_listings row owned by USER. */
const VALID_FIND = {
  id: 'find-1',
  submitted_by: 'user-1',
  title: '1965 Morris Mini on Bring a Trailer',
  source_url: 'https://bringatrailer.com/listing/abc',
  source_site: 'bringatrailer',
};

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Configure the service-client mock. The route calls:
 *   1. external_listings...single()   (find lookup)
 *   2. profiles...maybeSingle()       (submitter display_name)
 */
function wireSupabase(
  opts: {
    find?: { data: any; error: any };
    submitter?: { data: any; error: any };
  } = {}
) {
  mockSupabase = createMockSupabaseClient();
  const findRes = opts.find ?? { data: { ...VALID_FIND }, error: null };
  const submitterRes = opts.submitter ?? { data: { display_name: 'Mini Mike' }, error: null };
  mockSupabase._mockSingle.mockResolvedValueOnce(findRes);
  mockSupabase._mockMaybeSingle.mockResolvedValueOnce(submitterRes);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  _resetRateLimitStore();
  vi.clearAllMocks();

  // Default: authenticated user owns a clean find that resolves successfully.
  (requireUserClient as any).mockResolvedValue({ user: { ...USER } });
  (readBody as any).mockResolvedValue({ findId: 'find-1' });
  (getHeader as any).mockImplementation((_e: any, n: string) =>
    n === 'x-real-ip' ? '9.9.9.9' : n === 'authorization' ? 'Bearer tok' : undefined
  );
  wireSupabase();
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/exchange/external-listings/notify-submit.post', () => {
  // -------------------------------------------------------------------------
  // Rate limiting (real middleware)
  // -------------------------------------------------------------------------
  describe('rate limiting', () => {
    it('throws 429 once the moderate per-IP limit (10/min) is exhausted', async () => {
      // 10 allowed, the 11th from the same IP (no event.context.user) is blocked.
      for (let i = 0; i < 10; i++) {
        wireSupabase();
        await handler(evt());
      }
      wireSupabase();
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
    });

    it('does not enqueue when rate-limited', async () => {
      for (let i = 0; i < 10; i++) {
        wireSupabase();
        await handler(evt());
      }
      (queueAdminNotification as any).mockClear();
      wireSupabase();
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 429 });
      expect(queueAdminNotification).not.toHaveBeenCalled();
    });
  });

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

    it('does not read the body or query when auth fails', async () => {
      (requireUserClient as any).mockRejectedValueOnce(
        Object.assign(new Error('Authentication required'), { statusCode: 401 })
      );
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
      expect(readBody).not.toHaveBeenCalled();
      expect(getServiceClient).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findId validation
  // -------------------------------------------------------------------------
  describe('findId validation', () => {
    it('throws 400 when findId is missing', async () => {
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'findId is required',
      });
    });

    it('throws 400 when the body is null', async () => {
      (readBody as any).mockResolvedValue(null);
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 when findId is an empty string (falsy)', async () => {
      (readBody as any).mockResolvedValue({ findId: '' });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        message: 'findId is required',
      });
    });

    it('does not touch the service client when findId is missing', async () => {
      (readBody as any).mockResolvedValue({});
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      expect(getServiceClient).not.toHaveBeenCalled();
      expect(queueAdminNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Find lookup -> 404
  // -------------------------------------------------------------------------
  describe('find lookup', () => {
    it('queries external_listings by the supplied findId', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('external_listings');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'find-1');
      expect(mockSupabase._queryBuilder.single).toHaveBeenCalled();
    });

    it('selects only ownership/notification columns (no PII / email)', async () => {
      await handler(evt());
      const selectArg = mockSupabase._mockSelect.mock.calls[0][0];
      expect(selectArg).toBe('id, submitted_by, title, source_url, source_site');
      expect(selectArg).not.toContain('email');
    });

    it('throws 404 when the lookup returns an error', async () => {
      wireSupabase({ find: { data: null, error: { message: 'boom' } } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 404,
        message: 'Find not found',
      });
    });

    it('throws 404 when the find is missing (null data, no error)', async () => {
      wireSupabase({ find: { data: null, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    });

    it('does not enqueue when the find is not found', async () => {
      wireSupabase({ find: { data: null, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
      expect(queueAdminNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Ownership gate -> 403
  // -------------------------------------------------------------------------
  describe('ownership gate', () => {
    it('throws 403 when the find was submitted by another user', async () => {
      wireSupabase({ find: { data: { ...VALID_FIND, submitted_by: 'someone-else' }, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 403,
        message: 'You can only notify on your own submission',
      });
    });

    it('does not enqueue or look up the submitter when ownership fails', async () => {
      wireSupabase({ find: { data: { ...VALID_FIND, submitted_by: 'someone-else' }, error: null } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
      expect(queueAdminNotification).not.toHaveBeenCalled();
      // profiles maybeSingle is only reached after the ownership check passes.
      expect(mockSupabase._mockMaybeSingle).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: submitter resolution + admin enqueue + return shape
  // -------------------------------------------------------------------------
  describe('happy path', () => {
    it('returns { success: true }', async () => {
      const res = await handler(evt());
      expect(res).toEqual({ success: true });
    });

    it('looks up the submitter profile by submitted_by', async () => {
      await handler(evt());
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockSupabase._queryBuilder.maybeSingle).toHaveBeenCalled();
    });

    it('enqueues admin_find_pending with findTitle, sourceSite, submitterName', async () => {
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledTimes(1);
      expect(queueAdminNotification).toHaveBeenCalledWith({
        eventType: 'admin_find_pending',
        payload: {
          findTitle: '1965 Morris Mini on Bring a Trailer',
          sourceSite: 'bringatrailer',
          submitterName: 'Mini Mike',
        },
      });
    });

    it('defaults sourceSite to "link" when source_site is null', async () => {
      wireSupabase({ find: { data: { ...VALID_FIND, source_site: null }, error: null } });
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ sourceSite: 'link' }) })
      );
    });

    it('defaults sourceSite to "link" when source_site is an empty string', async () => {
      wireSupabase({ find: { data: { ...VALID_FIND, source_site: '' }, error: null } });
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ sourceSite: 'link' }) })
      );
    });

    it('defaults submitterName to "a member" when no profile is found', async () => {
      wireSupabase({ submitter: { data: null, error: null } });
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ submitterName: 'a member' }) })
      );
    });

    it('defaults submitterName to "a member" when display_name is null', async () => {
      wireSupabase({ submitter: { data: { display_name: null }, error: null } });
      await handler(evt());
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ submitterName: 'a member' }) })
      );
    });

    it('still succeeds when the submitter lookup errors (error is ignored)', async () => {
      // The route destructures only { data: submitter } and ignores any error,
      // falling back to "a member". A profile-lookup failure must not block.
      wireSupabase({ submitter: { data: null, error: { message: 'profiles down' } } });
      const res = await handler(evt());
      expect(res).toEqual({ success: true });
      expect(queueAdminNotification).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ submitterName: 'a member' }) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation (no try/catch in this route -> errors bubble raw)
  // -------------------------------------------------------------------------
  describe('error propagation', () => {
    it('propagates a thrown error from the find lookup (no 500 wrapping)', async () => {
      mockSupabase = createMockSupabaseClient();
      mockSupabase._mockSingle.mockRejectedValueOnce(Object.assign(new Error('teapot'), { statusCode: 418 }));
      (getServiceClient as any).mockReturnValue(mockSupabase);
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 418 });
    });

    it('propagates a queueAdminNotification rejection (fire-and-forget is the caller, not here)', async () => {
      // This route awaits queueAdminNotification; the notificationQueue helper is
      // itself fire-and-forget (never throws), but if it ever did, the route does
      // not swallow it. The caller (useExternalListings) wraps the whole call.
      (queueAdminNotification as any).mockRejectedValueOnce(new Error('queue exploded'));
      await expect(handler(evt())).rejects.toThrow('queue exploded');
    });
  });
});

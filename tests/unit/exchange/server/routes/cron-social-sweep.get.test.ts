/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports its deps via relative specifiers
// (../../../utils/exchange/socialMedia, ../../../utils/supabase). Vitest
// resolves those to the same absolute modules as the `~~/server/utils/*` ids
// below, and vi.mock matches by resolved id.
//
// postListingToSocialMedia is a network fan-out (Meta/Bluesky Graph API) — fully
// mocked. We assert it's called once per candidate with (listing, supabaseClient)
// and that the sweep is resilient to individual post failures. getServiceClient
// returns the chainable mock so we can drive / inspect the candidate query.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/exchange/socialMedia', () => ({
  postListingToSocialMedia: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));

import { postListingToSocialMedia } from '~~/server/utils/exchange/socialMedia';
import { getServiceClient } from '~~/server/utils/supabase';

const handler = (await import('~~/server/api/cron/exchange/social-sweep.get')).default;

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------
const CRON_SECRET = 'super-secret-cron-token';

function listing(id: string) {
  return {
    id,
    title: `Listing ${id}`,
    tier: 'paid',
    status: 'active',
    promoted_on_social: false,
    listing_photos: [{ storage_path: `photos/${id}.jpg`, display_order: 0, is_primary: true }],
  };
}

/** Build N listing fixtures. */
function listings(n: number) {
  return Array.from({ length: n }, (_, i) => listing(`l${i + 1}`));
}

const evt = () => ({}) as any;

/**
 * Configure useRuntimeConfig for this test. Default: cron secret set + exchange
 * enabled (happy path). Override per-case.
 */
function setRuntimeConfig(opts?: { cronSecret?: string | undefined; exchangeEnabled?: boolean }) {
  const cronSecret = 'cronSecret' in (opts || {}) ? opts!.cronSecret : CRON_SECRET;
  const exchangeEnabled = opts?.exchangeEnabled ?? true;
  (useRuntimeConfig as any).mockReturnValue({
    cronSecret,
    public: { exchangeEnabled },
  });
}

/** Set the Authorization header the route reads via getHeader(event,'authorization'). */
function setAuthHeader(value: string | undefined) {
  (getHeader as any).mockImplementation((_e: any, name: string) =>
    name === 'authorization' ? value : undefined
  );
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * Make the candidate-listings query resolve to `result`. The route chains
 *   .from('listings').select(...).eq().eq().eq().order().limit(MAX)
 * which terminates on the thenable builder, so we override the builder's `then`.
 */
function setQueryResult(result: { data: any; error: any }) {
  (mockSupabase._queryBuilder as any).then = vi.fn((resolve: any) => resolve(result));
}

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  (getServiceClient as any).mockReturnValue(mockSupabase);
  (postListingToSocialMedia as any).mockResolvedValue(undefined);
  setRuntimeConfig();
  setAuthHeader(`Bearer ${CRON_SECRET}`);
  // Default: no candidates.
  setQueryResult({ data: [], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Auth gate (cron secret) — fails closed
// ===========================================================================
describe('cron/exchange/social-sweep — auth', () => {
  it('401s when the Authorization header is missing', async () => {
    setAuthHeader(undefined);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(postListingToSocialMedia).not.toHaveBeenCalled();
  });

  it('401s when the bearer token does not match cronSecret', async () => {
    setAuthHeader('Bearer wrong-token');
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  it('401s when the header is the raw secret without the Bearer prefix', async () => {
    setAuthHeader(CRON_SECRET);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('401s (fails closed) when cronSecret is unset even if a bearer header is present', async () => {
    setRuntimeConfig({ cronSecret: undefined });
    setAuthHeader('Bearer ');
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  it('401s when cronSecret is empty string (falsy) regardless of header', async () => {
    setRuntimeConfig({ cronSecret: '' });
    setAuthHeader('Bearer ');
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('reads the authorization header (not some other header) for the secret', async () => {
    // getHeader returns undefined for anything but a matching name; ensure the
    // route asks for 'authorization' specifically.
    const spy = getHeader as any;
    setAuthHeader(`Bearer ${CRON_SECRET}`);
    setQueryResult({ data: [], error: null });
    await handler(evt());
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'authorization');
  });
});

// ===========================================================================
// Exchange flag gate
// ===========================================================================
describe('cron/exchange/social-sweep — exchange flag', () => {
  it('returns {skipped} without querying when exchangeEnabled is false', async () => {
    setRuntimeConfig({ exchangeEnabled: false });
    const res = await handler(evt());
    expect(res).toEqual({ swept: 0, processed: 0, skipped: 'exchange disabled' });
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(postListingToSocialMedia).not.toHaveBeenCalled();
  });

  it('still enforces auth BEFORE the flag check (bad secret while flag off => 401)', async () => {
    setRuntimeConfig({ exchangeEnabled: false, cronSecret: CRON_SECRET });
    setAuthHeader('Bearer nope');
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ===========================================================================
// Candidate query — paid + active + not-yet-promoted, bounded
// ===========================================================================
describe('cron/exchange/social-sweep — candidate query', () => {
  it('queries listings filtered to tier=paid, status=active, promoted_on_social=false', async () => {
    setQueryResult({ data: [], error: null });
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('listings');
    // select pulls the listing + its photos
    expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*, listing_photos(*)');

    const eqCalls = (mockSupabase._queryBuilder.eq as any).mock.calls;
    expect(eqCalls).toContainEqual(['tier', 'paid']);
    expect(eqCalls).toContainEqual(['status', 'active']);
    expect(eqCalls).toContainEqual(['promoted_on_social', false]);
  });

  it('orders oldest-promoted-first (nullsFirst) and bounds the sweep to MAX_PER_SWEEP (10)', async () => {
    setQueryResult({ data: [], error: null });
    await handler(evt());

    expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('promoted_on_social_at', {
      ascending: true,
      nullsFirst: true,
    });
    expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(10);
  });
});

// ===========================================================================
// Happy path — posts each candidate, returns {swept, processed}
// ===========================================================================
describe('cron/exchange/social-sweep — posting', () => {
  it('returns {swept:0, processed:0} when there are no candidates', async () => {
    setQueryResult({ data: [], error: null });
    const res = await handler(evt());
    expect(res).toEqual({ swept: 0, processed: 0 });
    expect(postListingToSocialMedia).not.toHaveBeenCalled();
  });

  it('treats a null data result as zero candidates (no throw)', async () => {
    setQueryResult({ data: null, error: null });
    const res = await handler(evt());
    expect(res).toEqual({ swept: 0, processed: 0 });
    expect(postListingToSocialMedia).not.toHaveBeenCalled();
  });

  it('posts every candidate and reports swept===processed on full success', async () => {
    const candidates = listings(3);
    setQueryResult({ data: candidates, error: null });

    const res = await handler(evt());

    expect(postListingToSocialMedia).toHaveBeenCalledTimes(3);
    expect(res).toEqual({ swept: 3, processed: 3 });
  });

  it('passes the listing and the service supabase client to postListingToSocialMedia', async () => {
    const candidates = listings(2);
    setQueryResult({ data: candidates, error: null });

    await handler(evt());

    expect(postListingToSocialMedia).toHaveBeenNthCalledWith(1, candidates[0], mockSupabase);
    expect(postListingToSocialMedia).toHaveBeenNthCalledWith(2, candidates[1], mockSupabase);
  });

  it('continues sweeping after one listing throws and counts only successful posts', async () => {
    const candidates = listings(3);
    setQueryResult({ data: candidates, error: null });

    // Second listing fails; the sweep must still attempt all three.
    (postListingToSocialMedia as any)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Meta API 500'))
      .mockResolvedValueOnce(undefined);

    const res = await handler(evt());

    expect(postListingToSocialMedia).toHaveBeenCalledTimes(3);
    // swept counts candidates attempted; processed counts only those that
    // didn't throw.
    expect(res).toEqual({ swept: 3, processed: 2 });
  });

  it('reports processed:0 but swept:N when every post fails', async () => {
    const candidates = listings(2);
    setQueryResult({ data: candidates, error: null });
    (postListingToSocialMedia as any).mockRejectedValue(new Error('boom'));

    const res = await handler(evt());

    expect(res).toEqual({ swept: 2, processed: 0 });
    expect(postListingToSocialMedia).toHaveBeenCalledTimes(2);
  });

  it('does not throw when a failing listing has no id (logs use optional chaining)', async () => {
    const bad: any = { tier: 'paid', status: 'active', promoted_on_social: false };
    setQueryResult({ data: [bad], error: null });
    (postListingToSocialMedia as any).mockRejectedValue(new Error('no id'));

    const res = await handler(evt());
    expect(res).toEqual({ swept: 1, processed: 0 });
  });
});

// ===========================================================================
// Error path — query failure surfaces as 500
// ===========================================================================
describe('cron/exchange/social-sweep — query error', () => {
  it('throws 500 when the candidate query returns an error', async () => {
    setQueryResult({ data: null, error: { message: 'connection reset' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(postListingToSocialMedia).not.toHaveBeenCalled();
  });

  it('does not post anything if the query errors even with data present', async () => {
    setQueryResult({ data: listings(2), error: { message: 'partial failure' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(postListingToSocialMedia).not.toHaveBeenCalled();
  });
});

/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The route imports its deps via relative specifiers
// (../../../utils/exchange/socialMedia, ../../../utils/exchange/imageProcessor,
// ../../../utils/adminAuth, ../../../utils/supabase). Vitest resolves those to
// the same absolute modules as the `~~/server/utils/*` ids below, and vi.mock
// matches by resolved id.
//
// socialMedia: postTo{Facebook,Instagram,Bluesky} are network calls — fully
// mocked. getPhotoPublicUrl is mocked to a deterministic transform so we can
// assert what URLs were passed to the post functions. Its real impl just
// prefixes an S3 base, so faking it loses no meaningful coverage of the route.
// imageProcessor: prepareImageForInstagram / cleanupTempImages do storage I/O —
// mocked.
// ---------------------------------------------------------------------------
vi.mock('~~/server/utils/exchange/socialMedia', () => ({
  postToFacebook: vi.fn(),
  postToInstagram: vi.fn(),
  postToBluesky: vi.fn(),
  getPhotoPublicUrl: vi.fn((path: string) => `https://cdn.test/${path}`),
}));
vi.mock('~~/server/utils/exchange/imageProcessor', () => ({
  prepareImageForInstagram: vi.fn(),
  cleanupTempImages: vi.fn(),
}));
vi.mock('~~/server/utils/adminAuth', () => ({
  requireAdminAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));

import {
  postToFacebook,
  postToInstagram,
  postToBluesky,
  getPhotoPublicUrl,
} from '~~/server/utils/exchange/socialMedia';
import { prepareImageForInstagram, cleanupTempImages } from '~~/server/utils/exchange/imageProcessor';
import { requireAdminAuth } from '~~/server/utils/adminAuth';
import { getServiceClient } from '~~/server/utils/supabase';

const handler = (await import('~~/server/api/admin/exchange/social-retry.post')).default;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const LISTING_ID = 'listing-123';

/** A listing with photos out of display order + one primary, to exercise the sort. */
const LISTING = {
  id: LISTING_ID,
  title: 'Austin Cooper S',
  description: 'A nice Mini',
  slug: 'austin-cooper-s',
  price: 12000,
  currency: 'GBP',
  year: 1966,
  model: 'Cooper S',
  location: 'London',
  listing_category: 'vehicle',
  condition: 'used',
  tier: 'premium',
  listing_photos: [
    { storage_path: 'photos/c.jpg', display_order: 2, is_primary: false, category: 'exterior' },
    { storage_path: 'photos/primary.jpg', display_order: 5, is_primary: true, category: 'exterior' },
    { storage_path: 'photos/a.jpg', display_order: 0, is_primary: false, category: 'interior' },
    { storage_path: 'photos/b.jpg', display_order: 1, is_primary: false, category: 'interior' },
  ],
};

const OK = (postId: string) => ({ success: true, postId });
const FAIL = (error = 'boom') => ({ success: false, error });

function evt(): any {
  return { context: {} };
}

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/**
 * `_mockUpdate` is shared across BOTH update sites — the listing_promotions
 * feature-merge (payload carries `features`) and the listings promoted flag
 * (payload carries `promoted_on_social`). These helpers pick the intended one.
 */
function featuresUpdatePayload(): any | undefined {
  return (mockSupabase._mockUpdate as any).mock.calls
    .map((c: any[]) => c[0])
    .find((p: any) => p && Object.prototype.hasOwnProperty.call(p, 'features'));
}
function promotedUpdatePayload(): any | undefined {
  return (mockSupabase._mockUpdate as any).mock.calls
    .map((c: any[]) => c[0])
    .find((p: any) => p && Object.prototype.hasOwnProperty.call(p, 'promoted_on_social'));
}

/**
 * Wire a fresh chainable supabase client.
 *
 * The route calls `.single()` exactly twice, in order:
 *   1. listings.select(...).eq('id', id).single()                              -> listing
 *   2. listing_promotions.select('id, features').eq(...).order().limit(1).single() -> promo
 *
 * Mutations resolve through the builder's default `then` ({data:[],error:null}):
 *   - listing_promotions.update(...).eq(...)  (when a promo exists)
 *   - listing_promotions.insert(...)          (when no promo exists)
 *   - listings.update(...).eq(...)            (when allSucceeded)
 */
function wire(listing: { data: any; error: any }, promo: { data: any; error: any }) {
  mockSupabase = createMockSupabaseClient();
  (mockSupabase._mockSingle as any).mockReset();
  (mockSupabase._mockSingle as any).mockResolvedValueOnce(listing).mockResolvedValueOnce(promo);
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  // adminAuth passes by default.
  (requireAdminAuth as any).mockResolvedValue({ user: { id: 'admin-1' }, profile: { is_admin: true } });
  // getPhotoPublicUrl mock is cleared by clearAllMocks; restore its impl.
  (getPhotoPublicUrl as any).mockImplementation((path: string) => `https://cdn.test/${path}`);
  // body default: retry all three platforms for the fixture listing.
  (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: ['facebook', 'instagram', 'bluesky'] });
  // Instagram prep: passthrough, not cropped, by default.
  (prepareImageForInstagram as any).mockImplementation(async (url: string) => ({ url, wasCropped: false }));
  (cleanupTempImages as any).mockResolvedValue(undefined);
  // All platform posts succeed by default.
  (postToFacebook as any).mockResolvedValue(OK('fb-1'));
  (postToInstagram as any).mockResolvedValue(OK('ig-1'));
  (postToBluesky as any).mockResolvedValue(OK('bs-1'));
  // Default: a promo row exists with prior features.
  wire(
    { data: { ...LISTING }, error: null },
    { data: { id: 'promo-1', features: { existing_key: 'keep' } }, error: null }
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('server/api/admin/exchange/social-retry.post', () => {
  // =========================================================================
  //  Auth (401 / 403)
  // =========================================================================
  it('propagates 401 from requireAdminAuth before any db / social work', async () => {
    (requireAdminAuth as any).mockRejectedValue(Object.assign(new Error('Authentication required'), { statusCode: 401 }));

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    // getServiceClient is called only after auth passes.
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(readBody).not.toHaveBeenCalled();
    expect(postToFacebook).not.toHaveBeenCalled();
  });

  it('propagates 403 from requireAdminAuth (authenticated but not admin)', async () => {
    (requireAdminAuth as any).mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }));

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(postToInstagram).not.toHaveBeenCalled();
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Validation — listingId (400)
  // =========================================================================
  it('throws 400 when listingId is missing', async () => {
    (readBody as any).mockResolvedValue({ platforms: ['facebook'] });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Missing listingId' });
    // The guard runs before the listing fetch / social work.
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(postToFacebook).not.toHaveBeenCalled();
  });

  it('throws 400 when listingId is an empty string', async () => {
    (readBody as any).mockResolvedValue({ listingId: '', platforms: ['facebook'] });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Missing listingId' });
  });

  // =========================================================================
  //  Validation — platforms array (400)
  // =========================================================================
  it('throws 400 when platforms is missing', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing or invalid platforms array',
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('throws 400 when platforms is not an array', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: 'facebook' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing or invalid platforms array',
    });
  });

  it('throws 400 when platforms is an empty array', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: [] });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing or invalid platforms array',
    });
  });

  // INVARIANT: the listingId guard runs before the platforms guard. When both
  // are bad, the listingId 400 (not the platforms 400) is thrown.
  it('checks listingId before platforms (missing both -> Missing listingId)', async () => {
    (readBody as any).mockResolvedValue({});
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Missing listingId' });
  });

  // =========================================================================
  //  Listing not found (404)
  // =========================================================================
  it('throws 404 when the listing is missing (null data)', async () => {
    wire({ data: null, error: null }, { data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Listing not found' });
    // No social posting once the listing is absent.
    expect(postToFacebook).not.toHaveBeenCalled();
    expect(postToInstagram).not.toHaveBeenCalled();
    expect(postToBluesky).not.toHaveBeenCalled();
  });

  it('throws 404 when the listing lookup errors', async () => {
    wire({ data: null, error: { message: 'no rows' } }, { data: null, error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404, statusMessage: 'Listing not found' });
  });

  // =========================================================================
  //  Happy path — all platforms succeed
  // =========================================================================
  it('posts to every requested platform and returns success + per-platform results', async () => {
    const result = await handler(evt());

    expect(result).toEqual({
      success: true,
      results: { facebook: OK('fb-1'), instagram: OK('ig-1'), bluesky: OK('bs-1') },
      allSucceeded: true,
    });
    expect(postToFacebook).toHaveBeenCalledTimes(1);
    expect(postToInstagram).toHaveBeenCalledTimes(1);
    expect(postToBluesky).toHaveBeenCalledTimes(1);
  });

  it('fetches the listing filtered by listingId via .single()', async () => {
    await handler(evt());
    expect(mockSupabase.from).toHaveBeenCalledWith('listings');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', LISTING_ID);
    expect(mockSupabase._mockSingle).toHaveBeenCalled();
  });

  it('passes photo URLs sorted primary-first then by display_order, capped at 5, to Facebook/Bluesky', async () => {
    await handler(evt());

    // Sort: primary.jpg first, then a(0), b(1), c(2).
    const expectedUrls = [
      'https://cdn.test/photos/primary.jpg',
      'https://cdn.test/photos/a.jpg',
      'https://cdn.test/photos/b.jpg',
      'https://cdn.test/photos/c.jpg',
    ];
    expect((postToFacebook as any).mock.calls[0][1]).toEqual(expectedUrls);
    expect((postToBluesky as any).mock.calls[0][1]).toEqual(expectedUrls);
    // The listing object is passed through as the first arg.
    expect((postToFacebook as any).mock.calls[0][0]).toMatchObject({ id: LISTING_ID, title: LISTING.title });
  });

  it('caps photos at the first 5 after sorting', async () => {
    const sixPhotos = Array.from({ length: 6 }, (_, i) => ({
      storage_path: `photos/p${i}.jpg`,
      display_order: i,
      is_primary: false,
      category: 'exterior',
    }));
    wire({ data: { ...LISTING, listing_photos: sixPhotos }, error: null }, { data: { id: 'promo-1', features: {} }, error: null });

    await handler(evt());
    expect((postToFacebook as any).mock.calls[0][1]).toHaveLength(5);
  });

  // =========================================================================
  //  Instagram pre-processing
  // =========================================================================
  it('runs prepareImageForInstagram per photo and posts the prepared URLs to Instagram', async () => {
    (prepareImageForInstagram as any).mockImplementation(async (url: string) => ({
      url: url.replace('cdn.test', 'cropped.test'),
      wasCropped: false,
    }));

    await handler(evt());

    // One prep call per sorted photo (4 photos in the fixture).
    expect(prepareImageForInstagram).toHaveBeenCalledTimes(4);
    const igUrls = (postToInstagram as any).mock.calls[0][1];
    expect(igUrls).toEqual([
      'https://cropped.test/photos/primary.jpg',
      'https://cropped.test/photos/a.jpg',
      'https://cropped.test/photos/b.jpg',
      'https://cropped.test/photos/c.jpg',
    ]);
  });

  it('cleans up temp images when any image was cropped for Instagram', async () => {
    (prepareImageForInstagram as any).mockImplementation(async (url: string, _id: string, i: number) => ({
      url,
      wasCropped: i === 0, // crop the first one only
    }));

    await handler(evt());
    expect(cleanupTempImages).toHaveBeenCalledTimes(1);
    expect(cleanupTempImages).toHaveBeenCalledWith(LISTING_ID, mockSupabase);
  });

  it('does NOT clean up temp images when nothing was cropped', async () => {
    // default prepareImageForInstagram returns wasCropped:false
    await handler(evt());
    expect(cleanupTempImages).not.toHaveBeenCalled();
  });

  it('does not invoke Instagram prep when instagram is not requested', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: ['facebook'] });
    await handler(evt());
    expect(prepareImageForInstagram).not.toHaveBeenCalled();
    expect(postToInstagram).not.toHaveBeenCalled();
    expect(cleanupTempImages).not.toHaveBeenCalled();
  });

  // =========================================================================
  //  Selective platforms
  // =========================================================================
  it('only posts to the platforms named in the body', async () => {
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: ['bluesky'] });
    const result = await handler(evt());

    expect(postToFacebook).not.toHaveBeenCalled();
    expect(postToInstagram).not.toHaveBeenCalled();
    expect(postToBluesky).toHaveBeenCalledTimes(1);
    expect(result.results).toEqual({ bluesky: OK('bs-1') });
    expect(result.allSucceeded).toBe(true);
  });

  // =========================================================================
  //  Feature-merge into existing promotion row
  // =========================================================================
  it('merges successful post IDs (preserving existing features) into the existing promotion row', async () => {
    await handler(evt());

    expect(mockSupabase.from).toHaveBeenCalledWith('listing_promotions');
    const updatePayload = featuresUpdatePayload();
    expect(updatePayload).toBeTruthy();
    expect(updatePayload.features).toMatchObject({
      existing_key: 'keep',
      facebook_post_id: 'fb-1',
      instagram_post_id: 'ig-1',
      bluesky_post_id: 'bs-1',
    });
    // retry timestamps recorded for each succeeding platform
    expect(updatePayload.features.facebook_retry_at).toEqual(expect.any(String));
    expect(updatePayload.features.instagram_retry_at).toEqual(expect.any(String));
    expect(updatePayload.features.bluesky_retry_at).toEqual(expect.any(String));
    // update targets the promo row id
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'promo-1');
    // existing-promo path must NOT insert
    expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
  });

  it('only writes features for platforms that succeeded (failed platform omitted)', async () => {
    (postToInstagram as any).mockResolvedValue(FAIL('rate limited'));

    const result = await handler(evt());

    const updatePayload = featuresUpdatePayload();
    expect(updatePayload.features).toHaveProperty('facebook_post_id', 'fb-1');
    expect(updatePayload.features).toHaveProperty('bluesky_post_id', 'bs-1');
    expect(updatePayload.features).not.toHaveProperty('instagram_post_id');
    expect(updatePayload.features).not.toHaveProperty('instagram_retry_at');
    // a failure means not all requested succeeded
    expect(result.allSucceeded).toBe(false);
    expect(result.results.instagram).toEqual(FAIL('rate limited'));
  });

  it('does NOT record a post id when success is true but postId is falsy', async () => {
    // INVARIANT: features are written only when BOTH success && postId are truthy.
    (postToFacebook as any).mockResolvedValue({ success: true, postId: '' });
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: ['facebook'] });
    wire({ data: { ...LISTING }, error: null }, { data: { id: 'promo-1', features: {} }, error: null });

    const result = await handler(evt());

    // No socialFeatures written -> no features-update and no insert into promos.
    expect(featuresUpdatePayload()).toBeUndefined();
    expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    // success:true with no postId still counts toward allSucceeded (keys off .success),
    // so the listings promoted flag IS written.
    expect(result.allSucceeded).toBe(true);
    expect(promotedUpdatePayload()).toBeTruthy();
  });

  // =========================================================================
  //  Feature-insert when no promotion row exists (free listings)
  // =========================================================================
  it('inserts a new promotion row when none exists, stamping tier + social_posted_at', async () => {
    wire({ data: { ...LISTING, tier: 'free' }, error: null }, { data: null, error: null });

    await handler(evt());

    // No existing promo -> insert path, not a features-update.
    expect(featuresUpdatePayload()).toBeUndefined();
    expect(mockSupabase._mockInsert).toHaveBeenCalledTimes(1);
    const insertPayload = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertPayload).toMatchObject({
      listing_id: LISTING_ID,
      tier: 'free',
      amount_paid: 0,
      payment_method: 'admin',
    });
    expect(insertPayload.features).toMatchObject({
      facebook_post_id: 'fb-1',
      instagram_post_id: 'ig-1',
      bluesky_post_id: 'bs-1',
    });
    expect(insertPayload.features.social_posted_at).toEqual(expect.any(String));
  });

  it("defaults tier to 'free' on insert when the listing has no tier", async () => {
    wire({ data: { ...LISTING, tier: null }, error: null }, { data: null, error: null });
    await handler(evt());
    const insertPayload = (mockSupabase._mockInsert as any).mock.calls[0][0];
    expect(insertPayload.tier).toBe('free');
  });

  it('does not touch listing_promotions at all when no platform produced a post id', async () => {
    (postToFacebook as any).mockResolvedValue(FAIL());
    (postToInstagram as any).mockResolvedValue(FAIL());
    (postToBluesky as any).mockResolvedValue(FAIL());

    const result = await handler(evt());

    expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    expect(result.allSucceeded).toBe(false);
  });

  // =========================================================================
  //  promoted_on_social flag
  // =========================================================================
  it('marks the listing promoted_on_social when every requested platform succeeds', async () => {
    await handler(evt());

    // The listing-update should set the flag.
    const listingUpdate = (mockSupabase._mockUpdate as any).mock.calls.find(
      (c: any[]) => c[0] && Object.prototype.hasOwnProperty.call(c[0], 'promoted_on_social')
    );
    expect(listingUpdate).toBeTruthy();
    expect(listingUpdate[0]).toMatchObject({ promoted_on_social: true });
    expect(listingUpdate[0].promoted_on_social_at).toEqual(expect.any(String));
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', LISTING_ID);
  });

  it('does NOT mark promoted_on_social when any requested platform fails', async () => {
    (postToBluesky as any).mockResolvedValue(FAIL('auth'));

    const result = await handler(evt());

    const listingUpdate = (mockSupabase._mockUpdate as any).mock.calls.find(
      (c: any[]) => c[0] && Object.prototype.hasOwnProperty.call(c[0], 'promoted_on_social')
    );
    expect(listingUpdate).toBeFalsy();
    expect(result.allSucceeded).toBe(false);
  });

  it('marks promoted only across the REQUESTED platforms (a non-requested failing platform is irrelevant)', async () => {
    // Only facebook requested; instagram/bluesky mocks would fail but aren't run.
    (postToInstagram as any).mockResolvedValue(FAIL());
    (postToBluesky as any).mockResolvedValue(FAIL());
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, platforms: ['facebook'] });
    wire({ data: { ...LISTING }, error: null }, { data: { id: 'promo-1', features: {} }, error: null });

    const result = await handler(evt());

    expect(result.allSucceeded).toBe(true);
    const listingUpdate = (mockSupabase._mockUpdate as any).mock.calls.find(
      (c: any[]) => c[0] && Object.prototype.hasOwnProperty.call(c[0], 'promoted_on_social')
    );
    expect(listingUpdate).toBeTruthy();
  });

  // =========================================================================
  //  Edge — listing with no photos
  // =========================================================================
  it('handles a listing with no photos (empty url list passed to platforms)', async () => {
    wire({ data: { ...LISTING, listing_photos: [] }, error: null }, { data: { id: 'promo-1', features: {} }, error: null });

    const result = await handler(evt());
    expect((postToFacebook as any).mock.calls[0][1]).toEqual([]);
    expect(prepareImageForInstagram).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('handles a listing where listing_photos is null', async () => {
    wire({ data: { ...LISTING, listing_photos: null }, error: null }, { data: { id: 'promo-1', features: {} }, error: null });
    const result = await handler(evt());
    expect((postToFacebook as any).mock.calls[0][1]).toEqual([]);
    expect(result.success).toBe(true);
  });

  // =========================================================================
  //  Existing promo with null features merges cleanly
  // =========================================================================
  it('merges into an existing promo whose features are null without error', async () => {
    wire({ data: { ...LISTING }, error: null }, { data: { id: 'promo-9', features: null }, error: null });

    await handler(evt());
    const updatePayload = featuresUpdatePayload();
    expect(updatePayload.features).toMatchObject({ facebook_post_id: 'fb-1' });
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'promo-9');
  });
});

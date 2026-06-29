/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the sibling imageProcessor module. socialMedia.ts imports it relatively
// (`./imageProcessor`); the `~~/` alias resolves to the same absolute module,
// so this mock intercepts both. By default cropping is a no-op pass-through and
// compression returns the buffer unchanged.
// ---------------------------------------------------------------------------
// vi.mock factories are hoisted above all top-level code, so the symbols they
// reference must come from vi.hoisted() (which runs first) rather than plain
// const declarations (TDZ at hoist time). Destructure them back out so the test
// bodies below can use the same mock fns/classes.
const {
  mockPrepareImageForInstagram,
  mockCleanupTempImages,
  mockCompressImageForBluesky,
  mockLogin,
  mockUploadBlob,
  mockPost,
  mockDetectFacets,
  MockBskyAgent,
  MockRichText,
} = vi.hoisted(() => {
  const mockPrepareImageForInstagram = vi.fn(async (url: string) => ({ url, wasCropped: false }));
  const mockCleanupTempImages = vi.fn(async () => {});
  const mockCompressImageForBluesky = vi.fn(async (buf: Buffer) => buf);
  const mockLogin = vi.fn(async () => {});
  const mockUploadBlob = vi.fn(async () => ({ data: { blob: { $type: 'blob', ref: 'blobref' } } }));
  const mockPost = vi.fn(async () => ({ uri: 'at://did:plc:abc/app.bsky.feed.post/postrkey', cid: 'cid123' }));
  const mockDetectFacets = vi.fn(async () => {});

  class MockBskyAgent {
    service: string;
    login = mockLogin;
    uploadBlob = mockUploadBlob;
    post = mockPost;
    constructor(opts: { service: string }) {
      this.service = opts.service;
    }
  }
  class MockRichText {
    text: string;
    facets: any[] = [];
    detectFacets = mockDetectFacets;
    constructor(opts: { text: string }) {
      this.text = opts.text;
    }
  }
  return {
    mockPrepareImageForInstagram,
    mockCleanupTempImages,
    mockCompressImageForBluesky,
    mockLogin,
    mockUploadBlob,
    mockPost,
    mockDetectFacets,
    MockBskyAgent,
    MockRichText,
  };
});

vi.mock('~~/server/utils/exchange/imageProcessor', () => ({
  prepareImageForInstagram: mockPrepareImageForInstagram,
  cleanupTempImages: mockCleanupTempImages,
  compressImageForBluesky: mockCompressImageForBluesky,
}));

vi.mock('@atproto/api', () => ({
  BskyAgent: MockBskyAgent,
  RichText: MockRichText,
}));

import {
  getPhotoPublicUrl,
  generateHashtags,
  formatPostText,
  postToFacebook,
  postToInstagram,
  postToBluesky,
  postListingToSocialMedia,
  _resetIgWaitCacheForTesting,
  type ListingForSocialPost,
} from '~~/server/utils/exchange/socialMedia';

// ---------------------------------------------------------------------------
// Runtime config helpers
// ---------------------------------------------------------------------------
const DEFAULT_PUBLIC = {
  siteUrl: 'https://theminiexchange.com',
  supabaseUrl: 'https://test.supabase.co',
};

/** Fully-configured runtime config (Meta + Bluesky keys present). */
function configAll(overrides: Record<string, any> = {}) {
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { ...DEFAULT_PUBLIC },
    metaAccessToken: 'meta-token',
    metaPageId: 'page-123',
    metaInstagramAccountId: 'ig-456',
    blueskyHandle: 'theminiexchange.bsky.social',
    blueskyAppPassword: 'app-pw',
    ...overrides,
  }));
}

/** Config with NO social keys set (graceful-skip path). */
function configNone(overrides: Record<string, any> = {}) {
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { ...DEFAULT_PUBLIC },
    ...overrides,
  }));
}

/** Build an ofetch-style error carrying a Meta Graph error payload on .data. */
function metaError(error: Record<string, any>, message = 'fetch failed') {
  const e: any = new Error(message);
  e.data = { error };
  return e;
}

const baseListing: ListingForSocialPost = {
  id: 'listing-1',
  title: '1967 Austin Mini Cooper S',
  description: 'A beautifully restored Classic Mini Cooper S in racing green.',
  slug: 'austin-mini-cooper-s',
  price: 25000,
  currency: 'USD',
  year: 1967,
  model: 'Cooper S',
  location: 'London',
  city: 'London',
  state_province: null,
  country: 'United Kingdom',
  listing_category: 'vehicle',
  condition: 'restored',
};

// $fetch is the Nuxt auto-import used for all Meta Graph calls. It's a global
// vi.fn() from vitest.setup. We override its implementation per test.
const $fetch = (globalThis as any).$fetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  _resetIgWaitCacheForTesting();
  vi.clearAllMocks();
  // Re-establish @atproto defaults cleared by clearAllMocks.
  mockLogin.mockResolvedValue(undefined);
  mockUploadBlob.mockResolvedValue({ data: { blob: { $type: 'blob', ref: 'blobref' } } });
  mockPost.mockResolvedValue({ uri: 'at://did:plc:abc/app.bsky.feed.post/postrkey', cid: 'cid123' });
  mockDetectFacets.mockResolvedValue(undefined);
  mockPrepareImageForInstagram.mockImplementation(async (url: string) => ({ url, wasCropped: false }));
  mockCleanupTempImages.mockResolvedValue(undefined);
  mockCompressImageForBluesky.mockImplementation(async (buf: Buffer) => buf);
  // Silence the configured console noise but keep spies inspectable per-test.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  configAll();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ===========================================================================
// getPhotoPublicUrl
// ===========================================================================
describe('getPhotoPublicUrl', () => {
  it('builds a public Supabase storage URL from supabaseUrl', () => {
    const url = getPhotoPublicUrl('abc/photo.jpg');
    expect(url).toBe('https://test.supabase.co/storage/v1/object/public/listing-photos/abc/photo.jpg');
  });

  it('segment-encodes each path part but preserves the slash separators (no %2F)', () => {
    const url = getPhotoPublicUrl('user id/sub dir/my photo.jpg');
    // Spaces are encoded per-segment, slashes stay literal.
    expect(url).toContain('/listing-photos/user%20id/sub%20dir/my%20photo.jpg');
    expect(url).not.toContain('%2F');
  });

  it('encodes special characters within a segment', () => {
    const url = getPhotoPublicUrl('a&b/c?d.png');
    expect(url).toContain('/listing-photos/a%26b/c%3Fd.png');
    expect(url).not.toContain('%2F');
  });

  it('handles a single-segment path', () => {
    expect(getPhotoPublicUrl('photo.jpg')).toBe(
      'https://test.supabase.co/storage/v1/object/public/listing-photos/photo.jpg'
    );
  });
});

// ===========================================================================
// generateHashtags
// ===========================================================================
describe('generateHashtags', () => {
  it('always emits the five brand base tags', () => {
    const tags = generateHashtags({});
    for (const base of ['#ClassicMini', '#MiniCooper', '#TheMiniExchange', '#ClassicMiniDIY', '#ClassicCar']) {
      expect(tags).toContain(base);
    }
  });

  it('returns a single space-joined string', () => {
    const tags = generateHashtags({});
    expect(typeof tags).toBe('string');
    expect(tags.split(' ').every((t) => t.startsWith('#'))).toBe(true);
  });

  it('adds a year tag when year is present', () => {
    expect(generateHashtags({ year: 1967 })).toContain('#Mini1967');
  });

  it('strips whitespace from the model tag', () => {
    expect(generateHashtags({ model: 'Cooper S' })).toContain('#CooperS');
  });

  it('adds #CooperS for "cooper s" models (case-insensitive)', () => {
    const tags = generateHashtags({ model: 'Classic Cooper S' });
    expect(tags).toContain('#CooperS');
    expect(tags).not.toContain('#MiniCooperClassic');
  });

  it('adds #MiniCooperClassic for plain "cooper" models (not cooper s)', () => {
    const tags = generateHashtags({ model: 'Mini Cooper' });
    expect(tags).toContain('#MiniCooperClassic');
    expect(tags).not.toContain('#CooperS');
  });

  it('adds parts tags for the parts category', () => {
    const tags = generateHashtags({ listing_category: 'parts' });
    expect(tags).toContain('#MiniParts');
    expect(tags).toContain('#ClassicMiniParts');
    expect(tags).not.toContain('#MiniForSale');
  });

  it('adds engine tags for the engine category', () => {
    const tags = generateHashtags({ listing_category: 'engine' });
    expect(tags).toContain('#ASeriesEngine');
    expect(tags).toContain('#MiniEngine');
  });

  it('defaults to for-sale tags for any other category', () => {
    const tags = generateHashtags({ listing_category: 'vehicle' });
    expect(tags).toContain('#MiniForSale');
    expect(tags).toContain('#ClassicCarForSale');
  });

  it('adds #Restored for restored condition (case-insensitive)', () => {
    expect(generateHashtags({ condition: 'Restored' })).toContain('#Restored');
  });

  it('adds #OriginalCondition for original condition', () => {
    expect(generateHashtags({ condition: 'original' })).toContain('#OriginalCondition');
  });

  it('emits no condition tag for an unknown condition', () => {
    const tags = generateHashtags({ condition: 'project' });
    expect(tags).not.toContain('#Restored');
    expect(tags).not.toContain('#OriginalCondition');
  });

  it('composes all branches together for a fully-specified listing', () => {
    const tags = generateHashtags({
      year: 1967,
      model: 'Cooper S',
      listing_category: 'engine',
      condition: 'restored',
    });
    expect(tags).toContain('#Mini1967');
    expect(tags).toContain('#CooperS');
    expect(tags).toContain('#ASeriesEngine');
    expect(tags).toContain('#Restored');
  });
});

// ===========================================================================
// formatPostText
// ===========================================================================
describe('formatPostText', () => {
  it('includes title, price, location, description, link, and hashtags', () => {
    const text = formatPostText(baseListing, 'https://theminiexchange.com');
    expect(text).toContain('1967 Austin Mini Cooper S');
    expect(text).toContain('Price: $25,000');
    expect(text).toContain('Location: London'); // city wins over location field
    expect(text).toContain(baseListing.description);
    expect(text).toContain('View listing: https://theminiexchange.com/listings/austin-mini-cooper-s');
    expect(text).toContain('#ClassicMini');
  });

  it('formats currency with no fraction digits and the listing currency', () => {
    const text = formatPostText({ ...baseListing, price: 1999.99, currency: 'GBP' }, 'https://x');
    expect(text).toContain('£2,000');
  });

  it('falls back to USD when currency is missing', () => {
    const text = formatPostText({ ...baseListing, currency: null }, 'https://x');
    expect(text).toContain('$25,000');
  });

  it('omits the price line when price is null/zero (falsy)', () => {
    expect(formatPostText({ ...baseListing, price: null }, 'https://x')).not.toContain('Price:');
    expect(formatPostText({ ...baseListing, price: 0 }, 'https://x')).not.toContain('Price:');
  });

  it('falls back to listing.location when city/state/country are absent', () => {
    const text = formatPostText(
      { ...baseListing, city: null, state_province: null, country: null, location: 'Somewhere' },
      'https://x'
    );
    expect(text).toContain('Location: Somewhere');
  });

  it('drops the United States country from the location line', () => {
    const text = formatPostText(
      { ...baseListing, city: 'Austin', state_province: 'TX', country: 'United States' },
      'https://x'
    );
    expect(text).toContain('Location: Austin, TX');
    expect(text).not.toContain('United States');
  });

  it('omits the location line entirely when no location data exists', () => {
    const text = formatPostText(
      { ...baseListing, city: null, state_province: null, country: null, location: null },
      'https://x'
    );
    expect(text).not.toContain('Location:');
  });

  it('truncates descriptions over 300 chars with an ellipsis', () => {
    const long = 'x'.repeat(400);
    const text = formatPostText({ ...baseListing, description: long }, 'https://x');
    expect(text).toContain('x'.repeat(300) + '...');
    expect(text).not.toContain('x'.repeat(301));
  });

  it('does not truncate descriptions at or under 300 chars', () => {
    const desc = 'y'.repeat(300);
    const text = formatPostText({ ...baseListing, description: desc }, 'https://x');
    expect(text).toContain(desc);
    expect(text).not.toContain('...');
  });

  it('uses "Link in bio" instead of a URL when linkInBio is set (Instagram caption)', () => {
    const text = formatPostText(baseListing, 'https://theminiexchange.com', { linkInBio: true });
    expect(text).toContain('Link in bio');
    expect(text).not.toContain('View listing:');
  });

  it('ends with the generated hashtags block', () => {
    const text = formatPostText(baseListing, 'https://x');
    expect(text.endsWith(generateHashtags(baseListing))).toBe(true);
  });
});

// ===========================================================================
// postToFacebook
// ===========================================================================
describe('postToFacebook', () => {
  it('returns success:false when Meta is not configured', async () => {
    configNone();
    const result = await postToFacebook(baseListing, ['https://x/p.jpg']);
    expect(result).toEqual({ success: false, error: 'Meta API not configured' });
    expect($fetch).not.toHaveBeenCalled();
  });

  it('uploads each photo unpublished then creates a multi-photo feed post (happy path)', async () => {
    $fetch
      .mockResolvedValueOnce({ id: 'media-1' }) // photo 1
      .mockResolvedValueOnce({ id: 'media-2' }) // photo 2
      .mockResolvedValueOnce({ id: 'post-fb' }); // feed

    const result = await postToFacebook(baseListing, ['https://x/1.jpg', 'https://x/2.jpg']);

    expect(result).toEqual({ success: true, postId: 'post-fb' });
    expect($fetch).toHaveBeenCalledTimes(3);

    // Photo uploads target /{pageId}/photos with published:false + token.
    expect($fetch).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v21.0/page-123/photos',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ url: 'https://x/1.jpg', published: false, access_token: 'meta-token' }),
      })
    );

    // Feed post attaches media_fbid array.
    const feedCall = $fetch.mock.calls[2];
    expect(feedCall[0]).toBe('https://graph.facebook.com/v21.0/page-123/feed');
    expect(feedCall[1].body.attached_media).toEqual([{ media_fbid: 'media-1' }, { media_fbid: 'media-2' }]);
  });

  it('creates a text-only feed post with a link when there are no photos', async () => {
    $fetch.mockResolvedValueOnce({ id: 'post-text' });

    const result = await postToFacebook(baseListing, []);

    expect(result).toEqual({ success: true, postId: 'post-text' });
    expect($fetch).toHaveBeenCalledTimes(1);
    const call = $fetch.mock.calls[0];
    expect(call[0]).toBe('https://graph.facebook.com/v21.0/page-123/feed');
    expect(call[1].body.link).toBe('https://theminiexchange.com/listings/austin-mini-cooper-s');
    expect(call[1].body.attached_media).toBeUndefined();
  });

  it('returns success:false with structured Meta error details on a non-ok response', async () => {
    $fetch.mockRejectedValueOnce(
      metaError({
        message: 'Invalid OAuth access token',
        type: 'OAuthException',
        code: 190,
        error_subcode: 463,
        fbtrace_id: 'AbC123trace',
        error_user_msg: 'Your session has expired',
      })
    );

    const result = await postToFacebook(baseListing, []);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid OAuth access token [code 190 / subcode 463 / fbtrace AbC123trace]');
    expect(result.errorCode).toBe(190);
    expect(result.errorSubcode).toBe(463);
    expect(result.fbtraceId).toBe('AbC123trace');
    expect(result.errorType).toBe('OAuthException');
    expect(result.userMessage).toBe('Your session has expired');
  });

  it('redacts an access_token leaked into an ofetch error message', async () => {
    // No structured error.data -> falls back to error.message, which must be redacted.
    const raw: any = new Error(
      'POST https://graph.facebook.com/v21.0/page-123/feed?access_token=SECRETTOKEN123 500'
    );
    $fetch.mockRejectedValueOnce(raw);

    const result = await postToFacebook(baseListing, []);

    expect(result.success).toBe(false);
    expect(result.error).toContain('access_token=REDACTED');
    expect(result.error).not.toContain('SECRETTOKEN123');
  });

  it('handles a non-object/array Meta error payload gracefully', async () => {
    const e: any = new Error('weird');
    e.data = { error: ['not', 'an', 'object'] };
    $fetch.mockRejectedValueOnce(e);

    const result = await postToFacebook(baseListing, []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('weird');
    expect(result.errorCode).toBeUndefined();
  });

  it('reads the Meta error from error.response._data when error.data is absent', async () => {
    const e: any = new Error('outer');
    e.response = { _data: { error: { message: 'Permissions error', code: 200 } } };
    $fetch.mockRejectedValueOnce(e);

    const result = await postToFacebook(baseListing, []);
    expect(result.error).toBe('Permissions error [code 200]');
    expect(result.errorCode).toBe(200);
  });
});

// ===========================================================================
// postToInstagram
// ===========================================================================
describe('postToInstagram', () => {
  it('returns success:false when Meta is not configured', async () => {
    configNone();
    const result = await postToInstagram(baseListing, ['https://x/p.jpg']);
    expect(result).toEqual({ success: false, error: 'Meta API not configured' });
  });

  it('returns success:false when there are no photos (Instagram requires one)', async () => {
    const result = await postToInstagram(baseListing, []);
    expect(result).toEqual({ success: false, error: 'Instagram requires at least one photo' });
  });

  it('posts a single image: create container -> wait(FINISHED) -> publish (happy path)', async () => {
    $fetch
      .mockResolvedValueOnce({ id: 'container-1' }) // media create
      .mockResolvedValueOnce({ status_code: 'FINISHED', id: 'container-1' }) // status poll
      .mockResolvedValueOnce({ id: 'ig-post-1' }); // media_publish

    const result = await postToInstagram(baseListing, ['https://x/1.jpg']);

    expect(result).toEqual({ success: true, postId: 'ig-post-1' });
    // create
    expect($fetch).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v21.0/ig-456/media',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ image_url: 'https://x/1.jpg', access_token: 'meta-token' }),
      })
    );
    // publish
    expect($fetch).toHaveBeenNthCalledWith(
      3,
      'https://graph.facebook.com/v21.0/ig-456/media_publish',
      expect.objectContaining({ body: expect.objectContaining({ creation_id: 'container-1' }) })
    );
  });

  it('posts a carousel: child containers -> wait all -> carousel container -> wait -> publish', async () => {
    $fetch
      .mockResolvedValueOnce({ id: 'child-1' }) // child create 1
      .mockResolvedValueOnce({ id: 'child-2' }) // child create 2
      .mockResolvedValueOnce({ status_code: 'FINISHED', id: 'child-1' }) // child-1 status
      .mockResolvedValueOnce({ status_code: 'FINISHED', id: 'child-2' }) // child-2 status
      .mockResolvedValueOnce({ id: 'carousel-1' }) // carousel create
      .mockResolvedValueOnce({ status_code: 'FINISHED', id: 'carousel-1' }) // carousel status
      .mockResolvedValueOnce({ id: 'ig-carousel-post' }); // publish

    const result = await postToInstagram(baseListing, ['https://x/1.jpg', 'https://x/2.jpg']);

    expect(result).toEqual({ success: true, postId: 'ig-carousel-post' });
    // carousel container create carries CAROUSEL media_type + children CSV.
    const carouselCreate = $fetch.mock.calls[4];
    expect(carouselCreate[1].body.media_type).toBe('CAROUSEL');
    expect(carouselCreate[1].body.children).toBe('child-1,child-2');
  });

  it('falls back to a fixed wait when the status endpoint returns code 100 / subcode 33', async () => {
    vi.useFakeTimers();
    $fetch
      .mockResolvedValueOnce({ id: 'container-1' }) // create
      .mockRejectedValueOnce(metaError({ code: 100, error_subcode: 33, type: 'GraphMethodException' })) // status unreadable
      .mockResolvedValueOnce({ id: 'ig-post-1' }); // publish

    const promise = postToInstagram(baseListing, ['https://x/1.jpg']);
    // The 10s fallback wait is pending until timers advance.
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual({ success: true, postId: 'ig-post-1' });
  });

  it('throws (via reject) when the container status is ERROR', async () => {
    $fetch
      .mockResolvedValueOnce({ id: 'container-1' }) // create
      .mockResolvedValueOnce({ status_code: 'ERROR', id: 'container-1' }); // status ERROR

    const result = await postToInstagram(baseListing, ['https://x/1.jpg']);
    // ERROR throws inside wait -> caught by postToInstagram -> success:false.
    expect(result.success).toBe(false);
    expect(result.error).toContain('failed processing');
  });

  it('returns the friendly aspect-ratio message while preserving structured fields', async () => {
    $fetch
      .mockResolvedValueOnce({ id: 'container-1' }) // create
      .mockResolvedValueOnce({ status_code: 'FINISHED', id: 'container-1' }) // status
      .mockRejectedValueOnce(
        metaError({ message: 'The submitted image aspect ratio is not supported', code: 36003 })
      ); // publish fails

    const result = await postToInstagram(baseListing, ['https://x/1.jpg']);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Image aspect ratio not supported. Photos must be between 4:5 (portrait) and 1.91:1 (landscape) ratio.'
    );
    // structured diagnostic fields still carried through
    expect(result.errorCode).toBe(36003);
  });

  it('surfaces a generic structured Meta error on container-create failure', async () => {
    $fetch.mockRejectedValueOnce(metaError({ message: 'Application request limit reached', code: 4 }));
    const result = await postToInstagram(baseListing, ['https://x/1.jpg']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Application request limit reached [code 4]');
    expect(result.errorCode).toBe(4);
  });
});

// ===========================================================================
// postToBluesky
// ===========================================================================
describe('postToBluesky', () => {
  it('returns success:false when Bluesky is not configured', async () => {
    configNone();
    const result = await postToBluesky(baseListing, ['https://x/p.jpg']);
    expect(result).toEqual({ success: false, error: 'Bluesky not configured' });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('logs in, uploads images, posts, and returns the post rkey (happy path)', async () => {
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(500), // < 1MB -> no compression
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await postToBluesky(baseListing, ['https://x/1.jpg', 'https://x/2.jpg']);

    expect(result).toEqual({ success: true, postId: 'postrkey' });
    expect(mockLogin).toHaveBeenCalledWith({
      identifier: 'theminiexchange.bsky.social',
      password: 'app-pw',
    });
    expect(mockUploadBlob).toHaveBeenCalledTimes(2);
    expect(mockCompressImageForBluesky).not.toHaveBeenCalled();
    // main post + reply thread (listing has year/model/condition/description).
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('caps images at four (Bluesky limit)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));
    await postToBluesky(baseListing, ['a', 'b', 'c', 'd', 'e', 'f']);
    expect(mockUploadBlob).toHaveBeenCalledTimes(4);
  });

  it('compresses images that exceed ~1MB before uploading', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(2_000_000) })));
    await postToBluesky(baseListing, ['https://x/big.jpg']);
    expect(mockCompressImageForBluesky).toHaveBeenCalledTimes(1);
  });

  it('still succeeds (text-only) when no photos are provided', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const result = await postToBluesky(baseListing, []);
    expect(result.success).toBe(true);
    expect(mockUploadBlob).not.toHaveBeenCalled();
    // The main post embed is omitted; reply thread still posts -> 2 posts.
    expect(mockPost).toHaveBeenCalled();
  });

  it('does not fail the post when the reply thread throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));
    // First post (main) succeeds, second post (reply) rejects.
    mockPost
      .mockResolvedValueOnce({ uri: 'at://did:plc:abc/app.bsky.feed.post/mainrkey', cid: 'cid1' })
      .mockRejectedValueOnce(new Error('reply boom'));

    const result = await postToBluesky(baseListing, ['https://x/1.jpg']);
    expect(result).toEqual({ success: true, postId: 'mainrkey' });
  });

  it('returns success:false with XRPC code + status when login fails', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const err: any = new Error('Invalid identifier or password');
    err.error = 'AuthenticationRequired';
    err.status = 401;
    mockLogin.mockRejectedValueOnce(err);

    const result = await postToBluesky(baseListing, ['https://x/1.jpg']);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid identifier or password [AuthenticationRequired / status 401]');
    expect(result.errorType).toBe('AuthenticationRequired');
  });

  it('redacts an access_token that leaks into a Bluesky error message', async () => {
    vi.stubGlobal('fetch', vi.fn());
    mockLogin.mockRejectedValueOnce(new Error('failed url?access_token=LEAKED999'));

    const result = await postToBluesky(baseListing, ['https://x/1.jpg']);
    expect(result.error).toContain('access_token=REDACTED');
    expect(result.error).not.toContain('LEAKED999');
  });

  it('falls back to a generic message when the error has no message', async () => {
    vi.stubGlobal('fetch', vi.fn());
    mockLogin.mockRejectedValueOnce({});
    const result = await postToBluesky(baseListing, ['https://x/1.jpg']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown Bluesky error');
  });
});

// ===========================================================================
// postListingToSocialMedia (orchestrator)
// ===========================================================================
describe('postListingToSocialMedia', () => {
  // Build a chainable supabase mock where the atomic claim update can be
  // configured to succeed (return a row) or no-op (return null).
  function makeSupabase(opts: {
    claim?: { data: any; error: any };
    promo?: { data: any; error: any };
  } = {}) {
    const claim = opts.claim ?? { data: { id: 'listing-1' }, error: null };
    const promo = opts.promo ?? { data: { id: 'promo-1', features: { paid: true } }, error: null };

    // Track terminal .single() results in order: first single() = claim, second = promo.
    const singleResults: Array<{ data: any; error: any }> = [claim, promo];
    const singleCalls: any[] = [];

    const updateCalls: any[] = [];

    const builder: any = {
      update: vi.fn((payload: any) => {
        updateCalls.push(payload);
        return builder;
      }),
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(() => {
        const next = singleResults.shift() ?? { data: null, error: null };
        singleCalls.push(next);
        return Promise.resolve(next);
      }),
    };

    const fromCalls: string[] = [];
    const client: any = {
      from: vi.fn((table: string) => {
        fromCalls.push(table);
        return builder;
      }),
      _builder: builder,
      _updateCalls: updateCalls,
      _fromCalls: fromCalls,
    };
    return client;
  }

  const listingWithPhotos: ListingForSocialPost = {
    ...baseListing,
    listing_photos: [
      { storage_path: 'l1/b.jpg', display_order: 2, is_primary: false },
      { storage_path: 'l1/a.jpg', display_order: 1, is_primary: true },
    ],
  };

  it('skips entirely when no platforms are configured (no claim attempted)', async () => {
    configNone();
    const supabase = makeSupabase();
    await postListingToSocialMedia(listingWithPhotos, supabase);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('early-returns without posting when the atomic claim returns null (already promoted)', async () => {
    const supabase = makeSupabase({ claim: { data: null, error: null } });
    vi.stubGlobal('fetch', vi.fn());

    await postListingToSocialMedia(listingWithPhotos, supabase);

    // Claim was attempted...
    expect(supabase.from).toHaveBeenCalledWith('listings');
    // ...but no social network calls happened.
    expect($fetch).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockPrepareImageForInstagram).not.toHaveBeenCalled();
  });

  it('early-returns when the claim update errors', async () => {
    const supabase = makeSupabase({ claim: { data: null, error: { message: 'db error' } } });
    vi.stubGlobal('fetch', vi.fn());
    await postListingToSocialMedia(listingWithPhotos, supabase);
    expect($fetch).not.toHaveBeenCalled();
  });

  it('happy path: claims, posts to all platforms, and writes social ids into listing_promotions', async () => {
    const supabase = makeSupabase();
    // Bluesky image download
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));

    // $fetch drives FB (photos x2 sorted + feed) and IG (carousel for 2 photos).
    // FB: 2 photo uploads + 1 feed = 3 calls. IG: 2 child + 2 status + carousel +
    // carousel status + publish = 7 calls. Order across Promise.allSettled is
    // interleaved, so resolve by URL rather than by sequence.
    $fetch.mockImplementation(async (url: string, init: any) => {
      if (url.endsWith('/photos')) return { id: 'fb-media' };
      if (url.endsWith('/feed')) return { id: 'fb-post' };
      if (url.endsWith('/media_publish')) return { id: 'ig-post' };
      if (url.endsWith('/media')) {
        // container create (child or carousel)
        return { id: init?.body?.media_type === 'CAROUSEL' ? 'ig-carousel' : 'ig-child' };
      }
      // status poll (GET with params)
      return { status_code: 'FINISHED', id: 'container' };
    });

    await postListingToSocialMedia(listingWithPhotos, supabase);

    // Atomic claim wrote promoted_on_social: true.
    expect(supabase._updateCalls[0]).toEqual(
      expect.objectContaining({ promoted_on_social: true, promoted_on_social_at: expect.any(String) })
    );

    // Photos sorted primary-first: a.jpg (primary) before b.jpg.
    expect(mockPrepareImageForInstagram).toHaveBeenCalledTimes(2);
    const firstUrl = mockPrepareImageForInstagram.mock.calls[0][0];
    expect(firstUrl).toContain('l1/a.jpg');

    // listing_promotions update carries the platform post ids.
    expect(supabase.from).toHaveBeenCalledWith('listing_promotions');
    const promoUpdate = supabase._updateCalls.find((c: any) => c.features?.facebook_post_id);
    expect(promoUpdate).toBeDefined();
    expect(promoUpdate.features.facebook_post_id).toBe('fb-post');
    expect(promoUpdate.features.instagram_post_id).toBe('ig-post');
    expect(promoUpdate.features.bluesky_post_id).toBe('postrkey');
    // merges existing features.
    expect(promoUpdate.features.paid).toBe(true);

    // The flag is NOT reverted (at least one success).
    const revert = supabase._updateCalls.find((c: any) => c.promoted_on_social === false);
    expect(revert).toBeUndefined();
  });

  it('reverts promoted_on_social to false when all platforms fail', async () => {
    const supabase = makeSupabase();
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));
    // Every Meta call fails; Bluesky login fails too.
    $fetch.mockRejectedValue(metaError({ message: 'API down', code: 1 }));
    mockLogin.mockRejectedValue(new Error('bsky down'));

    await postListingToSocialMedia(listingWithPhotos, supabase);

    const revert = supabase._updateCalls.find((c: any) => c.promoted_on_social === false);
    expect(revert).toEqual({ promoted_on_social: false, promoted_on_social_at: null });
    // No post ids -> never touched listing_promotions.
    expect(supabase._fromCalls).not.toContain('listing_promotions');
  });

  it('reverts the flag when image processing throws unexpectedly', async () => {
    const supabase = makeSupabase();
    vi.stubGlobal('fetch', vi.fn());
    mockPrepareImageForInstagram.mockRejectedValueOnce(new Error('sharp exploded'));

    await postListingToSocialMedia(listingWithPhotos, supabase);

    const revert = supabase._updateCalls.find((c: any) => c.promoted_on_social === false);
    expect(revert).toEqual({ promoted_on_social: false, promoted_on_social_at: null });
  });

  it('cleans up temp images only when something was cropped', async () => {
    const supabase = makeSupabase();
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));
    $fetch.mockImplementation(async (url: string, init: any) => {
      if (url.endsWith('/photos')) return { id: 'fb-media' };
      if (url.endsWith('/feed')) return { id: 'fb-post' };
      if (url.endsWith('/media_publish')) return { id: 'ig-post' };
      if (url.endsWith('/media')) return { id: init?.body?.media_type === 'CAROUSEL' ? 'ig-carousel' : 'ig-child' };
      return { status_code: 'FINISHED', id: 'container' };
    });
    mockPrepareImageForInstagram.mockImplementation(async (url: string) => ({ url, wasCropped: true }));

    await postListingToSocialMedia(listingWithPhotos, supabase);
    expect(mockCleanupTempImages).toHaveBeenCalledWith('listing-1', supabase);
  });

  it('does not clean up temp images when nothing was cropped', async () => {
    const supabase = makeSupabase();
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));
    $fetch.mockImplementation(async (url: string, init: any) => {
      if (url.endsWith('/photos')) return { id: 'fb-media' };
      if (url.endsWith('/feed')) return { id: 'fb-post' };
      if (url.endsWith('/media_publish')) return { id: 'ig-post' };
      if (url.endsWith('/media')) return { id: init?.body?.media_type === 'CAROUSEL' ? 'ig-carousel' : 'ig-child' };
      return { status_code: 'FINISHED', id: 'container' };
    });

    await postListingToSocialMedia(listingWithPhotos, supabase);
    expect(mockCleanupTempImages).not.toHaveBeenCalled();
  });

  it('proceeds with only Bluesky configured (Meta absent) and still claims', async () => {
    configNone({ blueskyHandle: 'h.bsky.social', blueskyAppPassword: 'pw' });
    const supabase = makeSupabase();
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(100) })));

    await postListingToSocialMedia(listingWithPhotos, supabase);

    // Claim happened.
    expect(supabase._updateCalls[0]).toEqual(
      expect.objectContaining({ promoted_on_social: true })
    );
    // Bluesky posted; Meta calls (FB/IG) all return "not configured" -> no $fetch.
    expect(mockLogin).toHaveBeenCalled();
    expect($fetch).not.toHaveBeenCalled();
    // Bluesky success -> wrote listing_promotions with the bluesky id.
    const promoUpdate = supabase._updateCalls.find((c: any) => c.features);
    expect(promoUpdate.features.bluesky_post_id).toBe('postrkey');
    expect(promoUpdate.features.facebook_post_id).toBeNull();
    expect(promoUpdate.features.instagram_post_id).toBeNull();
  });
});

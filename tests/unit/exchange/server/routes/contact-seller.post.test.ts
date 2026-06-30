/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';
import { _resetExchangeRateLimitStore } from '~~/server/utils/exchange/rateLimit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// Mock the supabase service client + the notification queue. The route imports
// these via relative paths ('../../utils/supabase',
// '../../utils/exchange/notificationQueue'), which Vitest resolves to the same
// absolute modules as the '~~/server/utils/...' aliases below.
//
// sanitize, contentFilter and rateLimit are intentionally REAL so validation,
// moderation and the rate-limit counter are genuinely exercised end-to-end.
const mockQueueNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('~~/server/utils/exchange/notificationQueue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~~/server/utils/exchange/notificationQueue')>();
  return {
    ...actual,
    queueNotification: mockQueueNotification,
    // Keep the real buildBatchKey so we can assert the exact 'seller_inquiry:*' key shape.
  };
});

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_BODY = {
  listingId: 'listing-123',
  name: 'Jane Buyer',
  email: 'jane@example.com',
  message: 'Hello, I am interested in this part. Is it still available for sale?',
};

const ACTIVE_LISTING = {
  id: 'listing-123',
  title: 'Cooper S Front Subframe',
  slug: 'cooper-s-front-subframe',
  user_id: 'seller-1',
  profiles: { email: 'seller@example.com' },
};

/** Configure the listings lookup result (`.single()` terminal). */
function resolveListing(result: { data?: any; error?: any }) {
  (mockSupabase._mockSingle as any).mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
}

/** Set the request body for the next handler invocation. */
function setBody(body: any) {
  (readBody as any).mockResolvedValue(body);
}

/** Default header impl: x-real-ip returns a fixed IP unless overridden. */
function setRealIp(ip: string | undefined) {
  (getHeader as any).mockImplementation((_e: any, name: string) => (name === 'x-real-ip' ? ip : undefined));
}

async function loadHandler() {
  return (await import('~~/server/api/exchange/contact-seller.post')).default;
}

// ===========================================================================
//  TESTS
// ===========================================================================
describe('server/api/exchange/contact-seller.post', () => {
  let handler: (event: any) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Fresh chainable supabase client per test; default listing = active w/ email.
    mockSupabase = createMockSupabaseClient();
    resolveListing({ data: ACTIVE_LISTING, error: null });

    mockQueueNotification.mockResolvedValue(undefined);

    // Reset the shared in-memory rate-limit store so per-IP counts don't leak.
    _resetExchangeRateLimitStore();

    setBody({ ...VALID_BODY });
    setRealIp('9.9.9.9');
    (getRequestIP as any).mockReturnValue(undefined);

    handler = await loadHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
    _resetExchangeRateLimitStore();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------
  it('sends a seller_inquiry notification to the listing owner and returns success', async () => {
    const result = await handler({} as any);

    expect(result).toEqual({
      success: true,
      message: 'Your message has been sent to the seller!',
    });

    expect(mockQueueNotification).toHaveBeenCalledTimes(1);
    const arg = mockQueueNotification.mock.calls[0][0];
    expect(arg.userId).toBe('seller-1'); // recipient = listing.user_id
    expect(arg.eventType).toBe('seller_inquiry');
    expect(arg.payload).toMatchObject({
      listingTitle: ACTIVE_LISTING.title,
      listingSlug: ACTIVE_LISTING.slug,
      inquirerName: 'Jane Buyer',
      inquirerEmail: 'jane@example.com',
      message: VALID_BODY.message,
    });
    // buildBatchKey('seller_inquiry', { inquiryId }) -> unique per inquiry.
    expect(arg.batchKey).toMatch(/^seller_inquiry:/);
  });

  it('queries listings filtered by id AND active status, selecting the seller email via profiles', async () => {
    await handler({} as any);

    expect(mockSupabase.from).toHaveBeenCalledWith('listings');
    expect(mockSupabase._mockEq ?? mockSupabase._queryBuilder.eq).toBeTruthy();
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'listing-123');
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'active');
    // Select pulls the nested profiles email (recipient resolution).
    const selectArg = (mockSupabase._mockSelect as any).mock.calls[0][0];
    expect(selectArg).toContain('user_id');
    expect(selectArg).toContain('profiles:user_id');
    expect(selectArg).toContain('email');
  });

  // -------------------------------------------------------------------------
  // Honeypot
  // -------------------------------------------------------------------------
  it('returns success WITHOUT sending when the honeypot field is filled', async () => {
    setBody({ ...VALID_BODY, honeypot: 'i-am-a-bot' });

    const result = await handler({} as any);

    expect(result).toEqual({ success: true });
    expect(mockQueueNotification).not.toHaveBeenCalled();
    // Honeypot short-circuits before any DB lookup.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Required-field validation (400s)
  // -------------------------------------------------------------------------
  it('throws 400 when listingId is missing', async () => {
    setBody({ ...VALID_BODY, listingId: undefined });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockQueueNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when name is missing', async () => {
    setBody({ ...VALID_BODY, name: undefined });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when name is only whitespace', async () => {
    setBody({ ...VALID_BODY, name: '   ' });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when email is missing', async () => {
    setBody({ ...VALID_BODY, email: undefined });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when message is missing', async () => {
    setBody({ ...VALID_BODY, message: undefined });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when message is only whitespace', async () => {
    setBody({ ...VALID_BODY, message: '          ' });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  // -------------------------------------------------------------------------
  // Email format
  // -------------------------------------------------------------------------
  it('throws 400 for an invalid email format', async () => {
    setBody({ ...VALID_BODY, email: 'not-an-email' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Please enter a valid email address (e.g., you@example.com).',
    });
  });

  // -------------------------------------------------------------------------
  // Length validation
  // -------------------------------------------------------------------------
  it('throws 400 when name exceeds 100 characters', async () => {
    setBody({ ...VALID_BODY, name: 'a'.repeat(101) });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when message is shorter than 10 characters', async () => {
    setBody({ ...VALID_BODY, message: 'short' });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when message exceeds 2000 characters', async () => {
    setBody({ ...VALID_BODY, message: 'a'.repeat(2001) });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  // -------------------------------------------------------------------------
  // Content moderation (real contentFilter exercised)
  // -------------------------------------------------------------------------
  it('throws 400 when the name contains profanity', async () => {
    setBody({ ...VALID_BODY, name: 'shit head' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Your name contains inappropriate language. Please use a different name.',
    });
    expect(mockQueueNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when the message contains profanity', async () => {
    setBody({ ...VALID_BODY, message: 'This is a complete piece of shit listing here' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Your message contains inappropriate language. Please revise your message.',
    });
  });

  it('throws 400 when the message contains a phone number', async () => {
    setBody({ ...VALID_BODY, message: 'Call me about this part at 555-123-4567 please thanks' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('phone numbers'),
    });
  });

  it('throws 400 when the message contains an email address', async () => {
    setBody({ ...VALID_BODY, message: 'Please reach me directly at buyer.contact@gmail.com about this' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('email addresses'),
    });
  });

  it('throws 400 when the message contains an external (non-allowlisted) url', async () => {
    setBody({ ...VALID_BODY, message: 'Check out my other stuff over at https://sketchy-site.io/listing here' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('external links'),
    });
  });

  it('throws 400 when the message contains a social media handle', async () => {
    setBody({ ...VALID_BODY, message: 'Find me on instagram for more pics of this part okay' });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('social media'),
    });
  });

  // -------------------------------------------------------------------------
  // Excessive URLs (post-moderation spam guard).
  // The >2 http(s) URL guard is reached only when moderation itself didn't
  // already reject; allowlisted shipping-carrier URLs pass moderation, so 3
  // of those trip the >2 spam guard with its specific "limit to 2" message.
  // -------------------------------------------------------------------------
  it('throws 400 when the message contains more than 2 urls', async () => {
    setBody({
      ...VALID_BODY,
      message:
        'Tracking links: https://usps.com/a https://ups.com/b https://fedex.com/c all for your reference here',
    });
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('limit to 2 URLs maximum'),
    });
    expect(mockQueueNotification).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Rate limiting (3 per IP per hour; 4th throws 429)
  // -------------------------------------------------------------------------
  it('allows 3 requests then throws 429 on the 4th from the same x-real-ip', async () => {
    setRealIp('5.5.5.5');

    await expect(handler({} as any)).resolves.toMatchObject({ success: true });
    await expect(handler({} as any)).resolves.toMatchObject({ success: true });
    await expect(handler({} as any)).resolves.toMatchObject({ success: true });

    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 429 });

    // The 429 short-circuits before queueing the 4th notification.
    expect(mockQueueNotification).toHaveBeenCalledTimes(3);
  });

  it('keys the rate limit per IP — a different x-real-ip is not throttled', async () => {
    setRealIp('1.1.1.1');
    await handler({} as any);
    await handler({} as any);
    await handler({} as any);
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 429 });

    // Switch IP: fresh bucket, allowed again.
    setRealIp('2.2.2.2');
    await expect(handler({} as any)).resolves.toMatchObject({ success: true });
  });

  it('prefers x-real-ip over getRequestIP for the rate-limit key', async () => {
    // x-real-ip fixed; getRequestIP varies. If the route keyed off getRequestIP
    // the 4th call (still same x-real-ip) would NOT be throttled. It must throttle.
    setRealIp('7.7.7.7');
    (getRequestIP as any).mockImplementation(() => `forwarded-${Math.random()}`);

    await handler({} as any);
    await handler({} as any);
    await handler({} as any);
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 429 });
  });

  it('falls back to getRequestIP when x-real-ip is absent', async () => {
    setRealIp(undefined);
    (getRequestIP as any).mockReturnValue('203.0.113.50');

    await handler({} as any);
    await handler({} as any);
    await handler({} as any);
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 429 });
  });

  // -------------------------------------------------------------------------
  // Listing / seller resolution
  // -------------------------------------------------------------------------
  it('throws 404 when the listing is not found / not active', async () => {
    resolveListing({ data: null, error: null });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockQueueNotification).not.toHaveBeenCalled();
  });

  it('throws 404 when the listing query returns an error', async () => {
    resolveListing({ data: null, error: { message: 'no rows' } });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when the seller has no email on file', async () => {
    resolveListing({ data: { ...ACTIVE_LISTING, profiles: null }, error: null });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(mockQueueNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when the seller profile exists but email is empty', async () => {
    resolveListing({ data: { ...ACTIVE_LISTING, profiles: { email: '' } }, error: null });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  // -------------------------------------------------------------------------
  // Unexpected errors -> 500
  // -------------------------------------------------------------------------
  it('wraps unexpected (non-statusCode) errors as a 500', async () => {
    // Make the supabase lookup blow up with a plain error (no statusCode).
    (mockSupabase._mockSingle as any).mockRejectedValue(new Error('connection reset'));
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 500 });
  });

  it('rethrows createError-shaped errors without rewrapping them as 500', async () => {
    // A 404 (statusCode present) must pass through the catch unchanged.
    resolveListing({ data: null, error: null });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 404 });
  });
});

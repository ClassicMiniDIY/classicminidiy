/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Supabase mock chain ----
const mockMaybeSingle = vi.fn();
const mockEqStatus = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqSlug = vi.fn(() => ({ eq: mockEqStatus }));
const mockSelect = vi.fn(() => ({ eq: mockEqSlug }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

// ---- Nitro global stubs (must be hoisted before source import) ----
const { mockGetRequestURL, mockSendRedirect } = vi.hoisted(() => {
  const mockGetRequestURL = vi.fn();
  const mockSendRedirect = vi.fn();

  (globalThis as any).defineEventHandler = (handler: Function) => handler;
  (globalThis as any).getRequestURL = mockGetRequestURL;
  (globalThis as any).sendRedirect = mockSendRedirect;
  (globalThis as any).createError = (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
    const e = new Error(opts.message || opts.statusMessage) as Error & { statusCode: number };
    e.statusCode = opts.statusCode;
    return e;
  };

  return { mockGetRequestURL, mockSendRedirect };
});

// ---- Mock Supabase ----
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

// Import the handler (defineEventHandler returns the raw function via stub)
import handler from '~/server/middleware/legacy-archive-redirect';

describe('server/middleware/legacy-archive-redirect', () => {
  const fakeEvent = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the chainable mock structure
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockEqStatus.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEqSlug.mockReturnValue({ eq: mockEqStatus });
    mockSelect.mockReturnValue({ eq: mockEqSlug });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  // ---------- 1. Pass through non-legacy paths ----------
  it('passes through non-legacy paths (root)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passes through non-legacy paths (/archive/documents/some-doc)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/documents/some-doc'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passes through the /archive/manuals/ prefix without a slug', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passes through a non-matching archive path (/archive/videos/something)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/videos/something'));

    const result = await (handler as Function)(fakeEvent);
    expect(result).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ---------- 2. Redirects /archive/manuals/:slug via legacy_slug ----------
  it('redirects /archive/manuals/:slug when found by legacy_slug', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/old-manual-slug'));

    // First query (legacy_slug lookup) returns a match
    mockMaybeSingle.mockResolvedValueOnce({ data: { slug: 'new-manual-slug' }, error: null });
    mockSendRedirect.mockReturnValue('redirected');

    const result = await (handler as Function)(fakeEvent);

    expect(mockFrom).toHaveBeenCalledWith('archive_documents');
    expect(mockSelect).toHaveBeenCalledWith('slug');
    expect(mockEqSlug).toHaveBeenCalledWith('legacy_slug', 'old-manual-slug');
    expect(mockEqStatus).toHaveBeenCalledWith('status', 'approved');
    expect(mockSendRedirect).toHaveBeenCalledWith(fakeEvent, '/archive/documents/new-manual-slug', 301);
    expect(result).toBe('redirected');
  });

  it('redirects /archive/adverts/:slug when found by legacy_slug', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/adverts/old-advert'));

    mockMaybeSingle.mockResolvedValueOnce({ data: { slug: 'new-advert' }, error: null });
    mockSendRedirect.mockReturnValue('redirected');

    await (handler as Function)(fakeEvent);

    expect(mockEqSlug).toHaveBeenCalledWith('legacy_slug', 'old-advert');
    expect(mockSendRedirect).toHaveBeenCalledWith(fakeEvent, '/archive/documents/new-advert', 301);
  });

  it('redirects /archive/catalogues/:slug when found by legacy_slug', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/catalogues/old-catalogue'));

    mockMaybeSingle.mockResolvedValueOnce({ data: { slug: 'new-catalogue' }, error: null });
    mockSendRedirect.mockReturnValue('redirected');

    await (handler as Function)(fakeEvent);

    expect(mockSendRedirect).toHaveBeenCalledWith(fakeEvent, '/archive/documents/new-catalogue', 301);
  });

  it('redirects /archive/tuning/:slug when found by legacy_slug', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/tuning/old-tuning-guide'));

    mockMaybeSingle.mockResolvedValueOnce({ data: { slug: 'new-tuning-guide' }, error: null });
    mockSendRedirect.mockReturnValue('redirected');

    await (handler as Function)(fakeEvent);

    expect(mockSendRedirect).toHaveBeenCalledWith(fakeEvent, '/archive/documents/new-tuning-guide', 301);
  });

  // ---------- 3. Falls back to slug lookup when legacy_slug not found ----------
  it('falls back to slug lookup when legacy_slug not found', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/direct-slug'));

    // First query (legacy_slug): no match
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second query (direct slug): match found
    mockMaybeSingle.mockResolvedValueOnce({ data: { slug: 'direct-slug' }, error: null });

    mockSendRedirect.mockReturnValue('redirected');

    const result = await (handler as Function)(fakeEvent);

    // Verify first call was legacy_slug lookup
    expect(mockEqSlug).toHaveBeenNthCalledWith(1, 'legacy_slug', 'direct-slug');
    // Verify second call was slug lookup
    expect(mockEqSlug).toHaveBeenNthCalledWith(2, 'slug', 'direct-slug');

    expect(mockSendRedirect).toHaveBeenCalledWith(fakeEvent, '/archive/documents/direct-slug', 301);
    expect(result).toBe('redirected');
  });

  // ---------- 4. No redirect when slug not found in database ----------
  it('does not redirect when slug not found in database at all', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/nonexistent-slug'));

    // Both queries return no match
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await (handler as Function)(fakeEvent);

    expect(mockSendRedirect).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  // ---------- 5. Handles Supabase errors gracefully ----------
  it('handles Supabase errors gracefully (continues without redirect)', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/error-slug'));

    // Supabase throws an error
    mockMaybeSingle.mockRejectedValueOnce(new Error('Database connection error'));

    const result = await (handler as Function)(fakeEvent);

    // Should not throw, should not redirect
    expect(mockSendRedirect).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('handles Supabase error on second query gracefully', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/partial-error'));

    // First query succeeds with no match
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second query throws
    mockMaybeSingle.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await (handler as Function)(fakeEvent);

    expect(mockSendRedirect).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  // ---------- Edge cases ----------
  it('strips trailing slash from the legacy slug', async () => {
    mockGetRequestURL.mockReturnValue(new URL('https://example.com/archive/manuals/slug-with-trailing/'));

    mockMaybeSingle.mockResolvedValueOnce({ data: { slug: 'found-slug' }, error: null });
    mockSendRedirect.mockReturnValue('redirected');

    await (handler as Function)(fakeEvent);

    // The trailing slash is stripped: 'slug-with-trailing/' -> 'slug-with-trailing'
    expect(mockEqSlug).toHaveBeenCalledWith('legacy_slug', 'slug-with-trailing');
    expect(mockSendRedirect).toHaveBeenCalledWith(fakeEvent, '/archive/documents/found-slug', 301);
  });
});

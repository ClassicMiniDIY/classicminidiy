/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../../setup/mockSupabase';

// The route reaches auth + service deps through relative specifiers; vitest
// resolves those to the same absolute modules as the `~~/server/utils/*` ids
// below, and vi.mock matches by resolved id.
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));
vi.mock('~~/server/utils/exchange/notificationQueue', () => ({
  queueNotification: vi.fn(),
  queueAdminNotification: vi.fn(),
  buildBatchKey: vi.fn(() => 'watchlist_sold:listing-1'),
}));

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';
import { queueNotification, buildBatchKey } from '~~/server/utils/exchange/notificationQueue';

const handler = (await import('~~/server/api/exchange/notifications/watchlist-sold.post')).default;

const SELLER = { id: 'seller-1', email: 'seller@example.com' };
const LISTING = { id: 'listing-1', user_id: SELLER.id, title: '1969 Cooper S', slug: '1969-cooper-s', price: 12000 };

const evt = (): any => ({ context: {} });
const setBody = (body: any) => (readBody as any).mockResolvedValue(body);

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

/** Listing lookup resolves through `.single()`; the watcher list resolves
 * through the builder's thenable, since it has no terminal `.single()`. */
function wire(listing: { data: any; error: any }, watchers: { data: any; error: any }) {
  mockSupabase = createMockSupabaseClient();
  (mockSupabase._mockSingle as any).mockResolvedValueOnce(listing);
  (mockSupabase._queryBuilder as any).then = vi.fn((resolve: any) => resolve(watchers));
  (getServiceClient as any).mockReturnValue(mockSupabase);
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireUserClient as any).mockResolvedValue({ user: { ...SELLER } });
  (queueNotification as any).mockResolvedValue(undefined);
  (buildBatchKey as any).mockReturnValue('watchlist_sold:listing-1');
  setBody({ listingId: 'listing-1', finalPrice: 11500 });
  wire(
    { data: { ...LISTING }, error: null },
    { data: [{ user_id: 'watcher-a' }, { user_id: 'watcher-b' }], error: null }
  );
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('server/api/exchange/notifications/watchlist-sold.post', () => {
  it('queues one notification per watcher', async () => {
    const result = await handler(evt());

    expect(result).toEqual({ success: true, notified: 2 });
    expect(queueNotification).toHaveBeenCalledTimes(2);
    const first = (queueNotification as any).mock.calls[0][0];
    expect(first.eventType).toBe('watchlist_sold');
    expect(first.channel).toBe('both');
    expect(first.payload).toEqual({
      listingId: 'listing-1',
      title: LISTING.title,
      slug: LISTING.slug,
      finalPrice: 11500,
    });
  });

  it('batches per listing, so firing twice cannot send two emails for one sale', async () => {
    await handler(evt());
    expect(buildBatchKey).toHaveBeenCalledWith('watchlist_sold', { listingId: 'listing-1' });
    const keys = (queueNotification as any).mock.calls.map((c: any[]) => c[0].batchKey);
    expect(new Set(keys).size).toBe(1);
  });

  it('excludes the seller and de-duplicates watchers', async () => {
    wire(
      { data: { ...LISTING }, error: null },
      { data: [{ user_id: 'watcher-a' }, { user_id: 'watcher-a' }, { user_id: SELLER.id }], error: null }
    );

    const result = await handler(evt());

    expect(result).toEqual({ success: true, notified: 1 });
    expect((queueNotification as any).mock.calls[0][0].userId).toBe('watcher-a');
  });

  it('rejects a missing listingId with 400', async () => {
    setBody({});
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('404s when the listing does not exist', async () => {
    wire({ data: null, error: { message: 'not found' } }, { data: [], error: null });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  // Ownership is the authorization boundary — without it anyone could email
  // every watcher on any listing.
  it('403s when the caller does not own the listing', async () => {
    (requireUserClient as any).mockResolvedValue({ user: { id: 'someone-else' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  // The sale already succeeded by the time this route is called, so a
  // notification failure must never surface as an error to the seller.
  it('does not throw when the watcher lookup fails', async () => {
    wire({ data: { ...LISTING }, error: null }, { data: null, error: { message: 'boom' } });
    await expect(handler(evt())).resolves.toEqual({ success: true, notified: 0 });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('passes a null finalPrice through rather than NaN', async () => {
    setBody({ listingId: 'listing-1', finalPrice: 'not-a-number' });
    await handler(evt());
    expect((queueNotification as any).mock.calls[0][0].payload.finalPrice).toBeNull();
  });
});

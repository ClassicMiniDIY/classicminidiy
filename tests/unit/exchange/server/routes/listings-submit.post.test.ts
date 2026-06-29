/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, type MockSupabaseClient } from '../../../../setup/mockSupabase';

// --- Mocks for the route's exact import specifiers --------------------------
// submit.post.ts imports:
//   requireUserClient            from '../../../utils/userAuth'
//   getServiceClient             from '../../../utils/supabase'
//   queueNotification, queueAdminNotification, buildBatchKey
//                                from '../../../utils/exchange/notificationQueue'
// Resolved from the repo root via the `~~` alias.
vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(),
}));
vi.mock('~~/server/utils/exchange/notificationQueue', () => ({
  queueNotification: vi.fn().mockResolvedValue(undefined),
  queueAdminNotification: vi.fn().mockResolvedValue(undefined),
  // Real buildBatchKey for 'listing_submitted' returns `listing_submitted:${listingId}`.
  // Mock mirrors that so the enqueue assertion is meaningful.
  buildBatchKey: vi.fn((eventType: string, ctx: Record<string, string>) =>
    eventType === 'listing_submitted' ? `listing_submitted:${ctx.listingId}` : `bk:${eventType}`
  ),
}));

import { requireUserClient } from '~~/server/utils/userAuth';
import { getServiceClient } from '~~/server/utils/supabase';
import {
  queueNotification,
  queueAdminNotification,
  buildBatchKey,
} from '~~/server/utils/exchange/notificationQueue';

const OWNER_ID = 'owner-user-id';
const OWNER_EMAIL = 'owner@example.com';
const LISTING_ID = 'listing-123';

const ownerListing = {
  id: LISTING_ID,
  slug: 'rover-mini-cooper',
  title: 'Rover Mini Cooper',
  user_id: OWNER_ID,
  profiles: { display_name: 'Cole G' },
};

let mockDb: MockSupabaseClient;

/** Point the route's getServiceClient at a fresh chainable builder and seed the
 *  ownership lookup (the route calls .from('listings').select(...).eq(...).maybeSingle()). */
function seedListing(result: { data: any; error: any }) {
  mockDb = createMockSupabaseClient();
  (mockDb._mockMaybeSingle as any).mockResolvedValue(result);
  (getServiceClient as any).mockReturnValue(mockDb);
  return mockDb;
}

function authedAs(id = OWNER_ID, email = OWNER_EMAIL) {
  (requireUserClient as any).mockResolvedValue({ user: { id, email }, supabase: {} });
}

async function loadHandler() {
  return (await import('~~/server/api/exchange/listings/submit.post')).default;
}

beforeEach(() => {
  authedAs();
  seedListing({ data: { ...ownerListing }, error: null });
  (readBody as any).mockResolvedValue({ listingId: LISTING_ID, listingTitle: 'Rover Mini Cooper' });
});

afterEach(() => {
  vi.clearAllMocks();
  (readBody as any).mockResolvedValue({});
});

describe('POST /api/exchange/listings/submit', () => {
  // --- Auth -----------------------------------------------------------------
  it('delegates auth to requireUserClient (propagates a thrown 401)', async () => {
    (requireUserClient as any).mockRejectedValue(
      createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    );
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
    // Never proceeds to the body / DB / enqueue when auth rejects.
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(queueNotification).not.toHaveBeenCalled();
  });

  it('passes the event to requireUserClient', async () => {
    const handler = await loadHandler();
    const event = { __id: 'evt' } as any;
    await handler(event);
    expect(requireUserClient).toHaveBeenCalledWith(event);
  });

  // --- Validation: missing listingId -> 400 ---------------------------------
  it('throws 400 when body is missing entirely', async () => {
    (readBody as any).mockResolvedValue(undefined);
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Listing ID is required',
    });
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  it('throws 400 when listingId is absent', async () => {
    (readBody as any).mockResolvedValue({ listingTitle: 'No id here' });
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(queueNotification).not.toHaveBeenCalled();
    expect(queueAdminNotification).not.toHaveBeenCalled();
  });

  it('throws 400 when listingId is an empty string (falsy)', async () => {
    (readBody as any).mockResolvedValue({ listingId: '' });
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
  });

  // --- DB error -> 500 ------------------------------------------------------
  it('throws 500 when the listing lookup returns an error', async () => {
    seedListing({ data: null, error: { message: 'db down' } });
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to load listing',
    });
    expect(queueNotification).not.toHaveBeenCalled();
  });

  // --- Not found -> 404 -----------------------------------------------------
  it('throws 404 when the listing does not exist', async () => {
    seedListing({ data: null, error: null });
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Listing not found',
    });
    expect(queueNotification).not.toHaveBeenCalled();
    expect(queueAdminNotification).not.toHaveBeenCalled();
  });

  // --- Ownership -> 403 -----------------------------------------------------
  it('throws 403 when the authed user is not the listing owner', async () => {
    authedAs('someone-else', 'intruder@example.com');
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'You can only submit your own listings',
    });
    // No notifications fire on a forged listingId.
    expect(queueNotification).not.toHaveBeenCalled();
    expect(queueAdminNotification).not.toHaveBeenCalled();
  });

  // --- Happy path -----------------------------------------------------------
  it('returns success on a valid owner submission', async () => {
    const handler = await loadHandler();
    const res = await handler({} as any);
    expect(res).toEqual({ success: true, message: 'Listing submitted for review' });
  });

  it('queries listings by id via the service client (single ownership re-check)', async () => {
    const handler = await loadHandler();
    await handler({} as any);
    expect(mockDb.from).toHaveBeenCalledWith('listings');
    expect(mockDb._queryBuilder.eq).toHaveBeenCalledWith('id', LISTING_ID);
    expect(mockDb._mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it('does not select the seller email column (privacy invariant)', async () => {
    const handler = await loadHandler();
    await handler({} as any);
    const selectArg = (mockDb._queryBuilder.select as any).mock.calls[0][0] as string;
    expect(selectArg).not.toMatch(/email/i);
    // Sanity: it does pull the columns the route uses downstream.
    expect(selectArg).toContain('user_id');
    expect(selectArg).toContain('slug');
    expect(selectArg).toContain('title');
  });

  it('enqueues a listing_submitted seller notification with the right payload + batch key', async () => {
    const handler = await loadHandler();
    await handler({} as any);
    expect(buildBatchKey).toHaveBeenCalledWith('listing_submitted', { listingId: LISTING_ID });
    expect(queueNotification).toHaveBeenCalledTimes(1);
    expect(queueNotification).toHaveBeenCalledWith({
      userId: OWNER_ID,
      eventType: 'listing_submitted',
      payload: { listingTitle: ownerListing.title, listingSlug: ownerListing.slug },
      batchKey: `listing_submitted:${LISTING_ID}`,
    });
  });

  it('enqueues an admin_listing_pending fan-out with seller display name', async () => {
    const handler = await loadHandler();
    await handler({} as any);
    expect(queueAdminNotification).toHaveBeenCalledTimes(1);
    expect(queueAdminNotification).toHaveBeenCalledWith({
      eventType: 'admin_listing_pending',
      payload: { listingTitle: ownerListing.title, sellerName: 'Cole G' },
    });
  });

  it('falls back to "a seller" when the profile has no display_name', async () => {
    seedListing({ data: { ...ownerListing, profiles: { display_name: null } }, error: null });
    const handler = await loadHandler();
    await handler({} as any);
    expect(queueAdminNotification).toHaveBeenCalledWith({
      eventType: 'admin_listing_pending',
      payload: { listingTitle: ownerListing.title, sellerName: 'a seller' },
    });
  });

  it('falls back to "a seller" when the joined profile is missing', async () => {
    const { profiles, ...noProfile } = ownerListing;
    seedListing({ data: noProfile, error: null });
    const handler = await loadHandler();
    const res = await handler({} as any);
    expect(res).toEqual({ success: true, message: 'Listing submitted for review' });
    expect(queueAdminNotification).toHaveBeenCalledWith({
      eventType: 'admin_listing_pending',
      payload: { listingTitle: ownerListing.title, sellerName: 'a seller' },
    });
  });

  it('uses the persisted listing title (not the body title) in the seller payload', async () => {
    // The DB row title is authoritative; a stale/forged body title is ignored.
    (readBody as any).mockResolvedValue({ listingId: LISTING_ID, listingTitle: 'STALE BODY TITLE' });
    const handler = await loadHandler();
    await handler({} as any);
    expect(queueNotification).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { listingTitle: ownerListing.title, listingSlug: ownerListing.slug } })
    );
    expect(queueAdminNotification).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { listingTitle: ownerListing.title, sellerName: 'Cole G' } })
    );
  });

  it('propagates a thrown enqueue error (Promise.all rejects)', async () => {
    // queueNotification/queueAdminNotification are fire-and-forget by contract,
    // but if a future regression makes one throw, Promise.all surfaces it.
    (queueNotification as any).mockRejectedValue(new Error('boom'));
    const handler = await loadHandler();
    await expect(handler({} as any)).rejects.toThrow('boom');
  });
});

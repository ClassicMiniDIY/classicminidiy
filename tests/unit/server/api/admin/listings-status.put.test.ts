/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// PUT /api/admin/listings/:id/status — the moderation route that did not exist.
// useAdmin().updateListingStatus() / relistListing() had been calling it since
// the TME consolidation, so approve/reject on /admin/exchange/moderation 404'd.
//
// The Supabase mock is table-keyed rather than a single shared chain, because the
// handler touches three tables in one request (listings, admin_audit_log,
// notification_queue) and the point of most of these tests is WHICH table got
// WHAT.
// ---------------------------------------------------------------------------

interface Recorded {
  table: string;
  op: 'select' | 'update' | 'insert';
  values?: any;
  filters: Array<[string, unknown]>;
}

let recorded: Recorded[] = [];
let canned: Record<string, { data: unknown; error: unknown }> = {};

function makeClient() {
  return {
    from(table: string) {
      const call: Recorded = { table, op: 'select', filters: [] };
      recorded.push(call);
      // `<table>:update` lets a test fail the WRITE while the preceding read of
      // the same table still succeeds.
      const result = () => canned[`${table}:${call.op}`] ?? canned[table] ?? { data: null, error: null };
      const builder: any = {
        select: (_c?: string) => builder,
        update: (v: any) => {
          call.op = 'update';
          call.values = v;
          return builder;
        },
        insert: (v: any) => {
          call.op = 'insert';
          call.values = v;
          return builder;
        },
        eq: (c: string, v: unknown) => {
          call.filters.push([c, v]);
          return builder;
        },
        maybeSingle: () => Promise.resolve(result()),
        then: (ok: any, err?: any) => Promise.resolve(result()).then(ok, err),
      };
      return builder;
    },
  };
}

const mockRequireAdminAuth = vi.fn().mockResolvedValue({ user: { id: 'admin-123' } });

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});
vi.stubGlobal('readBody', vi.fn());
vi.stubGlobal('getRouterParam', vi.fn());

vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => makeClient()),
}));
vi.mock('~/server/utils/adminAuth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

const handler = (await import('~~/server/api/admin/listings/[id]/status.put')).default;

const LISTING_ID = 'listing-1';
const LISTING = {
  id: LISTING_ID,
  user_id: 'seller-1',
  title: 'Fiberglass doors',
  slug: 'fiberglass-doors-abc',
  status: 'pending',
};

function evt(): any {
  return { node: { req: {} } };
}

function tableCall(table: string, op?: Recorded['op']) {
  return recorded.find((r) => r.table === table && (!op || r.op === op));
}

beforeEach(() => {
  vi.clearAllMocks();
  recorded = [];
  canned = {
    listings: { data: LISTING, error: null },
    admin_audit_log: { data: null, error: null },
    notification_queue: { data: null, error: null },
  };
  mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
  (getRouterParam as any).mockReturnValue(LISTING_ID);
});

describe('PUT /api/admin/listings/:id/status', () => {
  it('refuses a status outside the allowed set', async () => {
    // `draft` is specifically excluded: pushing a listing back to draft would
    // drop it out of the moderation queue with no way back in.
    (readBody as any).mockResolvedValue({ status: 'draft' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });

    (readBody as any).mockResolvedValue({ status: 'nonsense' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });

    (readBody as any).mockResolvedValue({});
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each(['example_free', 'example_paid'])(
    'accepts %s — the admin UI offers it and this is the only route that can set it',
    async (status) => {
      (readBody as any).mockResolvedValue({ status });

      expect(await handler(evt())).toMatchObject({ success: true, status });

      const update = tableCall('listings', 'update')!;
      expect(update.values).toEqual({ status });
      // Not a publication and not a verdict: no published_at, and the seller is
      // not emailed that their listing became a demo fixture.
      expect(update.values.published_at).toBeUndefined();
      expect(tableCall('notification_queue')).toBeUndefined();
    }
  );

  it('404s when the listing does not exist', async () => {
    canned.listings = { data: null, error: null };
    (readBody as any).mockResolvedValue({ status: 'active' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('approving stamps published_at, audits, and emails the seller', async () => {
    (readBody as any).mockResolvedValue({ status: 'active' });

    const res = await handler(evt());
    expect(res).toMatchObject({ success: true, status: 'active' });

    const update = tableCall('listings', 'update')!;
    expect(update.values.status).toBe('active');
    expect(update.values.published_at).toBeTypeOf('string');
    expect(update.filters).toEqual([['id', LISTING_ID]]);

    expect(tableCall('admin_audit_log', 'insert')!.values).toMatchObject({
      admin_id: 'admin-123',
      action: 'listing_active',
      target_type: 'listing',
      target_id: LISTING_ID,
      details: { from: 'pending', to: 'active', title: 'Fiberglass doors' },
    });

    // The submission confirmation promises an email on approval and nothing was
    // keeping it — the pending->active trigger only moves trust counters.
    expect(tableCall('notification_queue', 'insert')!.values).toMatchObject({
      user_id: 'seller-1',
      event_type: 'listing_status',
      channel: 'email',
      batch_key: `status:${LISTING_ID}`,
      payload: { listingTitle: 'Fiberglass doors', listingSlug: 'fiberglass-doors-abc', status: 'active' },
    });
  });

  it('carries a rejection reason into both the audit trail and the email', async () => {
    (readBody as any).mockResolvedValue({ status: 'cancelled', rejectionReason: 'Duplicate listing' });

    await handler(evt());

    expect(tableCall('admin_audit_log', 'insert')!.values.details).toMatchObject({
      rejectionReason: 'Duplicate listing',
    });
    expect(tableCall('notification_queue', 'insert')!.values.payload).toMatchObject({
      status: 'cancelled',
      rejectionReason: 'Duplicate listing',
    });
  });

  it('relisting clears the whole sale trail, matching the seller relist', async () => {
    canned.listings = { data: { ...LISTING, status: 'sold', tier: 'free' }, error: null };
    (readBody as any).mockResolvedValue({ status: 'active', relist: true });

    await handler(evt());

    // Field-for-field parity with relistListing() in useListings.ts. Leaving
    // tracking_* behind resurfaces stale shipping info on the detail page;
    // leaving promoted_on_social_at set makes it look already-promoted.
    const update = tableCall('listings', 'update')!;
    expect(update.values).toMatchObject({
      status: 'active',
      sold_date: null,
      final_price: null,
      tracking_number: null,
      tracking_carrier: null,
      promoted_on_social_at: null,
      featured_until: null, // free tier
    });
    expect(update.values.published_at).toBeTypeOf('string');
    expect(tableCall('admin_audit_log', 'insert')!.values.action).toBe('listing_relisted');
  });

  it('relisting a paid listing restores its featured window', async () => {
    canned.listings = { data: { ...LISTING, status: 'sold', tier: 'paid' }, error: null };
    (readBody as any).mockResolvedValue({ status: 'active', relist: true });

    await handler(evt());

    const featuredUntil = tableCall('listings', 'update')!.values.featured_until as string;
    expect(new Date(featuredUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it('short-circuits when the status already matches, writing nothing', async () => {
    canned.listings = { data: { ...LISTING, status: 'active' }, error: null };
    (readBody as any).mockResolvedValue({ status: 'active' });

    expect(await handler(evt())).toMatchObject({ success: true, unchanged: true });
    expect(tableCall('listings', 'update')).toBeUndefined();
    expect(tableCall('admin_audit_log')).toBeUndefined();
  });

  it('still relists when the status already matches (sale metadata needs clearing)', async () => {
    canned.listings = { data: { ...LISTING, status: 'active' }, error: null };
    (readBody as any).mockResolvedValue({ status: 'active', relist: true });

    expect(await handler(evt())).toMatchObject({ success: true });
    expect(tableCall('listings', 'update')!.values).toMatchObject({ sold_date: null });
  });

  it('does not fail the moderation decision when the seller email cannot be queued', async () => {
    canned.notification_queue = { data: null, error: { message: 'queue down' } };
    (readBody as any).mockResolvedValue({ status: 'active' });

    // The status write has already committed by then; the decision must stand.
    expect(await handler(evt())).toMatchObject({ success: true, status: 'active' });
  });

  it('propagates a failed status write instead of reporting success', async () => {
    // The read succeeds, the write does not.
    canned['listings:update'] = { data: null, error: { message: 'write failed' } };
    (readBody as any).mockResolvedValue({ status: 'active' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    // Nothing downstream should have run.
    expect(tableCall('admin_audit_log')).toBeUndefined();
    expect(tableCall('notification_queue')).toBeUndefined();
  });
});

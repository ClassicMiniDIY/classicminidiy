/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// PUT /api/admin/listings/:id/tier — the second admin route that did not exist.
// useAdmin().updateListingTier() had been 404ing against it since the TME
// consolidation, so an admin could not grant or revoke premium by hand.
//
// The behaviour worth pinning is that featured_until moves WITH the tier: a
// listing downgraded to free while still holding a future featured_until keeps
// its priority placement and homepage carousel slot for nothing.
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

const handler = (await import('~~/server/api/admin/listings/[id]/tier.put')).default;

const LISTING_ID = 'listing-1';
const FREE_LISTING = { id: LISTING_ID, title: 'Fiberglass doors', tier: 'free', featured_until: null };

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
    listings: { data: FREE_LISTING, error: null },
    admin_audit_log: { data: null, error: null },
  };
  mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
  (getRouterParam as any).mockReturnValue(LISTING_ID);
});

describe('PUT /api/admin/listings/:id/tier', () => {
  it('refuses anything but free or paid', async () => {
    for (const tier of ['premium', '', undefined]) {
      (readBody as any).mockResolvedValue({ tier });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it('400s without a listing id', async () => {
    (getRouterParam as any).mockReturnValue(undefined);
    (readBody as any).mockResolvedValue({ tier: 'paid' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s when the listing does not exist', async () => {
    canned.listings = { data: null, error: null };
    (readBody as any).mockResolvedValue({ tier: 'paid' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('granting paid opens a future featured window and audits it', async () => {
    (readBody as any).mockResolvedValue({ tier: 'paid' });

    expect(await handler(evt())).toMatchObject({ success: true, tier: 'paid' });

    const update = tableCall('listings', 'update')!;
    expect(update.values.tier).toBe('paid');
    expect(new Date(update.values.featured_until).getTime()).toBeGreaterThan(Date.now());
    expect(update.filters).toEqual([['id', LISTING_ID]]);

    expect(tableCall('admin_audit_log', 'insert')!.values).toMatchObject({
      admin_id: 'admin-123',
      action: 'listing_tier_granted',
      target_type: 'listing',
      target_id: LISTING_ID,
      details: { from: 'free', to: 'paid', title: 'Fiberglass doors' },
    });
  });

  it('revoking paid clears the featured window, so free placement is not free premium', async () => {
    canned.listings = {
      data: { ...FREE_LISTING, tier: 'paid', featured_until: '2099-01-01T00:00:00.000Z' },
      error: null,
    };
    (readBody as any).mockResolvedValue({ tier: 'free' });

    expect(await handler(evt())).toMatchObject({ success: true, tier: 'free' });

    expect(tableCall('listings', 'update')!.values).toMatchObject({ tier: 'free', featured_until: null });
    expect(tableCall('admin_audit_log', 'insert')!.values.action).toBe('listing_tier_revoked');
  });

  it('short-circuits when the tier already matches, writing nothing', async () => {
    (readBody as any).mockResolvedValue({ tier: 'free' });

    expect(await handler(evt())).toMatchObject({ success: true, unchanged: true });
    expect(tableCall('listings', 'update')).toBeUndefined();
    expect(tableCall('admin_audit_log')).toBeUndefined();
  });

  it('does not write listing_promotions — an admin override is not a payment', async () => {
    (readBody as any).mockResolvedValue({ tier: 'paid' });

    await handler(evt());

    // listing_promotions is the payment ledger; payment_status is likewise left
    // alone so a genuinely-paid listing keeps its record.
    expect(tableCall('listing_promotions')).toBeUndefined();
    expect(tableCall('listings', 'update')!.values.payment_status).toBeUndefined();
  });

  it('propagates a failed write instead of reporting success', async () => {
    canned['listings:update'] = { data: null, error: { message: 'write failed' } };
    (readBody as any).mockResolvedValue({ tier: 'paid' });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(tableCall('admin_audit_log')).toBeUndefined();
  });
});

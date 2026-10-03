/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/exchange/listings/:id/relist — the seller relist.
//
// A relist writes published_at, which a seller session may not write through
// PostgREST, so it runs here as the service role. The route must therefore do
// the checks RLS would have done (ownership) plus the ones the status trigger
// would have done (relistable status, approved before), and it must write the
// same columns as the admin relist: relistUpdates(), with no featured or social
// column.
//
// The Supabase mock is table-keyed and records every call, because the points
// of these tests are WHICH filters the write carries and WHAT it writes.
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

vi.mock('~~/server/utils/userAuth', () => ({
  requireUserClient: vi.fn(),
  requireUserAuth: vi.fn(),
}));
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => makeClient()),
}));

import { requireUserClient } from '~~/server/utils/userAuth';

const handler = (await import('~~/server/api/exchange/listings/[id]/relist.post')).default;

const OWNER_ID = 'owner-1';
const LISTING_ID = 'listing-1';
const SOLD = {
  id: LISTING_ID,
  user_id: OWNER_ID,
  status: 'sold',
  tier: 'paid',
  approved_at: '2026-09-01T10:00:00.123456+00:00',
  price: 9000,
};
const RELISTED = { ...SOLD, status: 'active', sold_date: null };

function evt(): any {
  return { node: { req: {} } };
}

function tableCall(table: string, op?: Recorded['op']) {
  return recorded.find((r) => r.table === table && (!op || r.op === op));
}

beforeEach(() => {
  recorded = [];
  canned = {
    'listings:select': { data: SOLD, error: null },
    'listings:update': { data: RELISTED, error: null },
  };
  (requireUserClient as any).mockResolvedValue({ user: { id: OWNER_ID }, supabase: {} });
  (getRouterParam as any).mockReturnValue(LISTING_ID);
  (readBody as any).mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  (getRouterParam as any).mockReturnValue(undefined);
  (readBody as any).mockResolvedValue({});
});

describe('POST /api/exchange/listings/:id/relist', () => {
  it('delegates auth to requireUserClient (propagates a thrown 401)', async () => {
    (requireUserClient as any).mockRejectedValueOnce(
      Object.assign(new Error('Authentication required'), { statusCode: 401 })
    );

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 401 });
    expect(recorded).toHaveLength(0);
  });

  it('400s without a listing id', async () => {
    (getRouterParam as any).mockReturnValue(undefined);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, '9000', null])('400s on an invalid price (%s)', async (price) => {
    (readBody as any).mockResolvedValue({ price });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });

  it('404s when the listing does not exist', async () => {
    canned['listings:select'] = { data: null, error: null };
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('500s when the read fails', async () => {
    canned['listings:select'] = { data: null, error: { message: 'down' } };
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });

  it('403s for a listing the caller does not own, and writes nothing', async () => {
    (requireUserClient as any).mockResolvedValue({ user: { id: 'someone-else' }, supabase: {} });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });

  it.each(['active', 'pending', 'draft', 'example_paid'])('409s for a %s listing', async (status) => {
    canned['listings:select'] = { data: { ...SOLD, status }, error: null };

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 409, data: { code: 'NOT_RELISTABLE' } });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });

  it('409s NOT_APPROVED for a listing a moderator never approved (a rejected listing)', async () => {
    canned['listings:select'] = { data: { ...SOLD, status: 'cancelled', approved_at: null }, error: null };

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 409, data: { code: 'NOT_APPROVED' } });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });

  it.each(['sold', 'expired', 'cancelled'])('relists an approved %s listing and returns the row', async (status) => {
    canned['listings:select'] = { data: { ...SOLD, status }, error: null };

    const res = await handler(evt());
    expect(res).toEqual({ success: true, listing: RELISTED });

    const update = tableCall('listings', 'update')!;
    // Conditional on what was read: owner and the status the checks ran against.
    expect(update.filters).toEqual([
      ['id', LISTING_ID],
      ['user_id', OWNER_ID],
      ['status', status],
    ]);
  });

  it('writes exactly relistUpdates(): no featured or social column, no tier or price change', async () => {
    await handler(evt());

    const values = tableCall('listings', 'update')!.values;
    expect(values).toEqual({
      status: 'active',
      published_at: expect.any(String),
      sold_date: null,
      final_price: null,
      tracking_number: null,
      tracking_carrier: null,
    });
    expect('featured_until' in values).toBe(false);
    expect('promoted_on_social' in values).toBe(false);
    expect('promoted_on_social_at' in values).toBe(false);
    // Never resends a timestamp it read (microseconds would not survive a JS Date).
    expect('approved_at' in values).toBe(false);
    expect('created_at' in values).toBe(false);
  });

  it('sets a new price when given one (0 included)', async () => {
    (readBody as any).mockResolvedValue({ price: 0 });
    await handler(evt());
    expect(tableCall('listings', 'update')!.values.price).toBe(0);
  });

  it('409s when the status changed between the read and the write (zero rows updated)', async () => {
    canned['listings:update'] = { data: null, error: null };

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 409, data: { code: 'CONFLICT' } });
  });

  it('500s when the write fails', async () => {
    canned['listings:update'] = { data: null, error: { message: 'write failed' } };

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
  });

  it('writes no audit row and touches no other table', async () => {
    await handler(evt());
    expect(recorded.map((r) => r.table)).toEqual(['listings', 'listings']);
  });
});

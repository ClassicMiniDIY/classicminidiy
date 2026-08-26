/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// PUT /api/admin/listings/:id — admin content correction.
//
// Two properties carry the whole feature and are what these tests pin:
//
//   1. It is an ALLOWLIST. `changes` is browser-written and the route is
//      service-role, so nothing but ADMIN_EDITABLE_COLUMNS stands between a
//      crafted request and the row. A rejected key must 400, not be silently
//      dropped — an admin who thinks they changed something and got a 200 has
//      no way to learn otherwise.
//   2. It never moves review state. The point of the route is fixing a price on
//      a LIVE listing without sending it back through moderation, so a write
//      that includes `status` is refused rather than honoured.
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
        single: () => Promise.resolve(result()),
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

const handler = (await import('~~/server/api/admin/listings/[id].put')).default;

const LISTING_ID = 'listing-1';
const LIVE_LISTING = {
  id: LISTING_ID,
  user_id: 'seller-9',
  title: 'Mk1 Cooper S',
  slug: 'mk1-cooper-s-abcd1234',
  status: 'active',
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
    'listings:select': { data: LIVE_LISTING, error: null },
    'listings:update': { data: { slug: LIVE_LISTING.slug }, error: null },
    admin_audit_log: { data: null, error: null },
  };
  mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
  (getRouterParam as any).mockReturnValue(LISTING_ID);
});

describe('PUT /api/admin/listings/:id', () => {
  it('requires admin auth', async () => {
    mockRequireAdminAuth.mockRejectedValue(Object.assign(new Error('nope'), { statusCode: 403 }));
    (readBody as any).mockResolvedValue({ changes: { price: 100 } });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('400s without a listing id', async () => {
    (getRouterParam as any).mockReturnValue(undefined);
    (readBody as any).mockResolvedValue({ changes: { price: 100 } });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s when changes is missing or not an object', async () => {
    for (const changes of [undefined, null, 'price=1', ['price']]) {
      (readBody as any).mockResolvedValue({ changes });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it('404s when the listing does not exist', async () => {
    canned['listings:select'] = { data: null, error: null };
    (readBody as any).mockResolvedValue({ changes: { price: 100 } });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('writes an allowlisted content change and audits the field names', async () => {
    (readBody as any).mockResolvedValue({ changes: { price: 8500, description: 'Corrected mileage.' } });

    const res = await handler(evt());

    expect(res).toMatchObject({ success: true });
    const update = tableCall('listings', 'update');
    expect(update?.values).toEqual({ price: 8500, description: 'Corrected mileage.' });
    expect(update?.filters).toContainEqual(['id', LISTING_ID]);

    const audit = tableCall('admin_audit_log', 'insert');
    expect(audit?.values).toMatchObject({
      admin_id: 'admin-123',
      action: 'listing_edited',
      target_type: 'listing',
      target_id: LISTING_ID,
    });
    // Field NAMES only — the values are seller-written free text.
    expect(audit?.values.details.fields).toEqual(['price', 'description']);
    expect(JSON.stringify(audit?.values.details)).not.toContain('Corrected mileage');
  });

  // The core promise of the route: correcting content leaves review state alone.
  it.each(['status', 'tier', 'user_id', 'payment_status', 'paid_amount', 'featured_until', 'promoted_on_social'])(
    'refuses to write %s',
    async (column) => {
      (readBody as any).mockResolvedValue({ changes: { [column]: 'active' } });

      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      expect(tableCall('listings', 'update')).toBeUndefined();
    }
  );

  it('refuses the whole request when any one key is not allowlisted', async () => {
    (readBody as any).mockResolvedValue({ changes: { price: 1, status: 'active' } });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });

  it('accepts an explicit null so an admin can clear bad data', async () => {
    (readBody as any).mockResolvedValue({ changes: { chassis_number: null } });

    await handler(evt());

    expect(tableCall('listings', 'update')?.values).toEqual({ chassis_number: null });
  });

  it('regenerates the slug when the title changes, and returns the new one', async () => {
    canned['listings:update'] = { data: { slug: 'corrected-title-deadbeef' }, error: null };
    (readBody as any).mockResolvedValue({ changes: { title: 'Corrected Title' } });

    const res = await handler(evt());

    const update = tableCall('listings', 'update');
    expect(update?.values.slug).toMatch(/^corrected-title-[0-9a-f]{8}$/);
    expect(res.slug).toBe('corrected-title-deadbeef');
  });

  it('leaves the slug alone when the title is unchanged', async () => {
    (readBody as any).mockResolvedValue({ changes: { title: LIVE_LISTING.title, price: 10 } });

    await handler(evt());

    expect(tableCall('listings', 'update')?.values).not.toHaveProperty('slug');
  });

  it('refuses an empty title rather than stripping the listing of its identity', async () => {
    for (const title of ['', '   ', 42, null]) {
      recorded = [];
      (readBody as any).mockResolvedValue({ changes: { title } });
      await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
      expect(tableCall('listings', 'update')).toBeUndefined();
    }
  });

  // The admin path sends an explicit null for a field the admin cleared, which
  // is the point of it — but these columns are NOT NULL, so a null is a 23502
  // the caller cannot act on. Name the field rather than letting a raw
  // constraint string come back as a 500 with the edit lost.
  it.each(['description', 'location', 'listing_type'])('refuses to empty the NOT NULL column %s', async (column) => {
    for (const value of [null, '', '  ']) {
      recorded = [];
      (readBody as any).mockResolvedValue({ changes: { [column]: value } });
      await expect(handler(evt())).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining(column),
      });
      expect(tableCall('listings', 'update')).toBeUndefined();
    }
  });

  it('still allows a NOT NULL column to be corrected to a new value', async () => {
    (readBody as any).mockResolvedValue({ changes: { description: 'Corrected.' } });

    await handler(evt());

    expect(tableCall('listings', 'update')?.values).toEqual({ description: 'Corrected.' });
  });

  it('trims the title before deriving the slug from it', async () => {
    (readBody as any).mockResolvedValue({ changes: { title: '  Corrected Title  ' } });

    await handler(evt());

    const update = tableCall('listings', 'update');
    expect(update?.values.title).toBe('Corrected Title');
    expect(update?.values.slug).toMatch(/^corrected-title-[0-9a-f]{8}$/);
  });

  it('surfaces a failed update instead of reporting success', async () => {
    canned['listings:update'] = { data: null, error: { message: 'constraint violated' } };
    (readBody as any).mockResolvedValue({ changes: { price: 1 } });

    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
    expect(tableCall('admin_audit_log', 'insert')).toBeUndefined();
  });

  it('no-ops cleanly on an empty changes object', async () => {
    (readBody as any).mockResolvedValue({ changes: {} });

    const res = await handler(evt());

    expect(res).toEqual({ success: true, slug: LIVE_LISTING.slug, changed: [] });
    expect(tableCall('listings', 'update')).toBeUndefined();
  });
});

/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/admin/parts/set-licence — the per-source kill switch.
//
// This route is the mechanism behind mitigation 4 of the part-number database
// design: setting a source to `declined` drops every row it contributed out of
// the public archive. The policies do the hiding; this route flips the flag,
// records why, and stops the crawl.
//
// Table-keyed Supabase mock, same shape as listings-status.put.test.ts, because
// one request touches three tables and the point of most of these tests is
// WHICH table got WHAT.
// ---------------------------------------------------------------------------

interface Recorded {
  table: string;
  op: 'select' | 'update' | 'insert' | 'upsert';
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
        upsert: (v: any, _o?: any) => {
          call.op = 'upsert';
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

vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: vi.fn(() => makeClient()),
}));
vi.mock('~/server/utils/adminAuth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

const handler = (await import('~~/server/api/admin/parts/set-licence.post')).default;

const SOURCE_ID = 'source-1';
const SOURCE = { id: SOURCE_ID, slug: 'somerford-mini', name: 'Somerford Mini', licence_status: 'none' };

function evt(): any {
  return { node: { req: {} } };
}
function tableCall(table: string, op?: Recorded['op']) {
  return recorded.find((r) => r.table === table && (!op || r.op === op));
}
function body(patch: Record<string, unknown> = {}) {
  (readBody as any).mockResolvedValue({
    sourceId: SOURCE_ID,
    status: 'declined',
    reason: 'Takedown request received by email',
    ...patch,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  recorded = [];
  canned = {
    part_sources: { data: SOURCE, error: null },
    part_source_private: { data: null, error: null },
    admin_audit_log: { data: null, error: null },
  };
  mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
});

describe('POST /api/admin/parts/set-licence', () => {
  it('requires admin auth before reading anything', async () => {
    mockRequireAdminAuth.mockRejectedValue(Object.assign(new Error('Admin access required'), { statusCode: 403 }));
    body();
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(recorded).toHaveLength(0);
  });

  it('refuses a status outside the four licence states', async () => {
    body({ status: 'revoked' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses a licence change with no reason', async () => {
    // A takedown gets asked about months later. An unattributed status flip
    // answers nothing, so the reason is not optional.
    body({ reason: '   ' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(tableCall('part_sources', 'update')).toBeUndefined();
  });

  it('404s an unknown source instead of writing', async () => {
    canned.part_sources = { data: null, error: { message: 'no rows' } };
    body();
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
    expect(tableCall('part_sources', 'update')).toBeUndefined();
  });

  it('is a no-op when the status already matches', async () => {
    canned.part_sources = { data: { ...SOURCE, licence_status: 'declined' }, error: null };
    body();
    await expect(handler(evt())).resolves.toEqual({ ok: true, unchanged: true });
    expect(tableCall('part_sources', 'update')).toBeUndefined();
    expect(tableCall('admin_audit_log')).toBeUndefined();
  });

  it('declining writes the status, the reason, and the audit row', async () => {
    body();
    await expect(handler(evt())).resolves.toMatchObject({ ok: true, from: 'none', to: 'declined' });

    const update = tableCall('part_sources', 'update');
    expect(update?.values).toMatchObject({ licence_status: 'declined' });
    expect(update?.filters).toContainEqual(['id', SOURCE_ID]);

    const note = tableCall('part_source_private', 'upsert');
    expect(note?.values).toMatchObject({
      source_id: SOURCE_ID,
      licence_note: 'Takedown request received by email',
      licence_changed_by: 'admin-123',
    });

    const audit = tableCall('admin_audit_log', 'insert');
    expect(audit?.values).toMatchObject({
      action: 'part_source_declined',
      target_type: 'part_source',
      target_id: SOURCE_ID,
      details: { from: 'none', to: 'declined', reason: 'Takedown request received by email' },
    });
  });

  it('DECLINING ALSO STOPS THE CRAWL', async () => {
    // Hiding a source's rows while still fetching its pages is the worst of
    // both: we keep taking the traffic that prompted the complaint and get no
    // archive value for it.
    body();
    await handler(evt());
    expect(tableCall('part_source_private', 'upsert')?.values).toMatchObject({ crawl_enabled: false });
  });

  it('does not touch crawl_enabled for a non-declining change', async () => {
    // Re-granting must not silently start a crawl that was deliberately off.
    body({ status: 'granted', reason: 'Licence agreed by email' });
    await handler(evt());
    const note = tableCall('part_source_private', 'upsert');
    expect(note?.values).not.toHaveProperty('crawl_enabled');
    expect(tableCall('admin_audit_log', 'insert')?.values).toMatchObject({
      action: 'part_source_licence_changed',
    });
  });

  it('fails loudly when the status landed but the reason did not', async () => {
    // The status change is what matters for a takedown, so it is not rolled
    // back — but losing the record of WHY has to be visible, not swallowed.
    canned['part_source_private:upsert'] = { data: null, error: { message: 'write failed' } };
    body();
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
  });
});

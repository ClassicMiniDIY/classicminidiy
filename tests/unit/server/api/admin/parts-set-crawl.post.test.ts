/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/admin/parts/set-crawl — the start/pause control on /admin/parts.
//
// The interesting case is the declined guard: declining a source already sets
// crawl_enabled false, so a start button that ignored licence status would be a
// way to walk around a takedown from a different screen.
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

vi.mock('~/server/utils/supabase', () => ({ getServiceClient: vi.fn(() => makeClient()) }));
vi.mock('~/server/utils/adminAuth', () => ({ requireAdminAuth: mockRequireAdminAuth }));

const handler = (await import('~~/server/api/admin/parts/set-crawl.post')).default;

const SOURCE_ID = 'source-1';
const evt = (): any => ({ node: { req: {} } });
const tableCall = (t: string, op?: Recorded['op']) => recorded.find((r) => r.table === t && (!op || r.op === op));
function body(patch: Record<string, unknown> = {}) {
  (readBody as any).mockResolvedValue({ sourceId: SOURCE_ID, enabled: true, ...patch });
}

beforeEach(() => {
  vi.clearAllMocks();
  recorded = [];
  canned = {
    part_sources: {
      data: { id: SOURCE_ID, slug: 'somerford-mini', name: 'Somerford Mini', licence_status: 'none' },
      error: null,
    },
    part_source_private: { data: { crawl_enabled: false }, error: null },
    admin_audit_log: { data: null, error: null },
  };
  mockRequireAdminAuth.mockResolvedValue({ user: { id: 'admin-123' } });
});

describe('POST /api/admin/parts/set-crawl', () => {
  it('requires admin auth before touching anything', async () => {
    mockRequireAdminAuth.mockRejectedValue(Object.assign(new Error('nope'), { statusCode: 403 }));
    body();
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(recorded).toHaveLength(0);
  });

  it('refuses a non-boolean enabled', async () => {
    body({ enabled: 'yes' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s an unknown source', async () => {
    canned.part_sources = { data: null, error: { message: 'no rows' } };
    body();
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('REFUSES to start a declined source', async () => {
    // Declining already stops the crawl. If this route ignored licence status it
    // would be a route around a takedown from a different screen.
    canned.part_sources = {
      data: { id: SOURCE_ID, slug: 'somerford-mini', name: 'Somerford Mini', licence_status: 'declined' },
      error: null,
    };
    body({ enabled: true });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 409 });
    expect(tableCall('part_source_private', 'upsert')).toBeUndefined();
  });

  it('still allows PAUSING a declined source', async () => {
    // Only starting is blocked. Pausing is always safe and always permitted.
    canned.part_sources = {
      data: { id: SOURCE_ID, slug: 'somerford-mini', name: 'Somerford Mini', licence_status: 'declined' },
      error: null,
    };
    canned.part_source_private = { data: { crawl_enabled: true }, error: null };
    body({ enabled: false });
    await expect(handler(evt())).resolves.toMatchObject({ ok: true, enabled: false });
  });

  it('is a no-op when already in the requested state', async () => {
    canned.part_source_private = { data: { crawl_enabled: true }, error: null };
    body({ enabled: true });
    await expect(handler(evt())).resolves.toEqual({ ok: true, unchanged: true });
    expect(tableCall('part_source_private', 'upsert')).toBeUndefined();
    expect(tableCall('admin_audit_log')).toBeUndefined();
  });

  it('writes the flag and an audit row', async () => {
    body({ enabled: true });
    await expect(handler(evt())).resolves.toMatchObject({ ok: true, enabled: true });
    expect(tableCall('part_source_private', 'upsert')?.values).toMatchObject({
      source_id: SOURCE_ID,
      crawl_enabled: true,
    });
    expect(tableCall('admin_audit_log', 'insert')?.values).toMatchObject({
      action: 'part_source_crawl_started',
      target_type: 'part_source',
    });
  });

  it('records a pause under its own audit action', async () => {
    canned.part_source_private = { data: { crawl_enabled: true }, error: null };
    body({ enabled: false });
    await handler(evt());
    expect(tableCall('admin_audit_log', 'insert')?.values).toMatchObject({
      action: 'part_source_crawl_paused',
    });
  });

  it('surfaces an audit write failure', async () => {
    canned['admin_audit_log:insert'] = { data: null, error: { message: 'audit down' } };
    body({ enabled: true });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
  });
});

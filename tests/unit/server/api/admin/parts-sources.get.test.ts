/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// GET /api/admin/parts/sources — the Parts Sources screen.
//
// Three reads, not four hundred: part_sources, part_source_private and the
// admin_part_source_stats view. The first version of this route ran thirteen
// exact COUNTs per source and the page took long enough that pagination was
// proposed. These tests hold the query count and the two semantics that make
// the screen safe to act on: a failed stats read renders every count as
// UNKNOWN (null), never zero; and the open-refusal alarm is read as structure
// from the newest refusing run while a cycle is open.
// ---------------------------------------------------------------------------

let tables: string[] = [];
let canned: Record<string, { data: unknown; error: unknown }> = {};

function makeClient() {
  return {
    from(table: string) {
      tables.push(table);
      const result = () => canned[table] ?? { data: [], error: null };
      const builder: any = {
        select: () => builder,
        order: () => builder,
        returns: () => builder,
        then: (ok: any, err?: any) => Promise.resolve(result()).then(ok, err),
      };
      return builder;
    },
  };
}

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  return e;
});

vi.mock('~/server/utils/supabase', () => ({ getServiceClient: vi.fn(() => makeClient()) }));
vi.mock('~/server/utils/adminAuth', () => ({
  requireAdminAuth: vi.fn().mockResolvedValue({ user: { id: 'admin-123' } }),
}));

const handler = (await import('~~/server/api/admin/parts/sources.get')).default;
const evt = (): any => ({ node: { req: {} } });

const SOURCE = {
  id: 'src-1',
  slug: 'mini-spares',
  name: 'Mini Spares',
  domain: 'minispares.com',
  kind: 'retailer',
  licence_status: 'granted',
  terms_url: null,
  precedence: 10,
  last_reviewed_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

const STATS = {
  source_id: 'src-1',
  parts: 12000,
  diagrams: 372,
  applicability: 100,
  supersessions: 5,
  kit_contents: 2,
  source_records: 13000,
  retired_records: 40,
  recent_withdrawn: 3,
  recent_changed: 9,
  callouts: 4000,
  queue_total: 500,
  queue_remaining: 120,
  queue_blocked: 7,
  recent_runs: [
    {
      phase: 'drain',
      status: 'completed',
      started_at: '2026-09-18T16:20:00Z',
      finished_at: '2026-09-18T16:21:00Z',
      requests_made: 14,
      records_written: 20,
      abort_reason: null,
      notes: { refresh: 'closed a cycle' },
    },
    {
      phase: 'drain',
      status: 'aborted',
      started_at: '2026-09-18T16:10:00Z',
      finished_at: '2026-09-18T16:10:30Z',
      requests_made: 3,
      records_written: 0,
      abort_reason: 'reconcile refused',
      notes: { refusal: { unseen: 900, total: 1000 } },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  tables = [];
  canned = {
    part_sources: { data: [SOURCE], error: null },
    part_source_private: {
      data: [{ source_id: 'src-1', crawl_enabled: true, refresh_cycle_started_at: '2026-09-18T00:00:00Z' }],
      error: null,
    },
    admin_part_source_stats: { data: [STATS], error: null },
  };
});

describe('GET /api/admin/parts/sources', () => {
  it('reads three tables, once each, whatever the source count', async () => {
    canned.part_sources = { data: Array.from({ length: 40 }, (_, i) => ({ ...SOURCE, id: `src-${i}` })), error: null };
    await handler(evt());
    expect(tables.sort()).toEqual(['admin_part_source_stats', 'part_source_private', 'part_sources']);
  });

  it('maps the view row onto the counts, the queue and the public total', async () => {
    const { sources } = await handler(evt());
    const s = sources[0];
    expect(s.counts).toMatchObject({
      parts: 12000,
      diagrams: 372,
      callouts: 4000,
      applicability: 100,
      supersessions: 5,
      kitContents: 2,
      sourceRecords: 13000,
      retiredRecords: 40,
      recentWithdrawn: 3,
      recentChanged: 9,
    });
    // Public rows exclude source_records, which are never public.
    expect(s.counts.publicRows).toBe(12000 + 372 + 4000 + 100 + 5 + 2);
    expect(s.queue).toEqual({ total: 500, remaining: 120, blocked: 7 });
    expect(s.lastRun).toMatchObject({ phase: 'drain', status: 'completed', refreshNote: 'closed a cycle' });
    expect(s.runInFlight).toBe(false);
  });

  it('reads the open refusal from the newest refusing run while a cycle is open, and not otherwise', async () => {
    const open = await handler(evt());
    expect(open.sources[0].openRefusal).toEqual({ unseen: 900, total: 1000 });

    canned.part_source_private = {
      data: [{ source_id: 'src-1', crawl_enabled: true, refresh_cycle_started_at: null }],
      error: null,
    };
    const closed = await handler(evt());
    expect(closed.sources[0].openRefusal).toBeNull();
  });

  it('renders every count as UNKNOWN when the stats view cannot be read — never as zero', async () => {
    canned.admin_part_source_stats = { data: null, error: { message: 'permission denied' } };
    const { sources } = await handler(evt());
    const s = sources[0];
    expect(s.slug).toBe('mini-spares');
    expect(s.crawlEnabled).toBe(true);
    for (const v of Object.values(s.counts)) expect(v).toBeNull();
    expect(s.lastRun).toBeNull();
    expect(s.openRefusal).toBeNull();
  });

  it('a source with no stats row (brand new, nothing crawled) gets null counts, not a fabricated zero', async () => {
    canned.admin_part_source_stats = { data: [], error: null };
    const { sources } = await handler(evt());
    expect(sources[0].counts.parts).toBeNull();
    expect(sources[0].queue).toEqual({ total: 0, remaining: 0, blocked: 0 });
  });
});

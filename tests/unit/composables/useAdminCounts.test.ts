import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupGlobalMocks } from '../../setup/testHelpers';

// ---------------------------------------------------------------------------
// useAdminCounts — the pending-work counts shared by the admin shell's sidebar
// badges and the /admin dashboard tiles.
//
// Two things here are regression guards rather than feature tests:
//
//   1. The member count comes from a SERVER route. RLS on `subscriptions` is
//      `auth.uid() = user_id OR service_role` with no is_admin() branch, so a
//      client-side count silently returns the admin's own rows — 200, count 0,
//      nothing logged, a confident wrong number on the dashboard.
//   2. The load is TTL-cached and shares its in-flight promise. The shell and
//      the dashboard mount together and the shell re-checks on every admin
//      navigation; without this they fired every query twice per paint.
// ---------------------------------------------------------------------------

/** Chainable head-count builder that resolves with { count }. */
function countBuilder(counts: Record<string, number | Error>) {
  const seen: string[] = [];
  const client = {
    tablesQueried: seen,
    from(table: string) {
      seen.push(table);
      const result = counts[table];
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        then: (ok: any, err?: any) =>
          result instanceof Error
            ? Promise.reject(result).then(ok, err)
            : Promise.resolve({ count: result ?? 0, error: null }).then(ok, err),
      };
      return builder;
    },
  };
  return client;
}

let adminFetch: ReturnType<typeof vi.fn>;
let messageCount: ReturnType<typeof vi.fn>;
let supabase: ReturnType<typeof countBuilder>;

function stubEnv(opts: { exchangeEnabled?: boolean } = {}) {
  supabase = countBuilder({ models: 2, model_reports: 1, listings: 3, external_listings: 4, wanted_posts: 5 });

  adminFetch = vi.fn(async (url: string) => {
    if (url === '/api/admin/queue/count') return { count: 7 };
    if (url === '/api/admin/stats/members') return { count: 42 };
    throw new Error(`unexpected url ${url}`);
  });
  messageCount = vi.fn().mockResolvedValue(6);

  vi.stubGlobal('useSupabase', () => supabase);
  vi.stubGlobal('$adminFetch', adminFetch);
  vi.stubGlobal('useAdmin', () => ({ getMessageQueueCount: messageCount }));
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { exchangeEnabled: opts.exchangeEnabled ?? true },
  }));
}

const load = async () => (await import('~/app/composables/useAdminCounts')).useAdminCounts();

beforeEach(() => {
  vi.resetModules();
  (global as any).__resetNuxtState();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
  stubEnv();
});

afterEach(() => {
  vi.useRealTimers();
  cleanupGlobalMocks();
});

describe('useAdminCounts()', () => {
  it('populates every count from its own source', async () => {
    const counts = await load();
    await counts.load();

    expect(counts.counts.value).toEqual({
      submissions: 7,
      members: 42,
      models: 2,
      reports: 1,
      listings: 3,
      finds: 4,
      wanted: 5,
      messages: 6,
    });
  });

  // The bug this composable was extracted to fix.
  it('reads the member count from the server route, never from the subscriptions table', async () => {
    const counts = await load();
    await counts.load();

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/stats/members');
    expect(supabase.tablesQueried).not.toContain('subscriptions');
  });

  it('sums the three marketplace moderation queues', async () => {
    const counts = await load();
    await counts.load();

    expect(counts.moderation.value).toBe(3 + 4 + 5);
  });

  it('is not ready until the first load resolves', async () => {
    const counts = await load();
    expect(counts.ready.value).toBe(false);

    await counts.load();
    expect(counts.ready.value).toBe(true);
  });

  it('reuses a recent load instead of refiring the queries', async () => {
    const counts = await load();
    await counts.load();
    adminFetch.mockClear();

    vi.setSystemTime(new Date('2026-08-26T12:00:10Z'));
    await counts.load();

    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('reloads once the cache has expired', async () => {
    const counts = await load();
    await counts.load();
    adminFetch.mockClear();

    vi.setSystemTime(new Date('2026-08-26T12:01:00Z'));
    await counts.load();

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/queue/count');
  });

  it('forces a reload when refreshed, cache or no cache', async () => {
    const counts = await load();
    await counts.load();
    adminFetch.mockClear();

    await counts.refresh();

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/queue/count');
  });

  // The shell and the dashboard mount together.
  it('shares one round of queries between concurrent callers', async () => {
    const counts = await load();

    await Promise.all([counts.load(), counts.load(), counts.refresh()]);

    expect(adminFetch.mock.calls.filter(([url]) => url === '/api/admin/queue/count')).toHaveLength(1);
  });

  it('lets one failing source degrade its own field without losing the others', async () => {
    adminFetch = vi.fn(async (url: string) => {
      if (url === '/api/admin/stats/members') throw new Error('boom');
      return { count: 7 };
    });
    vi.stubGlobal('$adminFetch', adminFetch);
    supabase = countBuilder({ models: new Error('boom'), model_reports: 1 });
    vi.stubGlobal('useSupabase', () => supabase);

    const counts = await load();
    await counts.load();

    expect(counts.counts.value.members).toBe(0);
    expect(counts.counts.value.models).toBe(0);
    expect(counts.counts.value.submissions).toBe(7);
    expect(counts.counts.value.reports).toBe(1);
    expect(counts.ready.value).toBe(true);
  });

  it('skips the marketplace queries when the exchange is disabled', async () => {
    stubEnv({ exchangeEnabled: false });

    const counts = await load();
    await counts.load();

    expect(supabase.tablesQueried).not.toContain('listings');
    expect(supabase.tablesQueried).not.toContain('wanted_posts');
    expect(messageCount).not.toHaveBeenCalled();
    expect(counts.counts.value.submissions).toBe(7);
    expect(counts.moderation.value).toBe(0);
  });
});

/**
 * The pending-work counts shared by the admin shell's sidebar badges and the
 * /admin dashboard tiles.
 *
 * These two surfaces were loading the same six things independently, so the
 * busiest admin page fired every query twice on first paint, and the shell
 * refired all of them on every navigation between admin sections. One shared,
 * TTL-cached load instead: the shell asks on mount and on route change and
 * almost always gets the cache, the dashboard's Refresh button forces a real
 * reload.
 *
 * Every field loads independently and swallows its own failure. A count is
 * decoration on the shell and a headline on the dashboard, but in neither case
 * should one unavailable table blank the first screen an admin sees after
 * signing in — a failed count stays at its last value (0 on a cold load).
 */
export interface AdminCounts {
  /** submission_queue rows awaiting review. */
  submissions: number;
  /** Marketplace moderation, split so the dashboard can show the breakdown. */
  listings: number;
  finds: number;
  wanted: number;
  /** Reported marketplace messages. */
  messages: number;
  /** 3D model library. */
  models: number;
  reports: number;
  /** Active Sustaining Members — server-side, see the route for why. */
  members: number;
}

const EMPTY: AdminCounts = {
  submissions: 0,
  listings: 0,
  finds: 0,
  wanted: 0,
  messages: 0,
  models: 0,
  reports: 0,
  members: 0,
};

/** How long a load is reused. Long enough that clicking through four admin
 *  sections costs one round of queries, short enough that a badge is not
 *  visibly stale after approving something. */
const TTL_MS = 30_000;

/** In flight promise. Module scope rather than useState because a Promise must
 *  never end up in the SSR payload; every caller here is client-only. */
let inFlight: Promise<void> | null = null;

export const useAdminCounts = () => {
  const counts = useState<AdminCounts>('admin:counts', () => ({ ...EMPTY }));
  const loadedAt = useState<number>('admin:counts:loadedAt', () => 0);
  const loading = useState<boolean>('admin:counts:loading', () => false);

  const supabase = useSupabase();
  const { getMessageQueueCount } = useAdmin();
  const exchangeEnabled = useRuntimeConfig().public.exchangeEnabled;

  const moderation = computed(() => counts.value.listings + counts.value.finds + counts.value.wanted);

  /** False until the first load resolves. Distinct from `loading`, which is
   *  false before that load starts — a caller that skeletons on `loading` alone
   *  paints a screen of confident zeros first. */
  const ready = computed(() => loadedAt.value > 0);

  const settle = (p: Promise<unknown>) => p.catch(() => undefined);

  const run = async () => {
    loading.value = true;
    const next = { ...counts.value };

    await Promise.all([
      settle(
        $adminFetch<{ count: number }>('/api/admin/queue/count').then((r) => {
          next.submissions = r?.count || 0;
        })
      ),
      settle(
        $adminFetch<{ count: number }>('/api/admin/stats/members').then((r) => {
          next.members = r?.count || 0;
        })
      ),
      settle(
        supabase
          .from('models')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(({ count }) => {
            next.models = count || 0;
          })
      ),
      settle(
        supabase
          .from('model_reports')
          .select('id', { count: 'exact', head: true })
          // Matches the Reports tab on /admin/models — a report being looked at
          // is still a report waiting on you.
          .in('status', ['open', 'reviewing'])
          .then(({ count }) => {
            next.reports = count || 0;
          })
      ),
      ...(exchangeEnabled
        ? [
            settle(
              supabase
                .from('listings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .then(({ count }) => {
                  next.listings = count || 0;
                })
            ),
            settle(
              supabase
                .from('external_listings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .then(({ count }) => {
                  next.finds = count || 0;
                })
            ),
            settle(
              supabase
                .from('wanted_posts')
                .select('id', { count: 'exact', head: true })
                .in('moderation_status', ['pending', 'flagged'])
                .then(({ count }) => {
                  next.wanted = count || 0;
                })
            ),
            settle(
              getMessageQueueCount().then((n: number) => {
                next.messages = n || 0;
              })
            ),
          ]
        : []),
    ]);

    counts.value = next;
    loadedAt.value = Date.now();
    loading.value = false;
  };

  /** Load unless a recent result is already cached. Concurrent callers — the
   *  shell and the dashboard mounting together — share one round of queries. */
  const load = async (force = false) => {
    if (import.meta.server) return;
    if (!force && Date.now() - loadedAt.value < TTL_MS) return;
    if (inFlight) return inFlight;

    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const refresh = () => load(true);

  return { counts, moderation, loading, ready, load, refresh };
};

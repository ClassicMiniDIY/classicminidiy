/**
 * GET /api/admin/parts/sources  (admin — parts source licence management)
 *
 * One row per part source: its licence status, its crawl budget, and a live
 * count of everything it currently contributes to the public archive.
 *
 * THE COUNTS ARE THE POINT OF THE SCREEN. The status control is a four-way
 * select; what makes it usable is knowing, before the click, that declining
 * Somerford hides ~12,000 parts and ~372 diagrams. A kill switch whose blast
 * radius is invisible does not get pulled during the phone call that needs it.
 *
 * Service role, because part_source_private and part_source_records carry no
 * grant for any browser role — licence correspondence, retailer identifiers and
 * crawl budgets are deliberately unreachable from a session.
 *
 * THREE QUERIES, NOT FOUR HUNDRED. The counts come from the
 * `admin_part_source_stats` view (classicminidiy-supabase, 20260918000012),
 * one row per source with every figure this screen shows and its last five
 * ingest runs. The first version of this route ran thirteen exact COUNTs per
 * source through PostgREST — ~480 round trips at 37 sources — and the page
 * took long enough that pagination was proposed. The rows were never the
 * cost. The view is service-role only: it exposes queue sizes and run notes.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/**
 * Null means the count could not be read, NOT zero. The page renders null as
 * "unknown" — on a kill-switch screen a zero reads as "declining hides nothing",
 * which is the one wrong answer that makes a destructive action look safe.
 */
interface SourceCounts {
  parts: number | null;
  diagrams: number | null;
  callouts: number | null;
  applicability: number | null;
  supersessions: number | null;
  kitContents: number | null;
  sourceRecords: number | null;
  /** Records no longer current, i.e. gone from the source. Never public. */
  retiredRecords: number | null;
  /** part_change_log entries in the last 30 days, by kind. */
  recentWithdrawn: number | null;
  recentChanged: number | null;
  publicRows: number | null;
}

/**
 * What the ingest writes into `part_ingest_runs.notes`. JSONB and NOT NULL, so
 * an absent key is the normal case, not an error.
 */
interface RunNotes {
  /** What a completed refresh cycle did, in one sentence. */
  refresh?: string;
  /** Present when reconcile refused to close a cycle. */
  refusal?: { unseen: number; total: number };
}

/** The columns of `part_source_private` this screen reads. */
interface SourceSetting {
  source_id: string;
  licence_note: string | null;
  licence_changed_at: string | null;
  licence_changed_by: string | null;
  contact_email: string | null;
  crawl_enabled: boolean;
  max_requests_per_run: number | null;
  max_requests_per_day: number | null;
  min_request_interval_ms: number | null;
  max_change_ratio: number | null;
  refresh_after_days: number | null;
  gone_after_misses: number | null;
  refresh_cycle_started_at: string | null;
}

/** One row of `admin_part_source_stats`. bigint comes back as a number through PostgREST. */
interface SourceStats {
  source_id: string;
  parts: number;
  diagrams: number;
  applicability: number;
  supersessions: number;
  kit_contents: number;
  source_records: number;
  retired_records: number;
  recent_withdrawn: number;
  recent_changed: number;
  callouts: number;
  queue_total: number;
  queue_remaining: number;
  queue_blocked: number;
  /** Newest first, at most five. */
  recent_runs: RecentRun[];
}

interface RecentRun {
  phase: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  requests_made: number | null;
  records_written: number | null;
  abort_reason: string | null;
  notes: RunNotes | null;
}

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const db = getServiceClient();

  const { data: sources, error } = await db
    .from('part_sources')
    .select('id, slug, name, domain, kind, licence_status, terms_url, precedence, last_reviewed_at, created_at')
    .order('precedence', { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Could not read part sources: ${error.message}` });
  }

  const rows = sources ?? [];
  if (rows.length === 0) return { sources: [] };

  // `returns<>` rather than inference: the select list is a concatenation, which
  // PostgREST's type helper cannot parse, and it names columns the generated
  // Database types will not carry until `bun run gen:types` runs against the
  // applied migration. Declaring the shape here keeps the read typed either way.
  const [{ data: privateRows, error: privateError }, { data: statRows, error: statsError }] = await Promise.all([
    db
      .from('part_source_private')
      .select(
        'source_id, licence_note, licence_changed_at, licence_changed_by, contact_email, crawl_enabled, ' +
          'max_requests_per_run, max_requests_per_day, min_request_interval_ms, max_change_ratio, ' +
          'refresh_after_days, gone_after_misses, refresh_cycle_started_at'
      )
      .returns<SourceSetting[]>(),
    db.from('admin_part_source_stats').select('*').returns<SourceStats[]>(),
  ]);

  if (privateError) {
    throw createError({ statusCode: 500, statusMessage: `Could not read source settings: ${privateError.message}` });
  }

  // A FAILED COUNT MUST NOT RENDER AS ZERO. On this screen a zero reads as
  // "declining hides nothing", which is the one wrong answer that makes a
  // destructive action look safe. If the stats view cannot be read, the screen
  // still renders — licence controls have to work during the phone call that
  // needs them — but every count is null, which the page shows as "unknown".
  if (statsError) {
    console.error(`[admin/parts] admin_part_source_stats failed: ${statsError.message}`);
  }
  const stats = new Map((statRows ?? []).map((r) => [r.source_id, r]));

  const settings = Object.fromEntries((privateRows ?? []).map((r) => [r.source_id, r]));

  const list = rows.map((source) => {
    const st = statsError ? undefined : stats.get(source.id);
    const runs: RecentRun[] = st?.recent_runs ?? [];
    const lastRun = runs[0];

    // Named rather than a dynamic Record: an index signature makes every read
    // `number | null | undefined`, which hides the difference between "the
    // count failed" and "that key was never set".
    const counts: SourceCounts = {
      parts: st?.parts ?? null,
      diagrams: st?.diagrams ?? null,
      applicability: st?.applicability ?? null,
      supersessions: st?.supersessions ?? null,
      kitContents: st?.kit_contents ?? null,
      sourceRecords: st?.source_records ?? null,
      // Records the refresh has retired. Public reads filter these out, so this
      // is the difference between what the source contributed and what it still
      // contributes — the number that says whether the refresh is working.
      retiredRecords: st?.retired_records ?? null,
      recentWithdrawn: st?.recent_withdrawn ?? null,
      recentChanged: st?.recent_changed ?? null,
      callouts: st?.callouts ?? null,
      publicRows: null,
    };

    // What a decline would actually hide from the public archive. Deliberately
    // excludes source_records, which is service-role only and never public.
    //
    // Null if ANY component failed: a partial total is worse than no total,
    // because it looks authoritative.
    const publicParts: (number | null)[] = [
      counts.parts,
      counts.diagrams,
      counts.callouts,
      counts.applicability,
      counts.supersessions,
      counts.kitContents,
    ];
    counts.publicRows = publicParts.every((n): n is number => n !== null)
      ? publicParts.reduce((a, b) => a + b, 0)
      : null;

    const setting = settings[source.id] ?? null;
    return {
      id: source.id,
      slug: source.slug,
      name: source.name,
      domain: source.domain,
      kind: source.kind,
      licenceStatus: source.licence_status,
      termsUrl: source.terms_url,
      precedence: source.precedence,
      lastReviewedAt: source.last_reviewed_at,
      licenceNote: setting?.licence_note ?? null,
      licenceChangedAt: setting?.licence_changed_at ?? null,
      contactEmail: setting?.contact_email ?? null,
      crawlEnabled: setting?.crawl_enabled ?? false,
      maxRequestsPerRun: setting?.max_requests_per_run ?? null,
      maxRequestsPerDay: setting?.max_requests_per_day ?? null,
      minRequestIntervalMs: setting?.min_request_interval_ms ?? null,
      maxChangeRatio: setting?.max_change_ratio ?? null,
      refreshAfterDays: setting?.refresh_after_days ?? null,
      goneAfterMisses: setting?.gone_after_misses ?? null,
      refreshCycleStartedAt: setting?.refresh_cycle_started_at ?? null,
      // THE REFUSAL OUTLIVES THE RUN THAT MADE IT. A refused cycle stays open
      // by design, so the next --discover, or a drain that stops on its
      // budget, becomes `lastRun` and the alarm would disappear while the
      // condition it reported is still true. So it is read from the newest
      // refusal among the runs we hold, for as long as a cycle is open.
      //
      // Read as STRUCTURE. The first cut had the admin page match the opening
      // words of abort_reason, which made an English sentence in the other
      // repo into a contract this screen depends on.
      openRefusal: setting?.refresh_cycle_started_at
        ? (runs.map((r) => r.notes?.refusal).find((r): r is { unseen: number; total: number } => Boolean(r)) ?? null)
        : null,
      counts,
      // Blocked rows are excluded from `remaining`: they will never be fetched,
      // so counting them as "left" overstates the work remaining for ever.
      queue: {
        total: st?.queue_total ?? 0,
        remaining: st?.queue_remaining ?? 0,
        blocked: st?.queue_blocked ?? 0,
      },
      runInFlight: runs.some((r) => r.status === 'running'),
      lastRun: lastRun
        ? {
            phase: lastRun.phase,
            status: lastRun.status,
            startedAt: lastRun.started_at,
            finishedAt: lastRun.finished_at,
            requestsMade: lastRun.requests_made,
            recordsWritten: lastRun.records_written,
            abortReason: lastRun.abort_reason,
            // What a completed refresh cycle did, if the run closed one.
            refreshNote: lastRun.notes?.refresh ?? null,
          }
        : null,
    };
  });

  return { sources: list };
});

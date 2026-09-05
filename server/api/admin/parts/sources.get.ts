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
  publicRows: number | null;
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

/** Tables that hang off a source directly and are worth counting. */
const DIRECT_COUNTS = [
  ['parts', 'parts'],
  ['part_diagrams', 'diagrams'],
  ['part_applicability', 'applicability'],
  ['part_supersessions', 'supersessions'],
  ['part_kit_contents', 'kitContents'],
  ['part_source_records', 'sourceRecords'],
] as const;

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
  const { data: privateRows, error: privateError } = await db
    .from('part_source_private')
    .select(
      'source_id, licence_note, licence_changed_at, licence_changed_by, contact_email, crawl_enabled, ' +
        'max_requests_per_run, max_requests_per_day, min_request_interval_ms, max_change_ratio, ' +
        'refresh_after_days, gone_after_misses, refresh_cycle_started_at'
    )
    .returns<SourceSetting[]>();

  if (privateError) {
    throw createError({ statusCode: 500, statusMessage: `Could not read source settings: ${privateError.message}` });
  }

  const settings = Object.fromEntries((privateRows ?? []).map((r) => [r.source_id, r]));

  // Run state, so the screen can answer "is anything actually happening?".
  // Without this the page could show `crawlEnabled: true` while nothing had run
  // for hours, which reads as "it is crawling" and is not.
  const { data: recentRuns } = await db
    .from('part_ingest_runs')
    .select('source_id, phase, status, started_at, finished_at, requests_made, records_written, abort_reason')
    .order('started_at', { ascending: false })
    .limit(60);

  const runsBySource = new Map<string, (typeof recentRuns extends (infer R)[] | null ? R : never)[]>();
  for (const run of recentRuns ?? []) {
    const list = runsBySource.get(run.source_id) ?? [];
    if (list.length < 5) list.push(run);
    runsBySource.set(run.source_id, list);
  }

  // COUNTED, NOT FETCHED. This read used to pull every queue row and tally them
  // here, which PostgREST truncates at 1000 — the queue passed that as soon as
  // the second and third sources were seeded, so the screen quietly reported a
  // smaller queue than exists. Same failure as the callout count before it: a
  // client-side tally of a server-capped list.
  const queueBySource = new Map<string, { total: number; remaining: number; blocked: number }>();
  await Promise.all(
    rows.map(async (source) => {
      const base = () =>
        db.from('part_ingest_queue').select('id', { count: 'exact', head: true }).eq('source_id', source.id);
      const [{ count: total }, { count: remaining }, { count: blocked }] = await Promise.all([
        base(),
        // Blocked rows are excluded: they will never be fetched, so counting
        // them as "left" overstates the work remaining for ever.
        base().is('last_fetched_at', null).is('blocked_at', null),
        base().not('blocked_at', 'is', null),
      ]);
      queueBySource.set(source.id, { total: total ?? 0, remaining: remaining ?? 0, blocked: blocked ?? 0 });
    })
  );

  // head:true so these are COUNT queries, not row fetches — the largest of them
  // will be counting five figures of parts once Somerford is imported.
  //
  // A FAILED COUNT MUST NOT RENDER AS ZERO. On this screen a zero reads as
  // "declining hides nothing", which is the one wrong answer that makes a
  // destructive action look safe. Supabase returns `count: null` alongside an
  // error, so coercing with `?? 0` turns a broken query into a confident lie.
  // Failures surface as null and the page renders them as unknown instead.
  const counted = await Promise.all(
    rows.map(async (source) => {
      const direct = await Promise.all(
        DIRECT_COUNTS.map(async ([table]) => {
          const { count, error: countError } = await db
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('source_id', source.id);
          if (countError) {
            console.error(`[admin/parts] count failed for ${table} (source ${source.slug}): ${countError.message}`);
            return null;
          }
          return count ?? 0;
        })
      );

      // Records the refresh has retired. Public reads filter these out, so this
      // is the difference between what the source contributed and what it still
      // contributes — the number that says whether the refresh is working.
      const { count: retired, error: retiredError } = await db
        .from('part_source_records')
        .select('id', { count: 'exact', head: true })
        .eq('source_id', source.id)
        .eq('is_current', false);
      if (retiredError) {
        console.error(`[admin/parts] retired count failed (source ${source.slug}): ${retiredError.message}`);
      }

      // Callouts reach their source through the parent diagram, so this one
      // needs the embed rather than a plain column filter.
      const { count: callouts, error: calloutError } = await db
        .from('part_diagram_callouts')
        .select('id, part_diagrams!inner(source_id)', { count: 'exact', head: true })
        .eq('part_diagrams.source_id', source.id);
      if (calloutError) {
        console.error(`[admin/parts] callout count failed (source ${source.slug}): ${calloutError.message}`);
      }

      // Named rather than a dynamic Record: an index signature makes every read
      // `number | null | undefined`, which hides the difference between "the
      // count failed" and "that key was never set" — the exact distinction this
      // whole change exists to preserve.
      const counts: SourceCounts = {
        parts: direct[0] ?? null,
        diagrams: direct[1] ?? null,
        applicability: direct[2] ?? null,
        supersessions: direct[3] ?? null,
        kitContents: direct[4] ?? null,
        sourceRecords: direct[5] ?? null,
        retiredRecords: retiredError ? null : (retired ?? 0),
        callouts: calloutError ? null : (callouts ?? 0),
        publicRows: null,
      };

      // What a decline would actually hide from the public archive. Deliberately
      // excludes source_records, which is service-role only and never public.
      //
      // Null if ANY component failed: a partial total is worse than no total,
      // because it looks authoritative. The page shows "unknown" and says the
      // figure could not be read.
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
        counts,
        queue: queueBySource.get(source.id) ?? { total: 0, remaining: 0, blocked: 0 },
        runInFlight: (runsBySource.get(source.id) ?? []).some((r) => r.status === 'running'),
        lastRun: (runsBySource.get(source.id) ?? [])[0]
          ? {
              phase: (runsBySource.get(source.id) ?? [])[0]!.phase,
              status: (runsBySource.get(source.id) ?? [])[0]!.status,
              startedAt: (runsBySource.get(source.id) ?? [])[0]!.started_at,
              finishedAt: (runsBySource.get(source.id) ?? [])[0]!.finished_at,
              requestsMade: (runsBySource.get(source.id) ?? [])[0]!.requests_made,
              recordsWritten: (runsBySource.get(source.id) ?? [])[0]!.records_written,
              abortReason: (runsBySource.get(source.id) ?? [])[0]!.abort_reason,
            }
          : null,
      };
    })
  );

  return { sources: counted };
});

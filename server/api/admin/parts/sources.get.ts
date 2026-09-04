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
  publicRows: number | null;
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

  const { data: privateRows, error: privateError } = await db
    .from('part_source_private')
    .select(
      'source_id, licence_note, licence_changed_at, licence_changed_by, contact_email, crawl_enabled, max_requests_per_run, max_requests_per_day, min_request_interval_ms, max_change_ratio'
    );

  if (privateError) {
    throw createError({ statusCode: 500, statusMessage: `Could not read source settings: ${privateError.message}` });
  }

  const settings = Object.fromEntries((privateRows ?? []).map((r) => [r.source_id, r]));

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
        counts,
      };
    })
  );

  return { sources: counted };
});

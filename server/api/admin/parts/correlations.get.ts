/**
 * GET /api/admin/parts/correlations  (admin — the correlation review queue)
 *
 * Moss Motors publishes only its own catalogue numbers. Its `114-403` means
 * nothing outside their catalogue and will never match a factory number however
 * long we wait, so its records arrive attached to nothing. This queue is where a
 * human decides what they attach TO.
 *
 * NOTHING HERE IS PUBLIC AND NOTHING HERE IS TRUE YET. A proposal names a part
 * we are not willing to say a retailer stocks; `part_number_correlations` has no
 * public policy for exactly that reason. Approving is what writes
 * `part_source_records.part_id`, and that is what puts a buy link on a factory
 * part's page.
 *
 * THE SCREEN SHOWS THE EVIDENCE, NOT THE SCORE. A reviewer asked to trust a
 * number cannot catch the case this pipeline exists for: asked to place "FUEL
 * CAP, locking", the archive offers a locking vented cap and a locking non-vented
 * one, and the descriptions are near-identical. What separates them is the
 * qualifiers each side stated, so those are what the row renders — the score is
 * a sort order, not an argument.
 *
 * Service role, because `part_number_correlations`, `part_source_records` and
 * `part_source_private` carry no grant for any browser role.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/** What the scorer recorded about how it arrived at a number. */
interface Signals {
  similarity?: number;
  listed_as?: string;
  candidate?: string;
  candidate_number?: string;
  qualifiers_listed?: string[];
  qualifiers_candidate?: string[];
  qualifiers_agreed?: number;
  runner_up_score?: number;
  scored_at?: string;
}

export interface CorrelationRow {
  id: string;
  confidence: number;
  /** confidence minus the runner-up's. A tie is not a match. */
  separation: number;
  status: string;
  autoApproved: boolean;
  /** What the retailer calls it, and its own catalogue number. */
  listedAs: string | null;
  listedNumber: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  /** The factory part being proposed. */
  partNumber: string | null;
  partDescription: string | null;
  partSlug: string | null;
  /** The evidence, so the reviewer decides on facts rather than on a score. */
  similarity: number | null;
  qualifiersListed: string[];
  qualifiersCandidate: string[];
  qualifiersAgreed: number;
  runnerUpScore: number | null;
}

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const query = getQuery(event);

  const status = typeof query.status === 'string' ? query.status : 'proposed';
  if (!['proposed', 'approved', 'rejected', 'superseded'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown status' });
  }
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(query.limit ?? '50'), 10) || 50));

  const db = getServiceClient();

  const { data, error } = await db
    .from('part_number_correlations')
    .select(
      `id, confidence, separation, status, auto_approved, signals,
       part_source_records!inner ( part_number_as_listed, title, source_url,
         part_sources!inner ( name ) ),
       parts!inner ( part_number_display, part_number_norm, description )`
    )
    .eq('status', status)
    // Hardest cases first. A proposal whose runner-up scored almost as well is
    // the one most likely to be wrong and the one a reviewer should see while
    // they are still paying attention — not buried under fifty easy ones.
    .order('separation', { ascending: true })
    .order('confidence', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[admin/parts/correlations] read failed:', error.message);
    throw createError({ statusCode: 502, statusMessage: 'Could not read the correlation queue' });
  }

  const rows: CorrelationRow[] = (data ?? []).map((row) => {
    const record = row.part_source_records as unknown as {
      part_number_as_listed: string | null;
      title: string | null;
      source_url: string | null;
      part_sources: { name: string | null } | null;
    };
    const part = row.parts as unknown as {
      part_number_display: string | null;
      part_number_norm: string | null;
      description: string | null;
    };
    const signals = (row.signals ?? {}) as Signals;

    return {
      id: row.id as string,
      confidence: Number(row.confidence),
      separation: Number(row.separation),
      status: row.status as string,
      autoApproved: Boolean(row.auto_approved),
      listedAs: record?.title ?? null,
      listedNumber: record?.part_number_as_listed ?? null,
      sourceUrl: record?.source_url ?? null,
      sourceName: record?.part_sources?.name ?? null,
      partNumber: part?.part_number_display ?? null,
      partDescription: part?.description ?? null,
      partSlug: part?.part_number_norm ?? null,
      similarity: typeof signals.similarity === 'number' ? signals.similarity : null,
      qualifiersListed: signals.qualifiers_listed ?? [],
      qualifiersCandidate: signals.qualifiers_candidate ?? [],
      qualifiersAgreed: signals.qualifiers_agreed ?? 0,
      runnerUpScore: typeof signals.runner_up_score === 'number' ? signals.runner_up_score : null,
    };
  });

  // Counts per status, so the screen can say how much is waiting without
  // fetching it. Null rather than zero on failure: "nothing to review" is a
  // conclusion, and a failed count must not be able to state it.
  const counts: Record<string, number | null> = {};
  for (const s of ['proposed', 'approved', 'rejected'] as const) {
    const { count, error: countError } = await db
      .from('part_number_correlations')
      .select('id', { count: 'exact', head: true })
      .eq('status', s);
    counts[s] = countError ? null : (count ?? 0);
  }

  return { rows, counts, status };
});

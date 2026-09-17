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
 * ONE CARD PER RECORD, UP TO THREE CANDIDATES. The scorer proposes the top three
 * factory parts for a listing, so the reviewer's job is "confirm the best one or
 * pick another", not "search for it". Rows are grouped by the retailer record
 * here, in two reads: the first picks which records lead (see the ordering
 * below), the second fetches every open proposal for exactly those records, so
 * a record's alternatives are never cut off by the page limit.
 *
 * TWO SCORES, AND WHICH ONE LEADS. `confidence` is trigram similarity: 0.95
 * means the names are 95% alike, not that the match is 95% likely to be right.
 * `modelConfidence` is a second-stage P(same part) written by a Supabase edge
 * function, and it IS a probability. When a record has one, the queue sorts by
 * it; until then it falls back to the trigram order (hardest first, by
 * separation). Neither number is an argument: the card still leads with what
 * each side said about locking, venting, body style, polarity, because that is
 * the comparison a reviewer is actually making.
 *
 * Service role, because `part_number_correlations`, `part_source_records` and
 * `part_source_private` carry no grant for any browser role.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

/** What the trigram scorer recorded about how it arrived at a number. */
interface Signals {
  rank?: number;
  similarity?: number;
  listed_as?: string;
  candidate?: string;
  candidate_number?: string;
  qualifiers_listed?: string[];
  qualifiers_candidate?: string[];
  qualifiers_agreed?: number;
  runner_up_score?: number;
  scored_at?: string;
  /** What the second stage recorded, when it has run. */
  model?: {
    levels?: { different?: number; related?: number; same?: number };
    qualifiers?: Record<string, number>;
    none_fit?: number;
  };
}

export interface CorrelationRow {
  id: string;
  confidence: number;
  /** confidence minus the runner-up's. A tie is not a match. */
  separation: number;
  status: string;
  autoApproved: boolean;
  /** 1 is the trigram scorer's own pick; 2 and 3 are its alternatives. */
  rank: number | null;
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
  /** Second stage: P(same part), or null until the model has looked. */
  modelConfidence: number | null;
  modelSeparation: number | null;
  modelVersion: string | null;
  /** P(different) / P(related) / P(same), when scored. */
  modelLevels: { different: number; related: number; same: number } | null;
  /** Per qualifier dimension, P(both sides agree). */
  modelQualifiers: Record<string, number>;
}

export interface CorrelationGroup {
  recordId: string;
  /** What the retailer calls it, and its own catalogue number. */
  listedAs: string | null;
  listedNumber: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  /** P(no candidate is the listed part), from the second stage; null until scored. */
  noneFit: number | null;
  /** Best first: by modelConfidence when present, else by rank. */
  candidates: CorrelationRow[];
}

const STATUSES = ['proposed', 'approved', 'rejected', 'superseded', 'closed'] as const;
type Status = (typeof STATUSES)[number];

const ROW_SELECT = `id, source_record_id, confidence, separation, status, auto_approved, signals,
  model_confidence, model_separation, model_version, model_scored_at,
  part_source_records!inner ( part_number_as_listed, title, source_url,
    part_sources!inner ( name ) ),
  parts!inner ( part_number_display, part_number_norm, description )`;

interface RawRow {
  id: string;
  source_record_id: string;
  confidence: number;
  separation: number;
  status: string;
  auto_approved: boolean;
  signals: Signals | null;
  model_confidence: number | null;
  model_separation: number | null;
  model_version: string | null;
  model_scored_at: string | null;
  part_source_records: {
    part_number_as_listed: string | null;
    title: string | null;
    source_url: string | null;
    part_sources: { name: string | null } | null;
  } | null;
  parts: {
    part_number_display: string | null;
    part_number_norm: string | null;
    description: string | null;
  } | null;
}

function toRow(raw: RawRow): CorrelationRow {
  const signals = raw.signals ?? {};
  const levels = signals.model?.levels;
  return {
    id: raw.id,
    confidence: Number(raw.confidence),
    separation: Number(raw.separation),
    status: raw.status,
    autoApproved: Boolean(raw.auto_approved),
    rank: typeof signals.rank === 'number' ? signals.rank : null,
    partNumber: raw.parts?.part_number_display ?? null,
    partDescription: raw.parts?.description ?? null,
    partSlug: raw.parts?.part_number_norm ?? null,
    similarity: typeof signals.similarity === 'number' ? signals.similarity : null,
    qualifiersListed: signals.qualifiers_listed ?? [],
    qualifiersCandidate: signals.qualifiers_candidate ?? [],
    qualifiersAgreed: signals.qualifiers_agreed ?? 0,
    runnerUpScore: typeof signals.runner_up_score === 'number' ? signals.runner_up_score : null,
    modelConfidence: raw.model_confidence === null ? null : Number(raw.model_confidence),
    modelSeparation: raw.model_separation === null ? null : Number(raw.model_separation),
    modelVersion: raw.model_version,
    modelLevels:
      levels && typeof levels.same === 'number'
        ? { different: levels.different ?? 0, related: levels.related ?? 0, same: levels.same }
        : null,
    modelQualifiers: signals.model?.qualifiers ?? {},
  };
}

/** Best candidate first: the model's number when it exists, the scorer's rank otherwise. */
function byBest(a: CorrelationRow, b: CorrelationRow): number {
  if (a.modelConfidence !== null || b.modelConfidence !== null) {
    return (b.modelConfidence ?? -1) - (a.modelConfidence ?? -1);
  }
  return (a.rank ?? 99) - (b.rank ?? 99) || b.confidence - a.confidence;
}

type Db = ReturnType<typeof getServiceClient>;

/**
 * Counts per tab, so the screen can say how much is waiting without fetching
 * it. Null rather than zero on failure: "nothing to review" is a conclusion,
 * and a failed count must not be able to state it. Independent, so they run
 * together. Every response carries all of them, whichever tab asked, or the
 * badges on the other tabs would blank when the reviewer switches.
 */
async function loadCounts(db: Db): Promise<Record<string, number | null>> {
  const head = { count: 'exact' as const, head: true };
  const [proposed, approved, rejected, closed, unscored] = await Promise.all([
    db.from('part_number_correlations').select('id', head).eq('status', 'proposed'),
    db.from('part_number_correlations').select('id', head).eq('status', 'approved'),
    db.from('part_number_correlations').select('id', head).eq('status', 'rejected'),
    db
      .from('part_source_records')
      .select('id', head)
      .eq('correlation_state', 'no_factory_equivalent')
      .eq('is_current', true),
    db.from('part_number_correlations').select('id', head).eq('status', 'proposed').is('model_scored_at', null),
  ]);
  const n = (r: { count: number | null; error: unknown }) => (r.error ? null : (r.count ?? 0));
  return {
    proposed: n(proposed),
    approved: n(approved),
    rejected: n(rejected),
    closed: n(closed),
    // How far the second stage has got, so the screen can say "unscored"
    // rather than leave a missing number to be read as zero.
    unscored: n(unscored),
  };
}

/** PostgREST `in()` lists ride in the URL; ~100 uuids is a safe request line. */
const IN_CHUNK = 100;

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const query = getQuery(event);

  const status = (typeof query.status === 'string' ? query.status : 'proposed') as Status;
  if (!STATUSES.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown status' });
  }
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(query.limit ?? '50'), 10) || 50));

  const db = getServiceClient();

  // `closed` is not a correlation status but a record state: a human said the
  // listing has no factory equivalent. Rendered as a group with no candidates so
  // the same card can offer "reopen".
  if (status === 'closed') {
    const { data, error } = await db
      .from('part_source_records')
      .select('id, title, part_number_as_listed, source_url, part_sources ( name )')
      .eq('correlation_state', 'no_factory_equivalent')
      // A retired record is a link to a 404 and nothing to reopen.
      .eq('is_current', true)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[admin/parts/correlations] closed read failed:', error.message);
      throw createError({ statusCode: 502, statusMessage: 'Could not read the closed records' });
    }
    const groups: CorrelationGroup[] = (
      (data ?? []) as unknown as {
        id: string;
        title: string | null;
        part_number_as_listed: string | null;
        source_url: string | null;
        part_sources: { name: string | null } | null;
      }[]
    ).map((r) => ({
      recordId: r.id,
      listedAs: r.title,
      listedNumber: r.part_number_as_listed,
      sourceUrl: r.source_url,
      sourceName: r.part_sources?.name ?? null,
      noneFit: null,
      candidates: [],
    }));
    return { groups, counts: await loadCounts(db), status };
  }

  // Read 1: which records lead. Model-scored rows first, best P(same) first;
  // unscored rows after them, hardest first (a near-tie is the proposal most
  // likely to be wrong). Over-fetched three-fold because a record can own up to
  // three rows and only its first appearance decides its place.
  const { data: lead, error: leadError } = await db
    .from('part_number_correlations')
    .select('source_record_id, model_confidence, separation')
    .eq('status', status)
    .order('model_confidence', { ascending: false, nullsFirst: false })
    .order('separation', { ascending: true })
    .order('confidence', { ascending: false })
    .limit(limit * 3);

  if (leadError) {
    console.error('[admin/parts/correlations] lead read failed:', leadError.message);
    throw createError({ statusCode: 502, statusMessage: 'Could not read the correlation queue' });
  }

  const recordIds: string[] = [];
  const seen = new Set<string>();
  for (const row of (lead ?? []) as { source_record_id: string }[]) {
    if (seen.has(row.source_record_id)) continue;
    seen.add(row.source_record_id);
    recordIds.push(row.source_record_id);
    if (recordIds.length >= limit) break;
  }

  // Read 2: every row of exactly those records, so no alternative is cut off.
  // Chunked, because the id list travels in the query string and 200 uuids
  // overrun an 8 KB request line at the gateway.
  const raws: RawRow[] = [];
  for (let i = 0; i < recordIds.length; i += IN_CHUNK) {
    const { data, error } = await db
      .from('part_number_correlations')
      .select(ROW_SELECT)
      .eq('status', status)
      .in('source_record_id', recordIds.slice(i, i + IN_CHUNK));
    if (error) {
      console.error('[admin/parts/correlations] read failed:', error.message);
      throw createError({ statusCode: 502, statusMessage: 'Could not read the correlation queue' });
    }
    raws.push(...((data ?? []) as unknown as RawRow[]));
  }

  const byRecord = new Map<string, CorrelationGroup>();
  for (const raw of raws) {
    let group = byRecord.get(raw.source_record_id);
    if (!group) {
      const record = raw.part_source_records;
      group = {
        recordId: raw.source_record_id,
        listedAs: record?.title ?? null,
        listedNumber: record?.part_number_as_listed ?? null,
        sourceUrl: record?.source_url ?? null,
        sourceName: record?.part_sources?.name ?? null,
        noneFit: null,
        candidates: [],
      };
      byRecord.set(raw.source_record_id, group);
    }
    group.candidates.push(toRow(raw));
    const noneFit = raw.signals?.model?.none_fit;
    if (typeof noneFit === 'number') group.noneFit = noneFit;
  }

  const groups: CorrelationGroup[] = recordIds
    .map((id) => byRecord.get(id))
    .filter((g): g is CorrelationGroup => g !== undefined)
    .map((g) => ({ ...g, candidates: [...g.candidates].sort(byBest) }));

  const counts = await loadCounts(db);

  return { groups, counts, status };
});

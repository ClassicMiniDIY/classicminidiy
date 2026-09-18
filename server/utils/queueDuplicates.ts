/**
 * The duplicate hint for a new colour or wheel submission: which existing rows
 * it most likely duplicates, read once by TypeSafe and stored on the
 * submission (`submission_queue.duplicate_hint`, via service-only RPCs in the
 * private repo). The admin list route fills it lazily; the queue card shows
 * it; the approve route does exactly what the admin tells it, hint or not.
 *
 * Candidates come from Postgres (`find_submission_duplicates`: exact code
 * first, then trigram name similarity). The model only scores the pairs code
 * found; it never proposes a row of its own. Off unless
 * `TYPESAFE_QUEUE_MODE` is `on`. Design: the private repo's phase 5 doc.
 */
import type { H3Event } from 'h3';
import { askTypeSafe, score, typesafeConfigured } from './typesafe';
import { serverRuntimeConfig } from './runtimeConfig';
import { getServiceClient } from './supabase';
import type { Json } from '~~/types/database';

export const DUPLICATE_TOP_MIN = 0.6;
const DUPLICATE_CEILING_MS = 4000;

export type DuplicateLevel = 'different' | 'variant' | 'same';

export interface DuplicateCandidate {
  id: string;
  name: string;
  code: string | null;
  level: DuplicateLevel;
  p_same: number;
  p_variant: number;
  p_different: number;
}

export interface DuplicateHint {
  candidates: DuplicateCandidate[];
  top: { id: string; level: DuplicateLevel; p: number } | null;
}

export interface DuplicateSource {
  id: string;
  targetType: string;
  data: Record<string, unknown>;
}

interface CandidateRow {
  id: string;
  name: string;
  code: string | null;
  detail: string | null;
  exact_code: boolean;
  sim: number;
}

export function queueDuplicatesEnabled(event: H3Event): boolean {
  const raw = (serverRuntimeConfig(event).TYPESAFE_QUEUE_MODE as string) || '';
  return raw.trim().toLowerCase() === 'on' && typesafeConfigured(event);
}

function submissionSummary(targetType: string, data: Record<string, unknown>): Record<string, string> {
  const pick = (keys: string[]) => {
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = data[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = String(v).slice(0, 120);
    }
    return out;
  };
  return targetType === 'color'
    ? pick(['name', 'code', 'shortCode', 'ditzlerPpgCode', 'duluxCode', 'years', 'hexValue'])
    : pick(['name', 'type', 'size', 'width', 'offset', 'boltPattern', 'manufacturer', 'notes']);
}

/** Score levels, index order: 0 different, 1 variant, 2 same. */
const LEVEL_NAMES: readonly DuplicateLevel[] = ['different', 'variant', 'same'];
const LEVEL_TEXT = [
  'A different {noun}: another colour, another wheel, or the same name for a different thing.',
  'A variant or re-issue of the same {noun}: the same colour under a later code, or the same wheel in another size or width.',
  'The same {noun} the submission describes, already in the archive under this or another code or spelling.',
] as const;

export function buildDuplicateRequest(targetType: string, data: Record<string, unknown>, rows: CandidateRow[]) {
  const noun = targetType === 'color' ? 'paint colour' : 'wheel';
  const levels = LEVEL_TEXT.map((v) => v.replaceAll('{noun}', noun)) as unknown as [string, string, string];
  const questions: Record<string, ReturnType<typeof score>> = {};
  rows.forEach((row, i) => {
    questions[`c${i}`] = score(
      `Compare \`submission\` with \`candidates[${i}]\`. Is the candidate the same classic Mini ${noun} the submission describes? Codes that match exactly are strong evidence; a name alone is not, because the archive already holds several ${noun}s with one name and different codes.`,
      levels
    );
  });
  return {
    state: {
      submission: submissionSummary(targetType, data),
      candidates: rows.map((r) => ({ name: r.name, code: r.code ?? '', detail: r.detail ?? '' })),
    },
    questions,
  };
}

/** Probabilities come back keyed by level index ("0", "1", "2"); name them. */
function byName(probabilities: Record<string, number>): Record<DuplicateLevel, number> {
  const r3 = (i: number) => Math.round((probabilities[String(i)] ?? 0) * 1000) / 1000;
  return { different: r3(0), variant: r3(1), same: r3(2) };
}

function topLevel(p: Record<DuplicateLevel, number>): DuplicateLevel {
  let best: DuplicateLevel = 'different';
  for (const level of LEVEL_NAMES) if (p[level] > p[best]) best = level;
  return best;
}

/**
 * Compute and store the hint for one pending submission. Returns the hint, or
 * null when there is nothing to say (no candidates, off, failed); never
 * throws. A null leaves the column empty so the next list load tries again.
 */
export async function hintSubmissionDuplicates(event: H3Event, sub: DuplicateSource): Promise<DuplicateHint | null> {
  if (!queueDuplicatesEnabled(event)) return null;
  if (sub.targetType !== 'color' && sub.targetType !== 'wheel') return null;
  const supabase = getServiceClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DUPLICATE_CEILING_MS);
  try {
    const { data: rows, error } = await supabase.rpc('find_submission_duplicates', {
      p_submission_id: sub.id,
      p_limit: 5,
    });
    if (error) {
      console.warn('[queue] find_submission_duplicates failed:', error.message);
      return null;
    }
    const candidates = (rows ?? []) as CandidateRow[];
    if (candidates.length === 0) {
      // Nothing similar exists: store that so the card can say so without a
      // second lookup, and the row is not re-read on every load.
      await writeHint(sub.id, { candidates: [], top: null }, null);
      return { candidates: [], top: null };
    }

    const { state, questions } = buildDuplicateRequest(sub.targetType, sub.data, candidates);
    const answer = await askTypeSafe(event, state, questions, {
      caller: 'queue-duplicates',
      signal: controller.signal,
      retry: { maxRetries: 0 },
    });

    const scored: DuplicateCandidate[] = candidates.map((row, i) => {
      const a = answer.answers[`c${i}`] as { probabilities?: Record<string, number> } | undefined;
      const p = byName(a?.probabilities ?? {});
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        level: topLevel(p),
        p_same: p.same,
        p_variant: p.variant,
        p_different: p.different,
      };
    });
    scored.sort((a, b) => b.p_same - a.p_same);
    const first = scored[0];
    const top =
      first && first.level !== 'different' && Math.max(first.p_same, first.p_variant) >= DUPLICATE_TOP_MIN
        ? { id: first.id, level: first.level, p: first.level === 'same' ? first.p_same : first.p_variant }
        : null;
    const hint: DuplicateHint = { candidates: scored, top };
    await writeHint(sub.id, hint, answer.model);
    return hint;
  } catch (e) {
    if (!controller.signal.aborted) {
      console.warn('[queue] duplicate hint failed:', e instanceof Error ? e.message : String(e));
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function writeHint(id: string, hint: DuplicateHint, model: string | null): Promise<void> {
  const { error } = await getServiceClient().rpc('record_submission_duplicate_hint', {
    p_submission_id: id,
    p_hint: hint as unknown as Json,
    // `none`: no model was asked because code found no candidate.
    p_version: model ?? 'none',
  });
  if (error) console.warn('[queue] record_submission_duplicate_hint failed:', error.message);
}

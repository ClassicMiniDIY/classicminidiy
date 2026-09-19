/**
 * The submission review card: one TypeSafe read on every user submission
 * (exchange listing, find, wanted post, archive submission, 3D model),
 * stored on the row as `review_hint` and shown on the admin item.
 *
 * Rules, from the private repo's TypeSafe phase 6 doc:
 *   - A card is a hint. `flag` means "look at this"; it never rejects. `auto`
 *     is only ever the result of the surface's OWN approval path running,
 *     which the calling route does, with the gate mode `auto` and every
 *     condition in `decideReview()` met.
 *   - State is the submitted text plus the submitter's trust level as a
 *     word. Never a name, an email or an id. Numbers, years and codes are
 *     compared in code and passed as findings, not asked.
 *   - `record_review_hint()` in the private repo is the only writer.
 *   - The gate per surface is `platform_settings.review_gate_<surface>`
 *     (off | hint | auto), thresholds in `review_gate_thresholds`; both are
 *     cached a minute per isolate and a failed read keeps the last values.
 */
import type { H3Event } from 'h3';
import { askTypeSafe, choice, noul, score, typesafeConfigured } from '../typesafe';
import { getServiceClient } from '../supabase';
import type { Json } from '~~/types/database';

export const REVIEW_SURFACES = ['listings', 'finds', 'wanted', 'archive', 'models'] as const;
export type ReviewSurface = (typeof REVIEW_SURFACES)[number];
export type ReviewGate = 'off' | 'hint' | 'auto';
export type ReviewDecision = 'clear' | 'flag' | 'auto';

export interface ReviewThresholds {
  /** Every risk Noul must be under this to clear. */
  risk: number;
  /** Quality level (0-2) at or above this to clear. */
  quality: number;
  /** Lowest trust level `auto` accepts. */
  trust: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
}
export const DEFAULT_REVIEW_THRESHOLDS: ReviewThresholds = { risk: 0.3, quality: 2, trust: 'trusted' };
const TRUST_ORDER = ['new', 'contributor', 'trusted', 'moderator', 'admin'] as const;

const CEILING_MS = 4000;
const TEXT_CHARS = 2500;
const PAGE_CHARS = 3000;

export interface ReviewInput {
  title: string;
  description: string;
  /** The category the submitter chose, as its slug. */
  category: string | null;
  /** The surface's category list: slug → one-line description. */
  categories: Record<string, string>;
  /** Structured fields worth reading, already rendered to short strings. */
  fields?: Record<string, string>;
  /** Findings code already made (year out of range, format failures). Text only. */
  findings?: string[];
  /** The submitter's trust level. */
  trust: ReviewThresholds['trust'] | null;
  /** Finds only: the parsed page text. */
  pageText?: string;
  /** Finds only: code-found possible duplicates, id → label. */
  duplicateCandidates?: Record<string, string>;
  /** Archive only: the document type the submitter chose, or the target type. */
  archiveType?: string;
}

function clip(s: string | null | undefined, n: number): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

const SURFACE_NOUN: Record<ReviewSurface, string> = {
  listings: 'a marketplace listing (a car, an engine or parts for sale)',
  finds: 'a "find": a link to a classic Mini listing on another site, submitted for the community to see',
  wanted: 'a wanted post (a member looking for a car, an engine or a part)',
  archive: 'an archive contribution (a paint colour, a wheel, a registry entry or a reference document)',
  models: 'a 3D-printable model listing',
};

export function buildReviewRequest(surface: ReviewSurface, input: ReviewInput) {
  const categoryOptions: Record<string, string | null> = {};
  for (const [slug, text] of Object.entries(input.categories)) categoryOptions[slug] = text;
  if (!Object.keys(categoryOptions).length) categoryOptions.other = 'None of the listed categories.';

  const state: Record<string, unknown> = {
    context: `A member submitted ${SURFACE_NOUN[surface]} to a classic Mini (1959-2000) enthusiast site. The submitter's standing on the site is \`trust\`.`,
    title: clip(input.title, 300),
    description: clip(input.description, TEXT_CHARS),
    category: input.category ?? '',
    fields: input.fields ?? {},
    findings: input.findings ?? [],
    trust: input.trust ?? 'unknown',
  };
  if (surface === 'finds') {
    state.page_text = clip(input.pageText, PAGE_CHARS);
    state.duplicate_candidates = input.duplicateCandidates ?? {};
  }
  if (surface === 'archive') state.archive_type = input.archiveType ?? '';

  const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof choice> | ReturnType<typeof score>> = {
    about_mini: noul(
      'Is this submission about a classic Mini (1959-2000), its parts, tools, history or care, rather than the modern BMW MINI, another car, or something unrelated?',
      {
        true: 'A classic Mini, or something on or for one, is what it is about.',
        false: 'The BMW MINI, another car, or nothing to do with cars.',
      }
    ),
    prohibited: noul(
      'Does the submission offer or ask for something the site does not allow: weapons, replica or counterfeit branded parts presented as genuine, goods that read as stolen (no provenance, "no questions"), adult content, or services unrelated to cars?',
      {
        true: 'It offers, asks for, or points at something prohibited.',
        false: 'Ordinary cars, parts, documents or requests.',
      }
    ),
    scam: noul(
      'Does the text carry a scam pattern: asks for a deposit or payment before viewing, pushes to email, WhatsApp or another site, mentions an agent or shipper who will collect, uses urgency, or prices something far below what the description implies?',
      {
        true: 'One or more of those patterns is present.',
        false: 'A normal description with no such pattern.',
      }
    ),
    quality: score(
      'How complete and specific is the submission for someone who wants to act on it (buy, contact, use the document)?',
      [
        'A stub or a keyword pile: a few words, no real description, or text that is not about one thing.',
        'Usable but thin: the item is clear but key details a buyer or reader would ask for are missing.',
        'Complete and specific: what it is, its condition or content, and enough detail to act on.',
      ]
    ),
    category: choice(
      'Which entry in `categories` fits this submission best, judged by the title and description rather than the submitted `category`?',
      categoryOptions
    ),
    lead: choice('If a moderator reads one line about this submission, which is it?', {
      none: 'Nothing to say: it reads as a normal, well-formed submission.',
      wrong_place: 'It belongs in a different category or a different part of the site.',
      needs_detail: 'It is genuine but too thin to publish as is.',
      looks_off: 'Something in it should be checked before publishing: a claim, a pattern, a mismatch.',
    }),
  };

  if (surface === 'listings') {
    questions.condition_matches = noul(
      'Do the stated condition and the description agree? (A part called "new" with a description of rust or wear does not.)',
      {
        true: 'The description supports the stated condition, or no condition is stated.',
        false: 'The description contradicts the stated condition.',
      }
    );
    questions.title_is_item = noul(
      'Is the title the item itself, rather than a list of search words, a slogan or a question?',
      {
        true: 'The title names the thing for sale.',
        false: 'The title is a keyword pile, a slogan, or not the item.',
      }
    );
    questions.vehicle_plausible = noul(
      'Reading `fields` as text, do the year, model, engine and other details describe a car or part that could exist as stated? (Ignore whether a number is in range; code checks ranges.)',
      {
        true: 'The details fit together as a real classic Mini or part.',
        false: 'The details contradict each other or describe something that could not exist as stated.',
      }
    );
  }
  if (surface === 'finds') {
    questions.is_listing_page = noul(
      'Does `page_text` read as one real, current listing for one item, rather than a search or category page, a sold or expired notice, or a page with no listing on it?',
      {
        true: 'One live listing for one item.',
        false: 'A search or category page, an ended listing, or not a listing at all.',
      }
    );
    const dupOptions: Record<string, string | null> = { none: 'None of the candidates is the same listing.' };
    for (const [id, label] of Object.entries(input.duplicateCandidates ?? {})) dupOptions[id] = label;
    questions.duplicate = choice(
      'Is this find the same listing as one of `duplicate_candidates` (the same car or part on the same site), or `none`?',
      dupOptions
    );
  }
  if (surface === 'archive') {
    questions.type_fits = noul('Does `archive_type` match what the title and description describe?', {
      true: 'The chosen type is what the contribution is.',
      false: 'The contribution is a different kind of thing than the chosen type.',
    });
    questions.same_thing = noul('Do the title and the description describe one and the same thing?', {
      true: 'Yes, one thing.',
      false: 'They describe different things, or the description is about something else.',
    });
    questions.looks_real = noul(
      'Does the free text read as a real contribution about a real colour, wheel, car or document, rather than a test entry, placeholder text or nonsense?',
      {
        true: 'A real contribution.',
        false: 'A test, a placeholder, or nonsense.',
      }
    );
  }

  return { state, questions };
}

export interface ReviewHint {
  scores: Record<string, number>;
  quality: number;
  category: string;
  category_agrees: boolean;
  lead: string;
  reasons: string[];
  findings: string[];
  trust: string;
  gate: ReviewGate;
  duplicate?: string | null;
}

/**
 * Turn answers into the stored hint and the decision. Pure; the gate's
 * `auto` is decided here but performed by the caller.
 */
export function decideReview(
  surface: ReviewSurface,
  input: ReviewInput,
  answers: Record<string, { noul?: number; choice?: string; score?: number; probabilities?: Record<string, number> }>,
  gate: ReviewGate,
  thresholds: ReviewThresholds = DEFAULT_REVIEW_THRESHOLDS
): { hint: ReviewHint; decision: 'clear' | 'flag'; autoEligible: boolean } {
  const r3 = (n: unknown) => Math.round(Number(n ?? 0) * 1000) / 1000;
  const scores: Record<string, number> = {};
  for (const [id, a] of Object.entries(answers)) if (typeof a.noul === 'number') scores[id] = r3(a.noul);

  const reasons: string[] = [];
  const risk = (id: string, label: string, invert = false) => {
    const p = scores[id];
    if (p === undefined) return;
    const bad = invert ? 1 - p : p;
    if (bad >= thresholds.risk) reasons.push(`${label} (${bad.toFixed(2)})`);
  };
  risk('about_mini', 'may not be about a classic Mini', true);
  risk('prohibited', 'possibly prohibited');
  risk('scam', 'scam pattern');
  risk('condition_matches', 'condition contradicts description', true);
  risk('title_is_item', 'title is not the item', true);
  risk('vehicle_plausible', 'details do not fit together', true);
  risk('is_listing_page', 'page is not a single live listing', true);
  risk('type_fits', 'type does not match', true);
  risk('same_thing', 'title and description differ', true);
  risk('looks_real', 'reads as a test or placeholder', true);

  const qp = answers.quality?.probabilities ?? {};
  const quality = Number(
    Object.entries(qp)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)[0] ?? 0
  );
  if (quality < thresholds.quality) reasons.push(`quality level ${quality}`);

  const category = String(answers.category?.choice ?? '');
  const categoryAgrees = !input.category || !category || category === 'other' || category === input.category;
  if (!categoryAgrees) reasons.push(`reads as "${category}", filed as "${input.category}"`);

  const lead = String(answers.lead?.choice ?? 'none');
  const duplicate = surface === 'finds' ? String(answers.duplicate?.choice ?? 'none') : undefined;
  if (duplicate && duplicate !== 'none' && input.duplicateCandidates?.[duplicate]) {
    reasons.push(`possible duplicate of ${input.duplicateCandidates[duplicate]}`);
  }
  for (const f of input.findings ?? []) reasons.push(f);

  const decision: 'clear' | 'flag' = reasons.length ? 'flag' : 'clear';
  const trustOk = input.trust !== null && TRUST_ORDER.indexOf(input.trust) >= TRUST_ORDER.indexOf(thresholds.trust);
  const autoEligible = gate === 'auto' && decision === 'clear' && trustOk && surface !== 'models';

  return {
    hint: {
      scores,
      quality,
      category,
      category_agrees: categoryAgrees,
      lead,
      reasons,
      findings: input.findings ?? [],
      trust: input.trust ?? 'unknown',
      gate,
      ...(duplicate !== undefined ? { duplicate: duplicate === 'none' ? null : duplicate } : {}),
    },
    decision,
    autoEligible,
  };
}

// -- settings ---------------------------------------------------------------
const TTL_MS = 60_000;
let cache: { at: number; gates: Record<string, ReviewGate>; thresholds: ReviewThresholds } | null = null;

export function parseGate(raw: unknown, surface: ReviewSurface): ReviewGate {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'auto') return surface === 'models' ? 'hint' : 'auto';
  return v === 'hint' ? 'hint' : 'off';
}
export function parseReviewThresholds(raw: unknown): ReviewThresholds {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  const trust = (TRUST_ORDER as readonly string[]).includes(String(o.trust))
    ? (o.trust as ReviewThresholds['trust'])
    : DEFAULT_REVIEW_THRESHOLDS.trust;
  return { risk: num(o.risk, 0.3, 0.05, 1), quality: num(o.quality, 2, 0, 2), trust };
}

export async function loadReviewSettings(): Promise<{
  gates: Record<string, ReviewGate>;
  thresholds: ReviewThresholds;
}> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache;
  try {
    const keys = [...REVIEW_SURFACES.map((s) => `review_gate_${s}`), 'review_gate_thresholds'];
    const { data, error } = await getServiceClient().from('platform_settings').select('key, value').in('key', keys);
    if (error) throw error;
    const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
    const gates: Record<string, ReviewGate> = {};
    for (const s of REVIEW_SURFACES) gates[s] = parseGate(map.get(`review_gate_${s}`), s);
    cache = { at: now, gates, thresholds: parseReviewThresholds(map.get('review_gate_thresholds')) };
  } catch (e) {
    console.warn(
      '[review] settings read failed; keeping the last values for a minute:',
      e instanceof Error ? e.message : String(e)
    );
    cache = cache
      ? { ...cache, at: now }
      : {
          at: now,
          gates: Object.fromEntries(REVIEW_SURFACES.map((s) => [s, 'off' as ReviewGate])),
          thresholds: DEFAULT_REVIEW_THRESHOLDS,
        };
  }
  return cache;
}
export function _resetReviewSettingsCache(): void {
  cache = null;
}

export interface ReviewOutcome {
  gate: ReviewGate;
  decision: ReviewDecision | 'skipped';
  hint: ReviewHint | null;
  /** True when the caller should run the surface's own approval path and then record `auto`. */
  autoEligible: boolean;
  model: string | null;
  durationMs: number;
}

/**
 * Read one submission, store the card, and say whether the caller may
 * auto-approve. Never throws: any failure is `skipped` with no write, so the
 * submission proceeds exactly as it did before the card existed.
 */
export async function reviewSubmission(
  event: H3Event,
  surface: ReviewSurface,
  id: string,
  input: ReviewInput
): Promise<ReviewOutcome> {
  const { gates, thresholds } = await loadReviewSettings();
  const gate = gates[surface] ?? 'off';
  const skipped = (g: ReviewGate): ReviewOutcome => ({
    gate: g,
    decision: 'skipped',
    hint: null,
    autoEligible: false,
    model: null,
    durationMs: 0,
  });
  if (gate === 'off' || !typesafeConfigured(event)) return skipped(gate);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CEILING_MS);
  try {
    const { state, questions } = buildReviewRequest(surface, input);
    const answer = await askTypeSafe(event, state as Parameters<typeof askTypeSafe>[1], questions, {
      caller: `review-${surface}`,
      signal: controller.signal,
      retry: { maxRetries: 0 },
    });
    const { hint, decision, autoEligible } = decideReview(
      surface,
      input,
      answer.answers as unknown as Parameters<typeof decideReview>[2],
      gate,
      thresholds
    );
    await recordReviewHint(surface, id, hint, answer.model, decision);
    return { gate, decision, hint, autoEligible, model: answer.model, durationMs: answer.durationMs };
  } catch (e) {
    console.warn(`[review] ${surface} card failed:`, e instanceof Error ? e.message : String(e));
    return skipped(gate);
  } finally {
    clearTimeout(timer);
  }
}

/** Store the card; `auto` is written by the caller after its approval path ran. */
export async function recordReviewHint(
  surface: ReviewSurface,
  id: string,
  hint: ReviewHint,
  model: string,
  decision: ReviewDecision
): Promise<void> {
  const { error } = await getServiceClient().rpc('record_review_hint', {
    p_surface: surface,
    p_id: id,
    p_hint: hint as unknown as Json,
    p_version: model,
    p_decision: decision,
  });
  if (error) console.warn('[review] record_review_hint failed:', error.message);
}

/** The submitter's trust level, or null when unknown. Read through the service client. */
export async function trustLevelOf(userId: string | null | undefined): Promise<ReviewThresholds['trust'] | null> {
  if (!userId) return null;
  const { data } = await getServiceClient().from('profiles').select('trust_level').eq('id', userId).maybeSingle();
  const t = data?.trust_level as string | undefined;
  return (TRUST_ORDER as readonly string[]).includes(t ?? '') ? (t as ReviewThresholds['trust']) : null;
}

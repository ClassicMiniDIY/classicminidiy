import { requireAdminAuth } from '../../../utils/adminAuth';
import { getServiceClient } from '../../../utils/supabase';
import { REVIEW_SURFACES, loadReviewSettings, type ReviewSurface } from '../../../utils/review/card';
import { reviewFind, reviewListing, reviewModel, reviewWanted } from '../../../utils/review/surfaces';

/**
 * POST /api/admin/review/fill  { surface, ids }
 *
 * Returns the review card for each id, computing it for rows that have none
 * (submitted while the gate was off, or before the card existed). At most
 * five computed per call; the rest come back as they are. A row computed here
 * goes through the same gate as at submit time, so with a surface at `auto`
 * a pending row that clears is approved exactly as it would have been then.
 */
const TABLE: Record<ReviewSurface, string> = {
  listings: 'listings',
  finds: 'external_listings',
  wanted: 'wanted_posts',
  archive: 'submission_queue',
  models: 'models',
};

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const body = await readBody<{ surface?: unknown; ids?: unknown }>(event);
  const surface = body?.surface as ReviewSurface;
  if (!(REVIEW_SURFACES as readonly string[]).includes(surface))
    throw createError({ statusCode: 400, statusMessage: 'Unknown surface' });
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
  if (!ids.length) return { cards: {} };

  const db = getServiceClient();
  const { data: rows, error } = await db
    .from(TABLE[surface] as 'listings')
    .select('id, review_hint, review_decision')
    .in('id', ids);
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const cards: Record<string, { hint: unknown; decision: string | null }> = {};
  const missing: string[] = [];
  for (const r of rows ?? []) {
    if (r.review_hint) cards[r.id] = { hint: r.review_hint, decision: r.review_decision };
    else missing.push(r.id);
  }

  const { gates } = await loadReviewSettings();
  if (gates[surface] !== 'off' && surface !== 'archive') {
    // Archive rows are filled by the queue list itself.
    const read = { listings: reviewListing, finds: reviewFind, wanted: reviewWanted, models: reviewModel }[surface];
    await Promise.all(
      missing.slice(0, 5).map(async (id) => {
        const out = await read(event, id).catch(() => null);
        if (out?.hint) cards[id] = { hint: out.hint, decision: out.decision };
      })
    );
  }
  return { cards };
});

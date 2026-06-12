/**
 * PATCH /api/models/[modelId]  (keystone §11 PR 7)
 *
 * Updates draft model content under the caller's JWT (RLS: owner may update in
 * draft|rejected|published; `guard_model_status` blocks status/counts/featured/
 * reviewed). The wizard calls this as the basics/pricing/safety steps change,
 * including setting `safety_ack` at the review step before submit.
 */
import type { Database } from '~~/types/database';
import { requireUserClient } from '../../utils/userAuth';
import {
  isPricingMode,
  MODEL_TITLE_MIN,
  MODEL_TITLE_MAX,
  MODEL_SUMMARY_MAX,
  MODEL_DESCRIPTION_MAX,
  MODEL_MAX_TAGS,
} from '../../utils/models';

type ModelUpdate = Database['public']['Tables']['models']['Update'];

function intOrNull(v: unknown): number | null {
  return Number.isInteger(v) ? (v as number) : null;
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireUserClient(event);
  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  const body = await readBody(event);
  const update: ModelUpdate = {};

  if (typeof body?.title === 'string') {
    const title = body.title.trim();
    if (title.length < MODEL_TITLE_MIN || title.length > MODEL_TITLE_MAX) {
      throw createError({
        statusCode: 400,
        statusMessage: `Title must be ${MODEL_TITLE_MIN}–${MODEL_TITLE_MAX} characters`,
      });
    }
    update.title = title;
  }
  if ('summary' in body)
    update.summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, MODEL_SUMMARY_MAX) : null;
  if ('description' in body)
    update.description = typeof body.description === 'string' ? body.description.slice(0, MODEL_DESCRIPTION_MAX) : null;
  if (typeof body?.categorySlug === 'string') update.category_slug = body.categorySlug.trim();
  if (Array.isArray(body?.tags))
    update.tags = body.tags
      .filter((t: unknown): t is string => typeof t === 'string')
      .map((t: string) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, MODEL_MAX_TAGS);
  if (typeof body?.licenseCode === 'string') update.license_code = body.licenseCode.trim();
  if (isPricingMode(body?.pricingMode)) update.pricing_mode = body.pricingMode;
  if ('priceCents' in body) update.price_cents = intOrNull(body.priceCents);
  if ('minPriceCents' in body) update.min_price_cents = intOrNull(body.minPriceCents);
  if ('suggestedPriceCents' in body) update.suggested_price_cents = intOrNull(body.suggestedPriceCents);
  if (typeof body?.safetyCritical === 'boolean') update.safety_critical = body.safetyCritical;
  if (typeof body?.safetyAck === 'boolean') update.safety_ack = body.safetyAck;
  if ('sourceUrl' in body)
    update.source_url = typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : null;

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No editable fields provided' });
  }

  const { error } = await supabase.from('models').update(update).eq('id', modelId).select('id').single();
  if (error) {
    console.error('[models/patch] update failed:', error.message);
    throw createError({ statusCode: 400, statusMessage: error.message || 'Could not update model' });
  }

  return { ok: true };
});

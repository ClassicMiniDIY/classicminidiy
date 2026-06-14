/**
 * POST /api/models  (keystone §11 PR 7 — upload wizard backend)
 *
 * Creates a DRAFT model plus its first draft version (version 1), under the
 * caller's JWT so RLS ("owner inserts own draft") is the gate. The version is
 * created up front because file uploads (presign/finalize) attach to a
 * `version_id`. Returns the ids the wizard threads through the rest of the flow.
 *
 * `guard_model_status` forces status/counts/reviewed/is_featured to safe
 * defaults on insert, and `enforce_model_license_pricing` enforces the
 * license×pricing matrix — a bad combo surfaces here as a 400.
 */
import { randomUUID } from 'node:crypto';
import { requireUserClient } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import {
  slugifyModelTitle,
  isPricingMode,
  normalizePricing,
  MODEL_TITLE_MIN,
  MODEL_TITLE_MAX,
  MODEL_SUMMARY_MAX,
  MODEL_DESCRIPTION_MAX,
  MODEL_MAX_TAGS,
} from '../../utils/models';

function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, MODEL_MAX_TAGS);
}

function intOrNull(v: unknown): number | null {
  return Number.isInteger(v) ? (v as number) : null;
}

export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireUserClient(event);
  const body = await readBody(event);

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length < MODEL_TITLE_MIN || title.length > MODEL_TITLE_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `Title must be ${MODEL_TITLE_MIN}–${MODEL_TITLE_MAX} characters`,
    });
  }
  const categorySlug = typeof body?.categorySlug === 'string' ? body.categorySlug.trim() : '';
  if (!categorySlug) throw createError({ statusCode: 400, statusMessage: 'Category is required' });
  const licenseCode = typeof body?.licenseCode === 'string' ? body.licenseCode.trim() : '';
  if (!licenseCode) throw createError({ statusCode: 400, statusMessage: 'License is required' });

  const pricingMode = isPricingMode(body?.pricingMode) ? body.pricingMode : 'free';
  const summary = typeof body?.summary === 'string' ? body.summary.trim().slice(0, MODEL_SUMMARY_MAX) : null;
  const description = typeof body?.description === 'string' ? body.description.slice(0, MODEL_DESCRIPTION_MAX) : null;
  const sourceUrl = typeof body?.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : null;
  const remixOfModelId =
    typeof body?.remixOfModelId === 'string' && body.remixOfModelId.trim() ? body.remixOfModelId.trim() : null;

  // Globally-unique slug — check existing slugs via the service role, then add a
  // short suffix on collision.
  const service = getServiceClient();
  const base = slugifyModelTitle(title);
  let slug = base;
  const { data: clashes } = await service.from('models').select('slug').like('slug', `${base}%`);
  const taken = new Set((clashes ?? []).map((r) => r.slug));
  if (taken.has(slug)) slug = `${base}-${randomUUID().slice(0, 6)}`;

  const { data: model, error: modelError } = await supabase
    .from('models')
    .insert({
      owner_id: user.id,
      slug,
      title,
      summary,
      description,
      category_slug: categorySlug,
      tags: cleanTags(body?.tags),
      license_code: licenseCode,
      pricing_mode: pricingMode,
      ...normalizePricing(pricingMode, {
        priceCents: intOrNull(body?.priceCents),
        minPriceCents: intOrNull(body?.minPriceCents),
        suggestedPriceCents: intOrNull(body?.suggestedPriceCents),
      }),
      safety_critical: body?.safetyCritical === true,
      source_url: sourceUrl,
      remix_of_model_id: remixOfModelId,
    })
    .select('id, slug')
    .single();

  if (modelError || !model) {
    console.error('[models/create] insert failed:', modelError?.message);
    // DB-trigger messages (license×pricing) and FK errors are user-actionable.
    throw createError({ statusCode: 400, statusMessage: modelError?.message || 'Could not create model' });
  }

  const { data: version, error: versionError } = await supabase
    .from('model_versions')
    .insert({ model_id: model.id, version_number: 1, license_code: licenseCode, status: 'draft' })
    .select('id, version_number')
    .single();

  if (versionError || !version) {
    console.error('[models/create] version insert failed:', versionError?.message);
    throw createError({ statusCode: 500, statusMessage: 'Created the model but could not create its first version' });
  }

  return { modelId: model.id, slug: model.slug, versionId: version.id, versionNumber: version.version_number };
});

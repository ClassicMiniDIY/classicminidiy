/**
 * GET /api/archive/variants/:slug
 *
 * One approved variant with its related cards. A miss is a real 404 so the
 * detail page can propagate it (`.claude/rules/images-seo.md`). A variant id
 * (uuid) resolves too — activity feeds and the contribution ledger only know
 * the id — and the page 301s it onto the slug.
 */
import { createError, getRouterParam } from 'h3';
import { getModelVariant, getModelVariantById, relatedModelVariantsFor } from '../../../utils/modelVariants';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? '';
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  }
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug);
  const variant = isId ? await getModelVariantById(slug) : await getModelVariant(slug);
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  }
  return { variant, related: await relatedModelVariantsFor(variant) };
});

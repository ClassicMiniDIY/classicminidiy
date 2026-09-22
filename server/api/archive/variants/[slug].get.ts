/**
 * GET /api/archive/variants/:slug
 *
 * One variant with its related cards. A miss is a real 404 so the detail page
 * can propagate it (`.claude/rules/images-seo.md`: every dynamic route 404s on
 * a miss).
 */
import { createError, getRouterParam } from 'h3';
import { getModelVariant, relatedModelVariants } from '../../../utils/modelVariants';

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug') ?? '';
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  }
  const variant = getModelVariant(slug);
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: 'Variant not found' });
  }
  return { variant, related: relatedModelVariants(variant) };
});

/**
 * GET /api/models/categories  (keystone §4)
 *
 * Active model categories for the browse filter chips. Public; static segment so
 * it never collides with the `[modelId]` param route.
 */
import { getServiceClient } from '../../utils/supabase';
import { assertModelsEnabled } from '../../utils/models';

export default defineEventHandler(async (event) => {
  assertModelsEnabled();

  const service = getServiceClient();
  const { data, error } = await service
    .from('model_categories')
    .select('slug, name, icon')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[models/categories] query failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to load categories' });
  }

  return { categories: data ?? [] };
});

/**
 * GET /api/admin/reference/:key/:version?schema=N — one published version with
 * its exact payload (view, or load into the draft to revert: a revert is a NEW
 * version with the old text; versions never go backwards). Admin only.
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';
import { assertDatasetKey } from '../../../../utils/referenceAdmin';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const key = assertDatasetKey(getRouterParam(event, 'key'));
  const version = Number(getRouterParam(event, 'version'));
  const schema = Number(getQuery(event).schema ?? 1);
  if (!Number.isInteger(version) || version < 1 || !Number.isInteger(schema) || schema < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid version' });
  }
  const { data, error } = await getServiceClient().rpc('admin_reference_version', {
    p_dataset: key,
    p_version: version,
    p_schema_version: schema,
  });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  const row = data?.[0];
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No such version' });
  return { version: row };
});

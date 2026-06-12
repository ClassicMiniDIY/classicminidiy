/**
 * POST /api/models/[modelId]/versions  (keystone §11 PR 7 — new-version flow)
 *
 * Creates the next draft version of an existing owned model (new files mean a
 * new version; old versions are retained, buyers get all versions). Numbered
 * max(version_number)+1. Runs under the caller's JWT so RLS confirms ownership.
 */
import { requireUserClient } from '../../../../utils/userAuth';

export default defineEventHandler(async (event) => {
  const { supabase } = await requireUserClient(event);
  const modelId = getRouterParam(event, 'modelId');
  if (!modelId) throw createError({ statusCode: 400, statusMessage: 'Missing model id' });

  // Owner-visible read confirms ownership (RLS) and gives the current license to
  // seed the new draft version with.
  const { data: model, error: modelError } = await supabase
    .from('models')
    .select('id, license_code')
    .eq('id', modelId)
    .single();
  if (modelError || !model) throw createError({ statusCode: 404, statusMessage: 'Model not found' });

  const { data: last } = await supabase
    .from('model_versions')
    .select('version_number')
    .eq('model_id', modelId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (last?.version_number ?? 0) + 1;

  const { data: version, error } = await supabase
    .from('model_versions')
    .insert({ model_id: modelId, version_number: nextNumber, license_code: model.license_code, status: 'draft' })
    .select('id, version_number')
    .single();

  if (error || !version) {
    console.error('[models/new-version] insert failed:', error?.message);
    throw createError({ statusCode: 400, statusMessage: error?.message || 'Could not create a new version' });
  }

  return { versionId: version.id, versionNumber: version.version_number };
});

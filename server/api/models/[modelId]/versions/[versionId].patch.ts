/**
 * PATCH /api/models/[modelId]/versions/[versionId]  (keystone §11 PR 7)
 *
 * Updates a draft version's metadata — print settings, hardware BOM, assembly
 * (the JSONB shapes), plus label/changelog — under the caller's JWT. RLS allows
 * the owner to update while the version is draft|rejected;
 * `guard_version_immutability` blocks license/status/number once published.
 */
import type { Database } from '~~/types/database';
import { requireUserClient } from '../../../../utils/userAuth';

type VersionUpdate = Database['public']['Tables']['model_versions']['Update'];

export default defineEventHandler(async (event) => {
  const { supabase } = await requireUserClient(event);
  const versionId = getRouterParam(event, 'versionId');
  if (!versionId) throw createError({ statusCode: 400, statusMessage: 'Missing version id' });

  const body = await readBody(event);
  const update: VersionUpdate = {};

  if (typeof body?.label === 'string') update.label = body.label.trim().slice(0, 120);
  if ('changelog' in body) update.changelog = typeof body.changelog === 'string' ? body.changelog.slice(0, 5000) : null;
  // JSONB columns — accept objects/arrays as-is; normalize null/undefined.
  if (body?.printSettings !== undefined)
    update.print_settings = body.printSettings && typeof body.printSettings === 'object' ? body.printSettings : {};
  if (body?.hardwareBom !== undefined) update.hardware_bom = Array.isArray(body.hardwareBom) ? body.hardwareBom : [];
  if (body?.assembly !== undefined)
    update.assembly = body.assembly && typeof body.assembly === 'object' ? body.assembly : {};

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No editable fields provided' });
  }

  const { error } = await supabase.from('model_versions').update(update).eq('id', versionId).select('id').single();
  if (error) {
    console.error('[models/version-patch] update failed:', error.message);
    throw createError({ statusCode: 400, statusMessage: error.message || 'Could not update version' });
  }

  return { ok: true };
});

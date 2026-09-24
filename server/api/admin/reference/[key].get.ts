/**
 * GET /api/admin/reference/:key — the dataset's current version, newest live
 * shape, with its exact payload text (the editor's starting draft). Admin only.
 */
import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { assertDatasetKey } from '../../../utils/referenceAdmin';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const key = assertDatasetKey(getRouterParam(event, 'key'));
  const db = getServiceClient();

  const { data: list, error } = await db.rpc('admin_reference_datasets');
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  const dataset = (list ?? []).find((d) => d.key === key);
  if (!dataset) throw createError({ statusCode: 404, statusMessage: 'Unknown dataset' });

  const schemaVersion = Math.max(...(dataset.live_schema_versions ?? [1]));
  const loadCurrent = async (version: number) => {
    const res = await db.rpc('admin_reference_version', {
      p_dataset: key,
      p_version: version,
      p_schema_version: schemaVersion,
    });
    if (res.error) throw createError({ statusCode: 500, statusMessage: res.error.message });
    return res.data?.[0] ?? null;
  };
  const current = dataset.current_version != null ? await loadCurrent(dataset.current_version) : null;
  return { dataset, schemaVersion, current };
});

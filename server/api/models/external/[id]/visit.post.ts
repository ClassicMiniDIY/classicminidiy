/**
 * POST /api/models/external/[id]/visit — outbound-click beacon.
 *
 * The browser fires this via `navigator.sendBeacon` when a user clicks the
 * branded "View on {Site}" button. It bumps `external_models.click_count` (the
 * external analog of first-party download_count) and returns 204. No auth — it
 * is a fire-and-forget counter; the RPC only counts approved listings. The
 * anchor still points at the real source URL, so the page stays SEO-clean.
 */
import { getServiceClient } from '../../../../utils/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const service = getServiceClient();

  let modelId = id && UUID_RE.test(id) ? id : null;
  if (!modelId && id) {
    const { data } = await service.from('external_models').select('id').eq('slug', id).maybeSingle();
    modelId = data?.id ?? null;
  }

  if (modelId) {
    await service.rpc('increment_external_model_click', { p_id: modelId });
  }

  setResponseStatus(event, 204);
  return null;
});

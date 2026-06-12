/**
 * DELETE /api/models/[modelId]/images/[imageId]  (keystone §11 PR 7)
 *
 * Removes a gallery image (row + storage object) via the service role, gated on
 * model ownership. Used by the upload wizard's "remove image" affordance.
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireUserAuth } from '../../../../utils/userAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const modelId = getRouterParam(event, 'modelId');
  const imageId = getRouterParam(event, 'imageId');
  if (!modelId || !imageId) throw createError({ statusCode: 400, statusMessage: 'Missing model or image id' });

  const service = getServiceClient();

  const { data: model } = await service.from('models').select('owner_id').eq('id', modelId).single();
  if (!model) throw createError({ statusCode: 404, statusMessage: 'Model not found' });
  if (model.owner_id !== user.id) throw createError({ statusCode: 403, statusMessage: 'Not allowed' });

  const { data: image } = await service
    .from('model_images')
    .select('id, storage_path, model_id')
    .eq('id', imageId)
    .single();
  if (!image || image.model_id !== modelId) throw createError({ statusCode: 404, statusMessage: 'Image not found' });

  await service.storage.from('model-images').remove([image.storage_path]);
  const { error } = await service.from('model_images').delete().eq('id', imageId);
  if (error) {
    console.error('[models/images delete] failed:', error.message);
    throw createError({ statusCode: 400, statusMessage: 'Could not remove image' });
  }

  return { ok: true };
});

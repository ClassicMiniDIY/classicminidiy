/**
 * POST /api/admin/variants/photos/:photoId — moderate one variant photo.
 *
 *   body: { action: 'hide' | 'show' | 'primary', reason?: string }
 *
 * `hide` is the takedown path for the recovered brochure scans and for
 * contributed photos: status -> rejected, nothing deleted, reversible with
 * `show`. `primary` clears the current primary first because
 * model_variant_photos_one_primary allows only one per variant.
 */
import { getServiceClient } from '../../../../utils/supabase';
import { requireAdminAuth } from '../../../../utils/adminAuth';
import { auditVariantAction, UUID_RE } from '../../../../utils/variantAdmin';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const photoId = getRouterParam(event, 'photoId') ?? '';
  if (!UUID_RE.test(photoId)) throw createError({ statusCode: 404, statusMessage: 'Photo not found' });
  const body = await readBody<{ action?: string; reason?: string }>(event);
  const action = body?.action;
  if (action !== 'hide' && action !== 'show' && action !== 'primary') {
    throw createError({ statusCode: 400, statusMessage: "action must be 'hide', 'show' or 'primary'" });
  }

  const db = getServiceClient();
  const { data: photo } = await db
    .from('model_variant_photos')
    .select('id, variant_id, url, status, is_primary')
    .eq('id', photoId)
    .maybeSingle();
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Photo not found' });

  let error;
  if (action === 'primary') {
    if (photo.status !== 'approved') {
      throw createError({ statusCode: 400, statusMessage: 'Show the photo before making it primary' });
    }
    ({ error } = await db
      .from('model_variant_photos')
      .update({ is_primary: false })
      .eq('variant_id', photo.variant_id)
      .eq('is_primary', true));
    if (!error) ({ error } = await db.from('model_variant_photos').update({ is_primary: true }).eq('id', photoId));
  } else {
    ({ error } = await db
      .from('model_variant_photos')
      .update({
        status: action === 'hide' ? 'rejected' : 'approved',
        // A hidden photo cannot stay primary; the next one takes over on read.
        ...(action === 'hide' ? { is_primary: false } : {}),
      })
      .eq('id', photoId));
  }
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const auditError = await auditVariantAction(db, user.id, `variant_photo_${action}`, 'variant_photo', photoId, {
    variant_id: photo.variant_id,
    url: photo.url,
    reason: (body?.reason ?? '').trim().slice(0, 500) || null,
  });
  return { success: true, warning: auditError };
});

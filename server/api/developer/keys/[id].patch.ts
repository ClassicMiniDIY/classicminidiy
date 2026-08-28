import { requireUserAuth } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';

/** Rename one of the caller's API keys. The user_id filter is the ownership
 *  check — the route runs service-role, so RLS is not standing behind it. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');
  // A non-UUID param would reach PostgREST and fail the uuid cast — a 500 with
  // error-log noise for what is plain bad input. Answer the same 404 an
  // unknown id gets.
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' });
  }
  const body = await readBody(event);

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be 1-60 characters' });
  }

  const db = getServiceClient();

  const { data, error } = await db
    .from('api_keys')
    .update({ name })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id, name, key_prefix, created_at, last_used_at')
    .maybeSingle();

  if (error) {
    console.error('[developer/keys] rename failed:', error.message);
    throw createError({ statusCode: 500, statusMessage: 'Failed to rename API key' });
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' });
  }

  return data;
});

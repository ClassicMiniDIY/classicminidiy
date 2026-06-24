import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or missing Config ID' });
  }

  const supabase = getServiceClient();

  const { error } = await supabase.from('saved_alignment_configs').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete config' });
  }

  return { success: true };
});

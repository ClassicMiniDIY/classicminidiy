import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID required' });
  }

  const supabase = getServiceClient();

  const { error } = await supabase.from('saved_gear_configs').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete config' });
  }

  return { success: true };
});

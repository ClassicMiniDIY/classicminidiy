import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch configs' });
  }

  return data;
});

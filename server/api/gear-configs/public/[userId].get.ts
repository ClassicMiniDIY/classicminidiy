import { getServiceClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'userId');

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User ID required' });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .select('id, name, tire, gearset, final_drive, drop_gear, speedo_drive, max_rpm, created_at')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch public configs' });
  }

  return data;
});

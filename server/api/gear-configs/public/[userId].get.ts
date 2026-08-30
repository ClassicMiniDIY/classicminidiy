import { getServiceClient } from '../../../utils/supabase';
import { requireUuidParam } from '../../../utils/validation';

export default defineEventHandler(async (event) => {
  // Guarded rather than passed through: a non-UUID reaches Postgres, fails the
  // uuid cast and surfaces as a 500 for what is a malformed request.
  const userId = requireUuidParam(getRouterParam(event, 'userId'), 'User ID');

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

import { getServiceClient } from '../../../utils/supabase';

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'userId');

  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or missing User ID' });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_alignment_configs')
    .select(
      'id, name, front_camber, front_caster, front_toe, rear_camber, rear_toe, wheel_size, preset, notes, journal, created_at'
    )
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch public configs' });
  }

  return data;
});

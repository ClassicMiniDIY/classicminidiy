import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const body = await readBody(event);

  const { name, tire, gearset, final_drive, drop_gear, speedo_drive, max_rpm, is_public } = body;
  if (!name || !tire || !gearset || !final_drive || !drop_gear || !speedo_drive || !max_rpm) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' });
  }

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be 1-100 characters' });
  }

  const supabase = getServiceClient();

  // Enforce max 25 configs per user
  const { count, error: countError } = await supabase
    .from('saved_gear_configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check config count' });
  }

  if ((count ?? 0) >= 25) {
    throw createError({ statusCode: 400, statusMessage: 'Maximum of 25 saved configurations reached' });
  }

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .insert({
      user_id: user.id,
      name: name.trim(),
      tire,
      gearset,
      final_drive: String(final_drive),
      drop_gear: String(drop_gear),
      speedo_drive: String(speedo_drive),
      max_rpm: Number(max_rpm),
      is_public: is_public === true,
    })
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create config' });
  }

  return data;
});

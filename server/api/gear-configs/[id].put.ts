import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID required' });
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Name must be 1-100 characters' });
    }
  }

  const supabase = getServiceClient();

  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.tire !== undefined) updates.tire = body.tire;
  if (body.gearset !== undefined) updates.gearset = body.gearset;
  if (body.final_drive !== undefined) updates.final_drive = String(body.final_drive);
  if (body.drop_gear !== undefined) updates.drop_gear = String(body.drop_gear);
  if (body.speedo_drive !== undefined) updates.speedo_drive = String(body.speedo_drive);
  if (body.max_rpm !== undefined) updates.max_rpm = Number(body.max_rpm);
  if (body.is_public !== undefined) updates.is_public = body.is_public === true;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update config' });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Config not found' });
  }

  return data;
});

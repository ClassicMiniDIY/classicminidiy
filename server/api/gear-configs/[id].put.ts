import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import {
  isNoRowsError,
  requireBoundedString,
  requireNumberInRange,
  requireNumericText,
  requireUuidParam,
} from '../../utils/validation';
import { GEAR_CONFIG_LIMITS } from '../../utils/gearConfigs';

const { nameMaxLength, labelMaxLength, driveMaxLength, rpmMin, rpmMax } = GEAR_CONFIG_LIMITS;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Config ID');
  const body = await readBody(event);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = requireBoundedString(body.name, 'Name', nameMaxLength);
  if (body.tire !== undefined) updates.tire = requireBoundedString(body.tire, 'Tire', labelMaxLength);
  if (body.gearset !== undefined) updates.gearset = requireBoundedString(body.gearset, 'Gearset', labelMaxLength);
  if (body.final_drive !== undefined)
    updates.final_drive = requireNumericText(body.final_drive, 'Final drive', driveMaxLength);
  if (body.drop_gear !== undefined) updates.drop_gear = requireNumericText(body.drop_gear, 'Drop gear', driveMaxLength);
  if (body.speedo_drive !== undefined)
    updates.speedo_drive = requireNumericText(body.speedo_drive, 'Speedo drive', driveMaxLength);
  if (body.max_rpm !== undefined) updates.max_rpm = requireNumberInRange(body.max_rpm, 'Max RPM', rpmMin, rpmMax);
  if (body.is_public !== undefined) updates.is_public = body.is_public === true;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('saved_gear_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    // No matching row — a missing id, or a row that is not the caller's. Both
    // are 404 here; distinguishing them would leak which ids exist.
    if (isNoRowsError(error)) {
      throw createError({ statusCode: 404, statusMessage: 'Config not found' });
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to update config' });
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Config not found' });
  }

  return data;
});

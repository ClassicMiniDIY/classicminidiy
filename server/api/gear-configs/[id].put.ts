import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import {
  isNoRowsError,
  requireBoundedString,
  requireNumberInRange,
  requireNumericText,
  requireUuidParam,
} from '../../utils/validation';

/**
 * `tire` and `gearset` are display LABELS, not enums — the calculator writes
 * things like "165/70R10" or "2.583, 1.644, 1.25, 1.0" — so they are bounded
 * strings rather than allowlisted values. The three drive fields are stored as
 * text but represent numbers, so they are bounded tightly.
 */
const MAX_LABEL = 200;
const MAX_DRIVE = 50;
/** Generous on purpose: the UI offers up to 9000, but a config is the user's
 * own record of their own engine, not a spec we police. The bound exists to
 * keep NaN and absurd values out of the column, nothing more. */
const RPM_MIN = 1;
const RPM_MAX = 20000;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Config ID');
  const body = await readBody(event);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = requireBoundedString(body.name, 'Name', 100);
  if (body.tire !== undefined) updates.tire = requireBoundedString(body.tire, 'Tire', MAX_LABEL);
  if (body.gearset !== undefined) updates.gearset = requireBoundedString(body.gearset, 'Gearset', MAX_LABEL);
  if (body.final_drive !== undefined)
    updates.final_drive = requireNumericText(body.final_drive, 'Final drive', MAX_DRIVE);
  if (body.drop_gear !== undefined) updates.drop_gear = requireNumericText(body.drop_gear, 'Drop gear', MAX_DRIVE);
  if (body.speedo_drive !== undefined)
    updates.speedo_drive = requireNumericText(body.speedo_drive, 'Speedo drive', MAX_DRIVE);
  if (body.max_rpm !== undefined) updates.max_rpm = requireNumberInRange(body.max_rpm, 'Max RPM', RPM_MIN, RPM_MAX);
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

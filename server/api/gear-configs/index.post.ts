import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import { requireBoundedString, requireNumberInRange, requireNumericText } from '../../utils/validation';

/** Field bounds shared with [id].put.ts — see the note there on why `tire` and
 * `gearset` are bounded strings rather than allowlisted values. */
const MAX_LABEL = 200;
const MAX_DRIVE = 50;
const RPM_MIN = 1;
const RPM_MAX = 20000;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const body = await readBody(event);

  // Validated per field rather than a truthiness sweep: the old
  // `!name || !tire || ...` check let any non-empty value of any TYPE through,
  // so an object or a number landed in a text column via String() coercion.
  const name = requireBoundedString(body?.name, 'Name', 100);
  const tire = requireBoundedString(body?.tire, 'Tire', MAX_LABEL);
  const gearset = requireBoundedString(body?.gearset, 'Gearset', MAX_LABEL);
  const final_drive = requireNumericText(body?.final_drive, 'Final drive', MAX_DRIVE);
  const drop_gear = requireNumericText(body?.drop_gear, 'Drop gear', MAX_DRIVE);
  const speedo_drive = requireNumericText(body?.speedo_drive, 'Speedo drive', MAX_DRIVE);
  const max_rpm = requireNumberInRange(body?.max_rpm, 'Max RPM', RPM_MIN, RPM_MAX);
  const is_public = body?.is_public === true;

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
      name,
      tire,
      gearset,
      final_drive,
      drop_gear,
      speedo_drive,
      max_rpm,
      is_public,
    })
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create config' });
  }

  return data;
});

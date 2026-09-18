import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import { requireBoundedString, requireNumberInRange, requireNumericText } from '../../utils/validation';
import { GEAR_CONFIG_LIMITS } from '../../utils/gearConfigs';

const { nameMaxLength, labelMaxLength, driveMaxLength, rpmMin, rpmMax, maxPerUser } = GEAR_CONFIG_LIMITS;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const body = await readBody(event);

  // Validated per field rather than a truthiness sweep: the old
  // `!name || !tire || ...` check let any non-empty value of any TYPE through,
  // so an object or a number landed in a text column via String() coercion.
  const name = requireBoundedString(body?.name, 'Name', nameMaxLength);
  const tire = requireBoundedString(body?.tire, 'Tire', labelMaxLength);
  const gearset = requireBoundedString(body?.gearset, 'Gearset', labelMaxLength);
  const final_drive = requireNumericText(body?.final_drive, 'Final drive', driveMaxLength);
  const drop_gear = requireNumericText(body?.drop_gear, 'Drop gear', driveMaxLength);
  const speedo_drive = requireNumericText(body?.speedo_drive, 'Speedo drive', driveMaxLength);
  const max_rpm = requireNumberInRange(body?.max_rpm, 'Max RPM', rpmMin, rpmMax);
  const is_public = body?.is_public === true;

  const supabase = getServiceClient();

  // Enforce the per-user cap
  const { count, error: countError } = await supabase
    .from('saved_gear_configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to check config count' });
  }

  if ((count ?? 0) >= maxPerUser) {
    throw createError({ statusCode: 400, statusMessage: `Maximum of ${maxPerUser} saved configurations reached` });
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

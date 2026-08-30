import { requireUserAuth } from '../../utils/userAuth';
import { getServiceClient } from '../../utils/supabase';
import { requireUuidParam } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const { user } = await requireUserAuth(event);
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Config ID');

  const supabase = getServiceClient();

  // Deliberately does NOT 404 when nothing matched. DELETE is idempotent by
  // convention, and a user double-clicking, or acting from two tabs, should not
  // be shown an error for reaching the state they asked for. The existing test
  // records the same behaviour for the alignment-configs twin.
  const { error } = await supabase.from('saved_gear_configs').delete().eq('id', id).eq('user_id', user.id);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete config' });
  }

  return { success: true };
});

import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { userId, isAdmin } = body;

  if (!userId || typeof userId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' });
  }

  if (typeof isAdmin !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'isAdmin must be a boolean' });
  }

  // Prevent removing your own admin access
  if (userId === user.id && !isAdmin) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot remove your own admin access' });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});

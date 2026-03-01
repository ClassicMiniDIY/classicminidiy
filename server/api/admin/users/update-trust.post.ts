import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { userId, trustLevel } = body;

  if (!userId || typeof userId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' });
  }

  const validLevels = ['new', 'contributor', 'trusted', 'moderator', 'admin'];
  if (!validLevels.includes(trustLevel)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid trust level' });
  }

  const updates: Record<string, any> = { trust_level: trustLevel };
  if (trustLevel === 'admin') updates.is_admin = true;
  if (trustLevel !== 'admin') updates.is_admin = false;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});

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

  // Only update trust_level — is_admin is a separate flag managed independently
  const { error } = await supabase.from('profiles').update({ trust_level: trustLevel }).eq('id', userId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { success: true };
});

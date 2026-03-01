import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);

  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=300, s-maxage=300',
    'CDN-Cache-Control': 'public, max-age=300',
  });

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('submission_queue')
    .select('*')
    .eq('target_type', 'color')
    .order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  // Map submission_queue rows to ColorQueueItem shape for backward compat
  return (data || []).map((item: any) => ({
    id: item.id,
    ...item.data,
    status: item.status === 'pending' ? 'P' : item.status === 'approved' ? 'A' : 'R',
  }));
});

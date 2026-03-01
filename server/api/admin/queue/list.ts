import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

export default defineEventHandler(async (event) => {
  await requireAdminAuth(event);
  const supabase = getServiceClient();
  const query = getQuery(event);

  const targetType = query.targetType?.toString();
  const status = query.status?.toString() || 'pending';

  let q = supabase
    .from('submission_queue')
    .select('*, submitter:profiles!submission_queue_submitted_by_fkey(display_name, email, avatar_url, trust_level)')
    .order('created_at', { ascending: false });

  if (status !== 'all') q = q.eq('status', status);
  if (targetType) q = q.eq('target_type', targetType);

  const { data, error } = await q;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return (data || []).map((item: any) => ({
    id: item.id,
    type: item.type,
    targetType: item.target_type,
    targetId: item.target_id,
    status: item.status,
    data: item.data,
    reviewerNotes: item.reviewer_notes,
    reviewedAt: item.reviewed_at,
    createdAt: item.created_at,
    submittedBy: item.submitted_by,
    submitterName: item.submitter?.display_name || item.submitter?.email || 'Unknown',
    submitterEmail: item.submitter?.email || null,
    submitterAvatar: item.submitter?.avatar_url || null,
    submitterTrustLevel: item.submitter?.trust_level || 'new',
  }));
});

export interface SubmissionItem {
  id: string;
  type: 'new_item' | 'edit_suggestion' | 'new_collection';
  targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel';
  targetId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, any>;
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const useSubmissions = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  const mapToSubmission = (row: any): SubmissionItem => ({
    id: row.id,
    type: row.type,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    data: row.data || {},
    reviewerNotes: row.reviewer_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  });

  const listMySubmissions = async (opts?: {
    status?: 'pending' | 'approved' | 'rejected';
    targetType?: string;
  }): Promise<SubmissionItem[]> => {
    if (!user.value) return [];

    let query = supabase
      .from('submission_queue')
      .select('*')
      .eq('submitted_by', user.value.id)
      .order('created_at', { ascending: false });

    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.targetType) query = query.eq('target_type', opts.targetType);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapToSubmission);
  };

  const submitNewItem = async (
    targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel',
    itemData: Record<string, any>,
  ): Promise<SubmissionItem> => {
    if (!user.value) throw new Error('Must be authenticated to submit');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: targetType,
        submitted_by: user.value.id,
        status: 'pending',
        data: itemData,
      })
      .select()
      .single();

    if (error) throw error;
    return mapToSubmission(data);
  };

  const submitEditSuggestion = async (
    targetType: 'document' | 'collection' | 'registry' | 'color' | 'wheel',
    targetId: string,
    changes: Record<string, { from: any; to: any }>,
    reason: string,
  ): Promise<SubmissionItem> => {
    if (!user.value) throw new Error('Must be authenticated to suggest edits');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'edit_suggestion',
        target_type: targetType,
        target_id: targetId,
        submitted_by: user.value.id,
        status: 'pending',
        data: { changes, reason },
      })
      .select()
      .single();

    if (error) throw error;
    return mapToSubmission(data);
  };

  const getSubmission = async (id: string): Promise<SubmissionItem | null> => {
    const { data, error } = await supabase
      .from('submission_queue')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapToSubmission(data);
  };

  return { listMySubmissions, submitNewItem, submitEditSuggestion, getSubmission };
};

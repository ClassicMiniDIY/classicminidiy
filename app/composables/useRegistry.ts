import type { RegistryItem } from '../../data/models/registry';

export const useRegistry = () => {
  const supabase = useSupabase();

  const mapToRegistry = (row: any): RegistryItem => ({
    uniqueId: row.id,
    year: row.year,
    model: row.model || '',
    bodyNum: row.body_number || '',
    engineNum: row.engine_number || '',
    engineSize: row.engine_size || 0,
    bodyType: row.body_type || '',
    color: row.color || '',
    trim: row.trim || '',
    buildDate: row.build_date,
    notes: row.notes || '',
    submittedBy: row.legacy_submitted_by || '',
    submittedByEmail: row.legacy_submitted_by_email || '',
    status: row.status === 'pending' ? 'P' : row.status === 'approved' ? 'A' : ('R' as any),
  });

  const listApproved = async (): Promise<RegistryItem[]> => {
    const { data, error } = await supabase
      .from('registry_entries')
      .select('*')
      .eq('status', 'approved')
      .order('year', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapToRegistry);
  };

  const submitRegistryEntry = async (entry: Partial<RegistryItem>): Promise<any> => {
    const { user } = useAuth();
    if (!user.value) throw new Error('Must be authenticated to submit');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: 'registry',
        submitted_by: user.value.id,
        status: 'pending',
        data: entry,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return { listApproved, submitRegistryEntry };
};

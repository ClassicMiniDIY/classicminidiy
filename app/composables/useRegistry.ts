import type { RegistryItem } from '../../data/models/registry';

/**
 * Columns read from `registry_entries` for the public register.
 *
 * Deliberately NOT `select('*')`. The table uses column-level SELECT grants
 * since classicminidiy-supabase migration 20260727000002: submitter contact
 * details (`legacy_submitted_by_email`) are revoked from anon/authenticated
 * because they were world-readable, and Postgres expands `*` to every column
 * and rejects the whole query with 42501 when one of them is not granted.
 *
 * Adding a column here means checking it is granted to anon in that repo.
 */
const REGISTRY_COLUMNS = [
  'id',
  'year',
  'model',
  'body_number',
  'engine_number',
  'engine_size',
  'body_type',
  'color',
  'trim',
  'build_date',
  'notes',
  'legacy_submitted_by',
  'status',
].join(', ');

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
    // No submittedByEmail: the register never rendered it, and the column is no
    // longer readable by anon/authenticated. Admin surfaces read submitter
    // contact details from submission_queue via the service client instead.
    status: row.status === 'pending' ? 'P' : row.status === 'approved' ? 'A' : ('R' as any),
  });

  const listApproved = async (): Promise<RegistryItem[]> => {
    const { data, error } = await supabase
      .from('registry_entries')
      .select(REGISTRY_COLUMNS)
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

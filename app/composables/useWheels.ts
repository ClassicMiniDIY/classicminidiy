import type { IWheelsData } from '../../data/models/wheels';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Columns read from `wheels` for the public archive.
 *
 * Deliberately NOT `select('*')`. The table uses column-level SELECT grants
 * since classicminidiy-supabase migration 20260727000002: submitter contact
 * details (`legacy_submitted_by_email`) are revoked from anon/authenticated
 * because they were world-readable, and Postgres expands `*` to every column
 * and rejects the whole query with 42501 when one of them is not granted.
 *
 * Adding a column here means checking it is granted to anon in that repo.
 */
const WHEEL_COLUMNS = [
  'id',
  'name',
  'wheel_type',
  'size',
  'width',
  'offset_value',
  'bolt_pattern',
  'center_bore',
  'manufacturer',
  'weight',
  'notes',
  'photos',
  'legacy_submitted_by',
  'submitted_by',
  'status',
  // The design credits a contributor on every card and gap state, so the
  // account behind `submitted_by` has to come back with the row. Read through
  // public_profiles, not profiles — since the profiles split, selecting another
  // user's `profiles` row silently returns nothing.
  'submitter:public_profiles!wheels_submitted_by_fkey(username, display_name)',
].join(', ');

export const useWheels = () => {
  const supabase = useSupabase();
  const config = useRuntimeConfig();

  const getPhotoUrl = (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${config.public.supabaseUrl}/storage/v1/object/public/archive-wheels/${path}`;
  };

  const mapToWheel = (row: any): IWheelsData => ({
    uuid: row.id,
    name: row.name || '',
    submittedBy: row.submitted_by || null,
    contributorUsername: row.submitter?.username || null,
    contributorName: row.submitter?.display_name || row.legacy_submitted_by || '',
    type: row.wheel_type || '',
    size: String(row.size || ''),
    width: row.width || '',
    offset: row.offset_value || '',
    notes: row.notes || '',
    userName: row.legacy_submitted_by || '',
    // No emailAddress: the archive never rendered it, and the column is no
    // longer readable by anon/authenticated. The admin review screen gets it
    // from submission_queue via the service client instead.
    referral: '',
    images: (row.photos || []).map((p: string) => ({ src: getPhotoUrl(p) })),
    manufacturer: row.manufacturer || '',
    boltPattern: row.bolt_pattern || '',
    centerBore: row.center_bore || '',
    weight: row.weight || '',
  });

  const listAll = async (): Promise<IWheelsData[]> => {
    const { data, error } = await supabase.from('wheels').select(WHEEL_COLUMNS).eq('status', 'approved').order('name');

    if (error) throw error;
    return (data || []).map(mapToWheel);
  };

  /**
   * Returns a candidate pool of approved wheels suitable for the home-page
   * "featured" preview. Pushes status + name filters to the DB and caps the
   * pool size server-side; the caller then ranks by photo count in memory
   * to pick the final N. Avoids fetching the entire registry on every SSR.
   *
   * Pragmatic compromise: a true "top N by photo count" ordering would need
   * either a stored Postgres function or a generated photo_count column,
   * both of which require a migration in classicminidiy-supabase. A 100-row
   * alphabetical candidate pool gives us enough headroom to pick a quality
   * preview without unbounded growth as the registry scales.
   */
  const listFeaturedCandidates = async (poolSize = 100): Promise<IWheelsData[]> => {
    const { data, error } = await supabase
      .from('wheels')
      .select(WHEEL_COLUMNS)
      .eq('status', 'approved')
      .not('name', 'is', null)
      .not('photos', 'is', null)
      .order('name')
      .limit(poolSize);

    if (error) throw error;
    return (data || []).map(mapToWheel);
  };

  const listBySize = async (wheelSize: number): Promise<IWheelsData[]> => {
    const { data, error } = await supabase
      .from('wheels')
      .select(WHEEL_COLUMNS)
      .eq('status', 'approved')
      .eq('size', wheelSize)
      .order('name');

    if (error) throw error;
    return (data || []).map(mapToWheel);
  };

  const listBySizeName = async (sizeName: string): Promise<IWheelsData[]> => {
    if (sizeName === 'list') return listAll();
    const sizeMap: Record<string, number> = { ten: 10, twelve: 12, thirteen: 13 };
    const size = sizeMap[sizeName];
    if (!size) return listAll();
    return listBySize(size);
  };

  const getWheel = async (id: string): Promise<IWheelsData | null> => {
    // wheels.id is a uuid; the catch-all route param can be anything (including the 'noWheel'
    // fallback), and passing a non-uuid straight through throws 22P02 in Postgres.
    if (!UUID_RE.test(id)) return null;
    // maybeSingle, not single: a well-formed uuid that matches no row is the COMMON
    // case here — pre-migration deep links use ids the DynamoDB import never carried
    // over. single() answers that with a 406 logged as an API error; maybeSingle()
    // returns null data and no error, which is what a miss actually is.
    const { data, error } = await supabase
      .from('wheels')
      .select(WHEEL_COLUMNS)
      .eq('id', id)
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !data) return null;
    return mapToWheel(data);
  };

  const submitWheel = async (wheelData: Partial<IWheelsData>): Promise<any> => {
    const { user } = useAuth();
    if (!user.value) throw new Error('Must be authenticated to submit');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: 'wheel',
        submitted_by: user.value.id,
        status: 'pending',
        data: wheelData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return { listAll, listBySize, listBySizeName, listFeaturedCandidates, getWheel, submitWheel, getPhotoUrl };
};

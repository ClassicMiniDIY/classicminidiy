import type { IWheelsData } from '../../data/models/wheels';

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
    type: row.wheel_type || '',
    size: String(row.size || ''),
    width: row.width || '',
    offset: row.offset_value || '',
    notes: row.notes || '',
    userName: row.legacy_submitted_by || '',
    emailAddress: row.legacy_submitted_by_email || '',
    referral: '',
    images: (row.photos || []).map((p: string) => ({ src: getPhotoUrl(p) })),
    manufacturer: row.manufacturer || '',
    boltPattern: row.bolt_pattern || '',
    centerBore: row.center_bore || '',
    weight: row.weight || '',
  });

  const listAll = async (): Promise<IWheelsData[]> => {
    const { data, error } = await supabase.from('wheels').select('*').eq('status', 'approved').order('name');

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
      .select('*')
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
      .select('*')
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
    const { data, error } = await supabase.from('wheels').select('*').eq('id', id).eq('status', 'approved').single();

    if (error) return null;
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

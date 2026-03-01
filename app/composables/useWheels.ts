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
    const { data, error } = await supabase
      .from('wheels')
      .select('*')
      .eq('status', 'approved')
      .order('name');

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
    const { data, error } = await supabase
      .from('wheels')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return mapToWheel(data);
  };

  const submitWheel = async (wheelData: Partial<IWheelsData>) => {
    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: 'wheel',
        status: 'pending',
        data: wheelData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return { listAll, listBySize, listBySizeName, getWheel, submitWheel, getPhotoUrl };
};

import type { Color, PrettyColor } from '../../data/models/colors';

export const useColors = () => {
  const supabase = useSupabase();
  const config = useRuntimeConfig();

  const getSwatchUrl = (path: string | null): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${config.public.supabaseUrl}/storage/v1/object/public/archive-colors/${path}`;
  };

  const mapToColor = (row: any): Color => ({
    id: row.id,
    name: row.name || '',
    code: row.code || '',
    shortCode: row.short_code || '',
    ditzlerPpgCode: row.ditzler_ppg_code || '',
    duluxCode: row.dulux_code || '',
    primaryColor: row.hex_value || '',
    years:
      row.year_start && row.year_end
        ? `${row.year_start}-${row.year_end}`
        : row.year_start?.toString() || '',
    hasSwatch: row.has_swatch || false,
    imageSwatch: getSwatchUrl(row.swatch_path),
    images: row.contributor_images || [],
  });

  const listColors = async (): Promise<Color[]> => {
    const { data, error } = await supabase
      .from('colors')
      .select('*')
      .eq('status', 'approved')
      .order('name');

    if (error) throw error;
    return (data || []).map(mapToColor);
  };

  const getColor = async (id: string): Promise<PrettyColor | null> => {
    const { data, error } = await supabase
      .from('colors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    const color = mapToColor(data);
    return {
      raw: color,
      pretty: {
        'Primary Color': color.primaryColor,
        Code: color.code,
        hasSwatch: color.hasSwatch,
        'Ditzler PPG Code': color.ditzlerPpgCode,
        'Dulux Code': color.duluxCode,
        Name: color.name,
        'Short Code': color.shortCode,
        Years: color.years,
        ID: color.id,
      },
    };
  };

  const submitColor = async (colorData: Partial<Color>): Promise<any> => {
    const { user } = useAuth();
    if (!user.value) throw new Error('Must be authenticated to submit');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: 'color',
        submitted_by: user.value.id,
        status: 'pending',
        data: colorData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const checkDuplicate = async (code: string): Promise<boolean> => {
    const { data } = await supabase
      .from('colors')
      .select('id')
      .eq('code', code)
      .limit(1);

    return (data?.length || 0) > 0;
  };

  return { listColors, getColor, submitColor, checkDuplicate, getSwatchUrl };
};

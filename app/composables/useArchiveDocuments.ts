export interface ArchiveDocumentItem {
  title: string;
  description: string | null;
  image: string;
  download: string;
  code: string;
  path: string;
}

export const useArchiveDocuments = () => {
  const supabase = useSupabase();
  const config = useRuntimeConfig();

  const getStorageUrl = (path: string | null): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${config.public.supabaseUrl}/storage/v1/object/public/archive-documents/${path}`;
  };

  const getThumbnailUrl = (path: string | null): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${config.public.supabaseUrl}/storage/v1/object/public/archive-thumbnails/${path}`;
  };

  const mapToArchiveItem = (row: any): ArchiveDocumentItem => ({
    title: row.title || '',
    description: row.description || '',
    image: getThumbnailUrl(row.thumbnail_path),
    download: getStorageUrl(row.file_path),
    code: row.code || '',
    path: `/archive/documents/${row.slug}`,
  });

  const listByType = async (
    type: 'manual' | 'advert' | 'catalogue' | 'tuning' | 'electrical',
  ): Promise<ArchiveDocumentItem[]> => {
    const { data, error } = await supabase
      .from('archive_documents')
      .select('*')
      .eq('type', type)
      .eq('status', 'approved')
      .order('title');

    if (error) throw error;

    // Sort so items with downloads come first
    const items = (data || []).map(mapToArchiveItem);
    items.sort((a, b) => {
      const k1 = a.download ? 1 : 0;
      const k2 = b.download ? 1 : 0;
      return k2 - k1;
    });

    return items;
  };

  const getByPath = async (path: string): Promise<ArchiveDocumentItem | null> => {
    // Path comes in like /archive/manuals/akd4935 - extract the slug
    const segments = path.split('/').filter(Boolean);
    // Try matching by legacy_slug (old path format) or slug
    const slug = segments[segments.length - 1];
    if (!slug) return null;

    // First try legacy_slug match (for old URLs like /archive/manuals/akd4935)
    const { data: legacyMatch } = await supabase
      .from('archive_documents')
      .select('*')
      .eq('legacy_slug', slug)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    if (legacyMatch) return mapToArchiveItem(legacyMatch);

    // Then try regular slug match
    const { data: slugMatch } = await supabase
      .from('archive_documents')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    if (slugMatch) return mapToArchiveItem(slugMatch);

    return null;
  };

  return { listByType, getByPath, getStorageUrl, getThumbnailUrl };
};

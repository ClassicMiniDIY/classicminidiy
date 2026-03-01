export interface ArchiveDocumentItem {
  title: string;
  description: string | null;
  image: string;
  download: string;
  code: string;
  path: string;
}

export interface ArchiveCollectionItem {
  id: string;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  image: string;
  itemCount: number;
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

  const listAll = async (opts?: {
    type?: string;
    search?: string;
    sort?: 'title' | 'newest' | 'oldest';
  }): Promise<ArchiveDocumentItem[]> => {
    let query = supabase
      .from('archive_documents')
      .select('*')
      .eq('status', 'approved');

    if (opts?.type) {
      query = query.eq('type', opts.type);
    }

    if (opts?.search) {
      query = query.or(`title.ilike.%${opts.search}%,description.ilike.%${opts.search}%,code.ilike.%${opts.search}%`);
    }

    if (opts?.sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (opts?.sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('title');
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data || []).map(mapToArchiveItem);
    items.sort((a, b) => {
      const k1 = a.download ? 1 : 0;
      const k2 = b.download ? 1 : 0;
      return k2 - k1;
    });

    return items;
  };

  const listCollections = async (opts?: {
    type?: string;
  }): Promise<ArchiveCollectionItem[]> => {
    let query = supabase
      .from('document_collections')
      .select('*, archive_documents(count)')
      .eq('status', 'approved');

    if (opts?.type) {
      query = query.eq('type', opts.type);
    }

    query = query.order('title');

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      slug: row.slug,
      type: row.type,
      title: row.title || '',
      description: row.description || '',
      image: getThumbnailUrl(row.thumbnail_path),
      itemCount: row.archive_documents?.[0]?.count || 0,
    }));
  };

  const getDocumentBySlug = async (slug: string): Promise<ArchiveDocumentItem | null> => {
    const { data, error } = await supabase
      .from('archive_documents')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !data) return null;
    return mapToArchiveItem(data);
  };

  const getCollectionBySlug = async (slug: string): Promise<{
    collection: ArchiveCollectionItem;
    documents: ArchiveDocumentItem[];
  } | null> => {
    const { data: collection, error } = await supabase
      .from('document_collections')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !collection) return null;

    const { data: docs } = await supabase
      .from('archive_documents')
      .select('*')
      .eq('collection_id', collection.id)
      .eq('status', 'approved')
      .order('sort_order');

    return {
      collection: {
        id: collection.id,
        slug: collection.slug,
        type: collection.type,
        title: collection.title || '',
        description: collection.description || '',
        image: getThumbnailUrl(collection.thumbnail_path),
        itemCount: docs?.length || 0,
      },
      documents: (docs || []).map(mapToArchiveItem),
    };
  };

  return { listByType, listAll, listCollections, getByPath, getDocumentBySlug, getCollectionBySlug, getStorageUrl, getThumbnailUrl };
};

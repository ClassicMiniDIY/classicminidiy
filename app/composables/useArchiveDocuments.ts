export interface ArchiveDocumentItem {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  image: string;
  download: string;
  code: string;
  path: string;
  language?: string;
  collectionId: string | null;
}

export interface ArchiveDocumentDetail extends ArchiveDocumentItem {
  year: number | null;
  type: string;
  pageCount: number | null;
  language: string;
  publisher: string | null;
  edition: string | null;
  applicableModels: string[];
  vehicleYearStart: number | null;
  vehicleYearEnd: number | null;
  collection: { id: string; slug: string; title: string; description: string | null; image: string } | null;
  createdAt: string;
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

  // Strip HTML comments, markdown headings, and other artifacts from migrated descriptions
  const cleanDescription = (raw: string | null): string => {
    if (!raw) return '';
    return raw
      .replace(/<!--.*?-->/g, '')  // HTML comments
      .replace(/^#+\s*/gm, '')     // Markdown headings
      .replace(/\s+/g, ' ')        // Collapse whitespace
      .trim();
  };

  const mapToArchiveItem = (row: any): ArchiveDocumentItem => ({
    id: row.id,
    title: row.title || '',
    description: cleanDescription(row.description),
    author: row.author || null,
    image: getThumbnailUrl(row.thumbnail_path),
    download: getStorageUrl(row.file_path),
    code: row.code || '',
    path: `/archive/documents/${row.slug}`,
    language: row.language || undefined,
    collectionId: row.collection_id || null,
  });

  const mapToArchiveDetail = (row: any): ArchiveDocumentDetail => {
    const base = mapToArchiveItem(row);
    const col = row.document_collections;

    return {
      ...base,
      year: row.year ?? null,
      type: row.type || '',
      pageCount: row.page_count ?? null,
      language: row.language || 'en',
      publisher: row.publisher || null,
      edition: row.edition || null,
      applicableModels: row.applicable_models || [],
      vehicleYearStart: row.vehicle_year_start ?? null,
      vehicleYearEnd: row.vehicle_year_end ?? null,
      collection: col
        ? {
            id: col.id,
            slug: col.slug,
            title: col.title || '',
            description: col.description || null,
            image: getThumbnailUrl(col.thumbnail_path),
          }
        : null,
      createdAt: row.created_at || '',
    };
  };

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
      // Escape special PostgREST characters to prevent filter injection
      const escaped = opts.search.replace(/[,%().*]/g, (c) => `\\${c}`);
      query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,code.ilike.%${escaped}%`);
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

  const getDocumentBySlug = async (slug: string): Promise<ArchiveDocumentDetail | null> => {
    const { data, error } = await supabase
      .from('archive_documents')
      .select('*, document_collections(id, slug, title, description, thumbnail_path)')
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapToArchiveDetail(data);
  };

  const getRelatedDocuments = async (
    collectionId: string,
    excludeDocId: string,
  ): Promise<ArchiveDocumentItem[]> => {
    const { data, error } = await supabase
      .from('archive_documents')
      .select('*')
      .eq('collection_id', collectionId)
      .eq('status', 'approved')
      .neq('id', excludeDocId)
      .order('sort_order');

    if (error) throw error;
    return (data || []).map(mapToArchiveItem);
  };

  const getDocumentTypeCounts = async (): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from('archive_documents')
      .select('type')
      .eq('status', 'approved');

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      const type = row.type as string;
      if (type) {
        counts[type] = (counts[type] || 0) + 1;
      }
    }
    return counts;
  };

  const getCollectionBySlug = async (slug: string): Promise<{
    collection: ArchiveCollectionItem;
    documents: ArchiveDocumentDetail[];
  } | null> => {
    const { data: collection, error } = await supabase
      .from('document_collections')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) throw error;
    if (!collection) return null;

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
      documents: (docs || []).map(mapToArchiveDetail),
    };
  };

  const submitDocument = async (documentData: {
    type: 'manual' | 'advert' | 'catalogue' | 'tuning' | 'electrical';
    title: string;
    description?: string;
    code?: string;
    author?: string;
    year?: number;
    filePath?: string;
    thumbnailPath?: string;
  }): Promise<{ id: string }> => {
    const { user } = useAuth();
    if (!user.value) throw new Error('Must be authenticated to submit');

    const { data, error } = await supabase
      .from('submission_queue')
      .insert({
        type: 'new_item',
        target_type: 'document',
        submitted_by: user.value.id,
        status: 'pending',
        data: documentData,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  };

  return { listByType, listAll, listCollections, getByPath, getDocumentBySlug, getRelatedDocuments, getDocumentTypeCounts, getCollectionBySlug, getStorageUrl, getThumbnailUrl, submitDocument };
};

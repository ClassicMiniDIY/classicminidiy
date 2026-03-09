import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, cleanupGlobalMocks, createMockUser } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  // Add .or() to the query builder since the composable uses it
  (mockSupabase._queryBuilder as any).or = vi.fn().mockReturnValue(mockSupabase._queryBuilder);
  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
  }));
});

afterEach(() => {
  cleanupGlobalMocks();
});

// Helper to create a sample database row
const makeDocRow = (overrides: Record<string, any> = {}) => ({
  id: 'doc-1',
  title: 'Workshop Manual',
  description: 'A classic Mini workshop manual',
  slug: 'workshop-manual',
  legacy_slug: 'akd4935',
  type: 'manual',
  code: 'AKD4935',
  file_path: 'manuals/workshop-manual.pdf',
  thumbnail_path: 'manuals/workshop-manual-thumb.jpg',
  status: 'approved',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

const makeCollectionRow = (overrides: Record<string, any> = {}) => ({
  id: 'col-1',
  slug: 'workshop-manuals',
  type: 'manual',
  title: 'Workshop Manuals',
  description: 'Collection of workshop manuals',
  thumbnail_path: 'collections/workshop-thumb.jpg',
  status: 'approved',
  archive_documents: [{ count: 5 }],
  ...overrides,
});

describe('useArchiveDocuments', () => {
  describe('getStorageUrl()', () => {
    it('returns empty string for null/empty path', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getStorageUrl } = useArchiveDocuments();

      expect(getStorageUrl(null)).toBe('');
      expect(getStorageUrl('')).toBe('');
    });

    it('returns the path as-is when it starts with http', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getStorageUrl } = useArchiveDocuments();

      expect(getStorageUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
      expect(getStorageUrl('http://cdn.example.com/file.pdf')).toBe('http://cdn.example.com/file.pdf');
    });

    it('builds full Supabase storage URL for archive-documents bucket', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getStorageUrl } = useArchiveDocuments();

      expect(getStorageUrl('manuals/workshop.pdf')).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-documents/manuals/workshop.pdf'
      );
    });
  });

  describe('getThumbnailUrl()', () => {
    it('returns empty string for null/empty path', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getThumbnailUrl } = useArchiveDocuments();

      expect(getThumbnailUrl(null)).toBe('');
      expect(getThumbnailUrl('')).toBe('');
    });

    it('returns the path as-is when it starts with http', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getThumbnailUrl } = useArchiveDocuments();

      expect(getThumbnailUrl('https://cdn.example.com/thumb.jpg')).toBe('https://cdn.example.com/thumb.jpg');
    });

    it('builds full Supabase storage URL for archive-thumbnails bucket', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getThumbnailUrl } = useArchiveDocuments();

      expect(getThumbnailUrl('manuals/thumb.jpg')).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-thumbnails/manuals/thumb.jpg'
      );
    });
  });

  describe('listByType()', () => {
    it('queries archive_documents table for a given type with approved status', async () => {
      const rows = [makeDocRow()];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listByType } = useArchiveDocuments();
      await listByType('manual');

      expect(mockSupabase.from).toHaveBeenCalledWith('archive_documents');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('type', 'manual');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('title');
    });

    it('maps rows to ArchiveDocumentItem objects', async () => {
      const row = makeDocRow();
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listByType } = useArchiveDocuments();
      const result = await listByType('manual');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'Workshop Manual',
        description: 'A classic Mini workshop manual',
        image: 'https://test.supabase.co/storage/v1/object/public/archive-thumbnails/manuals/workshop-manual-thumb.jpg',
        download: 'https://test.supabase.co/storage/v1/object/public/archive-documents/manuals/workshop-manual.pdf',
        code: 'AKD4935',
        path: '/archive/documents/workshop-manual',
      });
    });

    it('sorts items with downloads first', async () => {
      const withDownload = makeDocRow({ id: 'doc-1', title: 'B Manual', file_path: 'file.pdf' });
      const withoutDownload = makeDocRow({ id: 'doc-2', title: 'A Manual', file_path: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [withoutDownload, withDownload], error: null })
      );

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listByType } = useArchiveDocuments();
      const result = await listByType('manual');

      // The item with a download should come first
      expect(result[0].download).not.toBe('');
      expect(result[1].download).toBe('');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listByType } = useArchiveDocuments();
      const result = await listByType('advert');

      expect(result).toEqual([]);
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Connection failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: supabaseError }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listByType } = useArchiveDocuments();

      await expect(listByType('manual')).rejects.toEqual(supabaseError);
    });

    it('handles rows with null optional fields gracefully', async () => {
      const sparseRow = makeDocRow({
        title: null,
        description: null,
        code: null,
        file_path: null,
        thumbnail_path: null,
      });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [sparseRow], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listByType } = useArchiveDocuments();
      const result = await listByType('manual');

      expect(result[0].title).toBe('');
      expect(result[0].description).toBe('');
      expect(result[0].code).toBe('');
      expect(result[0].image).toBe('');
      expect(result[0].download).toBe('');
    });
  });

  describe('listAll()', () => {
    it('queries with no filters when no options provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      await listAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('archive_documents');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      // Default sort is by title
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('title');
    });

    it('filters by type when provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      await listAll({ type: 'catalogue' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('type', 'catalogue');
    });

    it('applies search filter using .or() with ilike on title, description, and code', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      await listAll({ search: 'cooper' });

      expect((mockSupabase._queryBuilder as any).or).toHaveBeenCalledWith(
        'title.ilike.%cooper%,description.ilike.%cooper%,code.ilike.%cooper%'
      );
    });

    it('sorts by newest (created_at descending) when sort is "newest"', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      await listAll({ sort: 'newest' });

      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('sorts by oldest (created_at ascending) when sort is "oldest"', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      await listAll({ sort: 'oldest' });

      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('sorts by title by default when sort is "title"', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      await listAll({ sort: 'title' });

      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('title');
    });

    it('sorts items with downloads first in the result', async () => {
      const withDownload = makeDocRow({ id: 'doc-1', title: 'B', file_path: 'file.pdf' });
      const withoutDownload = makeDocRow({ id: 'doc-2', title: 'A', file_path: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [withoutDownload, withDownload], error: null })
      );

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();
      const result = await listAll();

      expect(result[0].download).not.toBe('');
      expect(result[1].download).toBe('');
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Query failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: supabaseError }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listAll } = useArchiveDocuments();

      await expect(listAll()).rejects.toEqual(supabaseError);
    });
  });

  describe('listCollections()', () => {
    it('queries document_collections with count join and approved status', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listCollections } = useArchiveDocuments();
      await listCollections();

      expect(mockSupabase.from).toHaveBeenCalledWith('document_collections');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*, archive_documents(count)');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('title');
    });

    it('filters by type when provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listCollections } = useArchiveDocuments();
      await listCollections({ type: 'manual' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('type', 'manual');
    });

    it('maps rows to ArchiveCollectionItem objects with correct item count', async () => {
      const row = makeCollectionRow();
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listCollections } = useArchiveDocuments();
      const result = await listCollections();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'col-1',
        slug: 'workshop-manuals',
        type: 'manual',
        title: 'Workshop Manuals',
        description: 'Collection of workshop manuals',
        image: 'https://test.supabase.co/storage/v1/object/public/archive-thumbnails/collections/workshop-thumb.jpg',
        itemCount: 5,
      });
    });

    it('returns itemCount 0 when archive_documents count is missing', async () => {
      const row = makeCollectionRow({ archive_documents: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listCollections } = useArchiveDocuments();
      const result = await listCollections();

      expect(result[0].itemCount).toBe(0);
    });

    it('returns empty array when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listCollections } = useArchiveDocuments();
      const result = await listCollections();

      expect(result).toEqual([]);
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Query failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: supabaseError }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { listCollections } = useArchiveDocuments();

      await expect(listCollections()).rejects.toEqual(supabaseError);
    });
  });

  describe('getByPath()', () => {
    it('extracts slug from path and tries legacy_slug first', async () => {
      const row = makeDocRow();
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: row, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getByPath } = useArchiveDocuments();
      const result = await getByPath('/archive/manuals/akd4935');

      // Should query legacy_slug first
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('legacy_slug', 'akd4935');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');

      // Should return mapped item
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Workshop Manual');
    });

    it('falls back to slug match when legacy_slug returns null', async () => {
      const row = makeDocRow({ slug: 'my-document' });
      // First call (legacy_slug) returns null
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // Second call (slug) returns the document
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: row, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getByPath } = useArchiveDocuments();
      const result = await getByPath('/archive/documents/my-document');

      // Should try legacy_slug first, then slug
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('legacy_slug', 'my-document');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('slug', 'my-document');

      expect(result).not.toBeNull();
      expect(result!.path).toBe('/archive/documents/my-document');
    });

    it('returns null when neither legacy_slug nor slug matches', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getByPath } = useArchiveDocuments();
      const result = await getByPath('/archive/manuals/nonexistent');

      expect(result).toBeNull();
    });

    it('returns null for empty or root-only paths', async () => {
      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getByPath } = useArchiveDocuments();

      const result = await getByPath('/');
      // The slug extraction produces empty string from '/' after filter(Boolean)
      // which is falsy, so it returns null
      expect(result).toBeNull();
    });

    it('handles path with trailing slash correctly', async () => {
      const row = makeDocRow();
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: row, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getByPath } = useArchiveDocuments();
      const result = await getByPath('/archive/manuals/akd4935/');

      // filter(Boolean) removes empty segments from trailing slash
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('legacy_slug', 'akd4935');
      expect(result).not.toBeNull();
    });

    it('uses limit(1) with maybeSingle for both queries', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getByPath } = useArchiveDocuments();
      await getByPath('/archive/manuals/test-slug');

      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(1);
      expect(mockSupabase._mockMaybeSingle).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDocumentBySlug()', () => {
    it('queries archive_documents by slug with approved status', async () => {
      const row = makeDocRow();
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: row, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getDocumentBySlug } = useArchiveDocuments();
      await getDocumentBySlug('workshop-manual');

      expect(mockSupabase.from).toHaveBeenCalledWith('archive_documents');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('slug', 'workshop-manual');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._mockMaybeSingle).toHaveBeenCalled();
    });

    it('returns mapped ArchiveDocumentItem when found', async () => {
      const row = makeDocRow();
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: row, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getDocumentBySlug } = useArchiveDocuments();
      const result = await getDocumentBySlug('workshop-manual');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Workshop Manual');
      expect(result!.path).toBe('/archive/documents/workshop-manual');
    });

    it('returns null when no document is found', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getDocumentBySlug } = useArchiveDocuments();
      const result = await getDocumentBySlug('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null when Supabase returns an error', async () => {
      const supabaseError = { message: 'Query failed', code: '500' };
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getDocumentBySlug } = useArchiveDocuments();
      const result = await getDocumentBySlug('bad-slug');

      expect(result).toBeNull();
    });
  });

  describe('getCollectionBySlug()', () => {
    it('queries document_collections by slug with approved status', async () => {
      const collection = makeCollectionRow();
      // First call for collection lookup
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: collection, error: null });
      // Second call chain for documents query (uses .then)
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getCollectionBySlug } = useArchiveDocuments();
      await getCollectionBySlug('workshop-manuals');

      expect(mockSupabase.from).toHaveBeenCalledWith('document_collections');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('slug', 'workshop-manuals');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('returns null when collection is not found', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getCollectionBySlug } = useArchiveDocuments();
      const result = await getCollectionBySlug('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null when Supabase returns an error for collection', async () => {
      const supabaseError = { message: 'Query failed', code: '500' };
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getCollectionBySlug } = useArchiveDocuments();
      const result = await getCollectionBySlug('bad-slug');

      expect(result).toBeNull();
    });

    it('fetches and returns documents for the collection', async () => {
      const collection = {
        id: 'col-1',
        slug: 'workshop-manuals',
        type: 'manual',
        title: 'Workshop Manuals',
        description: 'A collection',
        thumbnail_path: 'collections/thumb.jpg',
        status: 'approved',
      };
      const docs = [
        makeDocRow({ id: 'doc-1', title: 'Manual 1', slug: 'manual-1' }),
        makeDocRow({ id: 'doc-2', title: 'Manual 2', slug: 'manual-2' }),
      ];

      // First: collection lookup via maybeSingle
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: collection, error: null });
      // Second: documents query via implicit await (.then)
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: docs, error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getCollectionBySlug } = useArchiveDocuments();
      const result = await getCollectionBySlug('workshop-manuals');

      expect(result).not.toBeNull();
      expect(result!.collection.id).toBe('col-1');
      expect(result!.collection.title).toBe('Workshop Manuals');
      expect(result!.collection.itemCount).toBe(2);
      expect(result!.documents).toHaveLength(2);
      expect(result!.documents[0].title).toBe('Manual 1');
      expect(result!.documents[1].title).toBe('Manual 2');
    });

    it('queries documents by collection_id with approved status and sort_order', async () => {
      const collection = {
        id: 'col-99',
        slug: 'test-col',
        type: 'manual',
        title: 'Test',
        description: null,
        thumbnail_path: null,
        status: 'approved',
      };

      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: collection, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getCollectionBySlug } = useArchiveDocuments();
      await getCollectionBySlug('test-col');

      // Should query archive_documents for the collection
      expect(mockSupabase.from).toHaveBeenCalledWith('archive_documents');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('collection_id', 'col-99');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('sort_order');
    });

    it('returns itemCount 0 when no documents found (null data)', async () => {
      const collection = {
        id: 'col-1',
        slug: 'empty-col',
        type: 'manual',
        title: 'Empty',
        description: null,
        thumbnail_path: null,
        status: 'approved',
      };

      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: collection, error: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { getCollectionBySlug } = useArchiveDocuments();
      const result = await getCollectionBySlug('empty-col');

      expect(result).not.toBeNull();
      expect(result!.collection.itemCount).toBe(0);
      expect(result!.documents).toEqual([]);
    });
  });

  describe('submitDocument()', () => {
    it('throws if user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { submitDocument } = useArchiveDocuments();

      await expect(submitDocument({ type: 'manual', title: 'Test Manual' })).rejects.toThrow(
        'Must be authenticated to submit'
      );
    });

    it('inserts into submission_queue with correct fields when authenticated', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { id: 'sub-1' }, error: null });

      const documentData = {
        type: 'manual' as const,
        title: 'Cooper S Workshop Manual',
        description: 'Detailed repair guide',
        code: 'AKD4935',
      };

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { submitDocument } = useArchiveDocuments();
      const result = await submitDocument(documentData);

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        type: 'new_item',
        target_type: 'document',
        submitted_by: 'test-user-id',
        status: 'pending',
        data: documentData,
      });
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('id');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual({ id: 'sub-1' });
    });

    it('throws when Supabase returns an error on insert', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Insert failed', code: '23505' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { submitDocument } = useArchiveDocuments();

      await expect(submitDocument({ type: 'manual', title: 'Test' })).rejects.toEqual(supabaseError);
    });

    it('passes all optional fields in the data payload', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: { id: 'sub-2' }, error: null });

      const fullData = {
        type: 'tuning' as const,
        title: 'Tuning Guide',
        description: 'Performance tuning',
        code: 'TUN-001',
        author: 'John Cooper',
        year: 1965,
        filePath: 'tuning/guide.pdf',
        thumbnailPath: 'tuning/thumb.jpg',
      };

      const { useArchiveDocuments } = await import('~/app/composables/useArchiveDocuments');
      const { submitDocument } = useArchiveDocuments();
      await submitDocument(fullData);

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.data).toEqual(fullData);
      expect(insertArg.target_type).toBe('document');
      expect(insertArg.type).toBe('new_item');
      expect(insertArg.status).toBe('pending');
      expect(insertArg.submitted_by).toBe('test-user-id');
    });
  });
});

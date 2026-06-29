import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const mockPhoto = {
  id: 'photo-1',
  listing_id: 'listing-1',
  storage_path: 'test-user-id/listing-1/body/12345-abc123.webp',
  category: 'body',
  display_order: 0,
  caption: 'Front view',
  is_primary: true,
  created_at: new Date().toISOString(),
};

const mockPhotos = [
  mockPhoto,
  {
    id: 'photo-2',
    listing_id: 'listing-1',
    storage_path: 'test-user-id/listing-1/engine/12346-def456.webp',
    category: 'engine',
    display_order: 0,
    caption: 'Engine bay',
    is_primary: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'photo-3',
    listing_id: 'listing-1',
    storage_path: 'test-user-id/listing-1/interior/12347-ghi789.webp',
    category: 'interior',
    display_order: 0,
    caption: null,
    is_primary: false,
    created_at: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

// Default storage handles, re-created each test so call assertions are isolated.
let mockUpload: ReturnType<typeof vi.fn>;
let mockRemove: ReturnType<typeof vi.fn>;
let mockGetPublicUrl: ReturnType<typeof vi.fn>;

const installStorage = () => {
  mockUpload = vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null });
  mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
  mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/mock-url' } });
  mockSupabase.storage.from = vi.fn(() => ({
    upload: mockUpload,
    remove: mockRemove,
    getPublicUrl: mockGetPublicUrl,
  })) as any;
};

// Helper: drive any builder awaited *without* a terminator (.single()) — count
// queries, list .order() queries, and delete/update .eq() chains all resolve
// through queryBuilder.then.
const resolveBuilderWith = (result: any) => {
  mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve(result));
};

// Auto-import after globals are stubbed (matches sibling exchange tests).
const getUseListingPhotos = async () => {
  const { useListingPhotos } = await import('~/app/composables/useListingPhotos');
  return useListingPhotos;
};

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  // setupGlobalMocks stubs useAuth (authenticated) + useSupabase; pass our
  // pre-built client so per-test overrides land on the same instance.
  setupGlobalMocks({ user: createMockUser(), supabase: mockSupabase });
  installStorage();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanupGlobalMocks();
  vi.restoreAllMocks();
});

describe('useListingPhotos', () => {
  // -------------------------------------------------------------------------
  // uploadPhoto()
  // -------------------------------------------------------------------------
  describe('uploadPhoto()', () => {
    const mockFile = new File(['test content'], 'test-photo.jpg', { type: 'image/jpeg' });

    it('throws when user is not authenticated', async () => {
      setupGlobalMocks({ user: null, supabase: mockSupabase });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await expect(uploadPhoto(mockFile, 'listing-1', 'body', 0)).rejects.toThrow(
        'User must be authenticated to upload photos'
      );
    });

    it('uploads to the listing-photos bucket and inserts a DB record', async () => {
      // No existing primary → count query returns 0.
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      const result = await uploadPhoto(mockFile, 'listing-1', 'body', 0, 'Front view');

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('listing-photos');
      expect(mockUpload).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase._mockInsert).toHaveBeenCalled();
      expect(result).toEqual(mockPhoto);
    });

    it('generates a storage path of {userId}/{listingId}/{category}/{file}', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'engine', 1);

      const storagePath = mockUpload.mock.calls[0][0];
      expect(storagePath).toContain('test-user-id');
      expect(storagePath).toContain('listing-1');
      expect(storagePath).toContain('engine');
      expect(storagePath).toMatch(/\.jpg$/);
      // Path layout: userId/listingId/category/filename
      expect(storagePath).toMatch(/^test-user-id\/listing-1\/engine\//);
    });

    it('preserves the original file extension in the storage path', async () => {
      const pngFile = new File(['x'], 'photo.PNG', { type: 'image/png' });
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(pngFile, 'listing-1', 'body', 0);

      expect(mockUpload.mock.calls[0][0]).toMatch(/\.png$/);
    });

    it('falls back to a webp extension only when split yields an empty ext (trailing dot)', async () => {
      // `name.split('.').pop()` is '' for a trailing-dot name → `|| 'webp'` fires.
      const trailingDot = new File(['x'], 'photo.', { type: 'image/webp' });
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(trailingDot, 'listing-1', 'body', 0);

      expect(mockUpload.mock.calls[0][0]).toMatch(/\.webp$/);
    });

    it('uses the trailing token as the extension for a name with no dot', async () => {
      // `'photo'.split('.').pop()` is 'photo' (truthy) so it is used verbatim —
      // documents that uploadPhoto does NOT re-validate the extension (the
      // validate/optimize gate lives in prepareFileForUpload, not here).
      const noDot = new File(['x'], 'photo', { type: 'image/webp' });
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(noDot, 'listing-1', 'body', 0);

      expect(mockUpload.mock.calls[0][0]).toMatch(/\.photo$/);
    });

    it('uploads with cacheControl 3600 and upsert false', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'body', 0);

      const options = mockUpload.mock.calls[0][2];
      expect(options.cacheControl).toBe('3600');
      expect(options.upsert).toBe(false);
    });

    it('persists category, display_order, and caption in the inserted record', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'interior', 7, 'Beautiful interior');

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.listing_id).toBe('listing-1');
      expect(insertArg.category).toBe('interior');
      expect(insertArg.display_order).toBe(7);
      expect(insertArg.caption).toBe('Beautiful interior');
    });

    it('marks the photo primary when no primary exists (count === 0)', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'body', 0);

      expect(mockSupabase._mockInsert.mock.calls[0][0].is_primary).toBe(true);
    });

    it('does NOT mark the photo primary when a primary already exists (count > 0)', async () => {
      resolveBuilderWith({ count: 1 });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'body', 0);

      expect(mockSupabase._mockInsert.mock.calls[0][0].is_primary).toBe(false);
    });

    it('treats a null count as "no primary" and marks the photo primary', async () => {
      resolveBuilderWith({ count: null });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'body', 0);

      expect(mockSupabase._mockInsert.mock.calls[0][0].is_primary).toBe(true);
    });

    it('honors an explicit isPrimary=true, skipping the count query entirely', async () => {
      const thenSpy = vi.fn((resolve: any) => resolve({ count: 99 }));
      mockSupabase._queryBuilder.then = thenSpy;
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'body', 0, undefined, true);

      // count query short-circuited → builder never awaited for the count path
      expect(thenSpy).not.toHaveBeenCalled();
      expect(mockSupabase._mockInsert.mock.calls[0][0].is_primary).toBe(true);
    });

    it('honors an explicit isPrimary=false, skipping the count query entirely', async () => {
      const thenSpy = vi.fn((resolve: any) => resolve({ count: 0 }));
      mockSupabase._queryBuilder.then = thenSpy;
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await uploadPhoto(mockFile, 'listing-1', 'body', 0, undefined, false);

      expect(thenSpy).not.toHaveBeenCalled();
      expect(mockSupabase._mockInsert.mock.calls[0][0].is_primary).toBe(false);
    });

    it('throws when storage upload fails (and does not insert)', async () => {
      mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'Storage quota exceeded' } });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await expect(uploadPhoto(mockFile, 'listing-1', 'body', 0)).rejects.toThrow(
        'Failed to upload photo: Storage quota exceeded'
      );
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    });

    it('rolls back the storage upload (remove) when the DB insert fails', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database constraint violation' },
      });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhoto } = useListingPhotos();

      await expect(uploadPhoto(mockFile, 'listing-1', 'body', 0)).rejects.toThrow(
        'Failed to save photo record: Database constraint violation'
      );

      expect(mockRemove).toHaveBeenCalledWith([expect.stringContaining('test-user-id')]);
    });
  });

  // -------------------------------------------------------------------------
  // uploadPhotos() — batch
  // -------------------------------------------------------------------------
  describe('uploadPhotos() batch', () => {
    const mockFiles = [
      new File(['a'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'photo2.jpg', { type: 'image/jpeg' }),
      new File(['c'], 'photo3.jpg', { type: 'image/jpeg' }),
    ];

    it('uploads every file and inserts a record for each', async () => {
      // Batch checks primary count once up front via builder.then.
      resolveBuilderWith({ count: 0 });
      let n = 0;
      mockSupabase._mockSingle.mockImplementation(() =>
        Promise.resolve({ data: { ...mockPhoto, id: `photo-${++n}` }, error: null })
      );

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhotos } = useListingPhotos();

      const results = await uploadPhotos(mockFiles, 'listing-1', 'body');

      expect(results).toHaveLength(3);
      expect(mockUpload).toHaveBeenCalledTimes(3);
      expect(mockSupabase._mockInsert).toHaveBeenCalledTimes(3);
    });

    it('assigns sequential display_order values by index', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhotos } = useListingPhotos();

      await uploadPhotos(mockFiles, 'listing-1', 'body');

      const orders = mockSupabase._mockInsert.mock.calls.map((c) => c[0].display_order);
      expect(orders).toEqual([0, 1, 2]);
    });

    it('applies captions to the corresponding photos by index', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhotos } = useListingPhotos();

      await uploadPhotos(mockFiles, 'listing-1', 'body', ['First', 'Second', 'Third']);

      const captions = mockSupabase._mockInsert.mock.calls.map((c) => c[0].caption);
      expect(captions).toEqual(['First', 'Second', 'Third']);
    });

    it('marks ONLY the first photo primary when the listing has no primary yet', async () => {
      resolveBuilderWith({ count: 0 });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhotos } = useListingPhotos();

      await uploadPhotos(mockFiles, 'listing-1', 'body');

      const primaries = mockSupabase._mockInsert.mock.calls.map((c) => c[0].is_primary);
      expect(primaries).toEqual([true, false, false]);
    });

    it('marks NO photo primary when the listing already has a primary', async () => {
      resolveBuilderWith({ count: 2 });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhotos } = useListingPhotos();

      await uploadPhotos(mockFiles, 'listing-1', 'body');

      const primaries = mockSupabase._mockInsert.mock.calls.map((c) => c[0].is_primary);
      expect(primaries).toEqual([false, false, false]);
    });

    it('rejects when any individual upload fails', async () => {
      resolveBuilderWith({ count: 0 });
      let uploadCount = 0;
      mockUpload.mockImplementation(() => {
        uploadCount++;
        if (uploadCount === 2) {
          return Promise.resolve({ data: null, error: { message: 'Upload failed' } });
        }
        return Promise.resolve({ data: { path: 'mock-path' }, error: null });
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockPhoto, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { uploadPhotos } = useListingPhotos();

      await expect(uploadPhotos(mockFiles, 'listing-1', 'body')).rejects.toThrow('Failed to upload photo');
    });
  });

  // -------------------------------------------------------------------------
  // deletePhoto()
  // -------------------------------------------------------------------------
  describe('deletePhoto()', () => {
    it('deletes the DB record by id then removes the storage file', async () => {
      resolveBuilderWith({ error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { deletePhoto } = useListingPhotos();

      await deletePhoto('photo-1', 'test-user-id/listing-1/body/file.webp');

      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase._mockDelete).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'photo-1');
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('listing-photos');
      expect(mockRemove).toHaveBeenCalledWith(['test-user-id/listing-1/body/file.webp']);
    });

    it('throws and does NOT touch storage when the DB delete fails', async () => {
      resolveBuilderWith({ error: { message: 'Delete not allowed' } });

      const useListingPhotos = await getUseListingPhotos();
      const { deletePhoto } = useListingPhotos();

      await expect(deletePhoto('photo-1', 'storage-path')).rejects.toThrow(
        'Failed to delete photo record: Delete not allowed'
      );
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('does not throw (only logs) when storage removal fails after a successful DB delete', async () => {
      resolveBuilderWith({ error: null });
      mockRemove.mockResolvedValueOnce({ data: null, error: { message: 'Storage error' } });

      const useListingPhotos = await getUseListingPhotos();
      const { deletePhoto } = useListingPhotos();

      await expect(deletePhoto('photo-1', 'storage-path')).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith('Failed to delete from storage:', { message: 'Storage error' });
    });
  });

  // -------------------------------------------------------------------------
  // getPhotoUrl()
  // -------------------------------------------------------------------------
  describe('getPhotoUrl()', () => {
    it('returns the public URL for a storage path', async () => {
      const expectedUrl = 'https://example.com/storage/v1/listing-photos/test-path';
      mockGetPublicUrl.mockReturnValueOnce({ data: { publicUrl: expectedUrl } });

      const useListingPhotos = await getUseListingPhotos();
      const { getPhotoUrl } = useListingPhotos();

      const result = getPhotoUrl('test-path');

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('listing-photos');
      expect(mockGetPublicUrl).toHaveBeenCalledWith('test-path');
      expect(result).toBe(expectedUrl);
    });
  });

  // -------------------------------------------------------------------------
  // getListingPhotos()
  // -------------------------------------------------------------------------
  describe('getListingPhotos()', () => {
    it('fetches all photos for a listing ordered by category then display_order', async () => {
      resolveBuilderWith({ data: mockPhotos, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { getListingPhotos } = useListingPhotos();

      const result = await getListingPhotos('listing-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('listing_id', 'listing-1');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('category');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('display_order');
      expect(result).toEqual(mockPhotos);
    });

    it('returns an empty array when the listing has no photos', async () => {
      resolveBuilderWith({ data: [], error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { getListingPhotos } = useListingPhotos();

      const result = await getListingPhotos('listing-1');
      expect(result).toEqual([]);
    });

    it('throws when the fetch errors', async () => {
      resolveBuilderWith({ data: null, error: { message: 'Database error' } });

      const useListingPhotos = await getUseListingPhotos();
      const { getListingPhotos } = useListingPhotos();

      await expect(getListingPhotos('listing-1')).rejects.toThrow('Failed to fetch photos: Database error');
    });
  });

  // -------------------------------------------------------------------------
  // getPhotosByCategory()
  // -------------------------------------------------------------------------
  describe('getPhotosByCategory()', () => {
    it('fetches photos for a specific category ordered by display_order', async () => {
      const bodyPhotos = mockPhotos.filter((p) => p.category === 'body');
      resolveBuilderWith({ data: bodyPhotos, error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { getPhotosByCategory } = useListingPhotos();

      const result = await getPhotosByCategory('listing-1', 'body');

      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('listing_id', 'listing-1');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('category', 'body');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('display_order');
      expect(result).toEqual(bodyPhotos);
    });

    it('throws when the fetch errors', async () => {
      resolveBuilderWith({ data: null, error: { message: 'Not found' } });

      const useListingPhotos = await getUseListingPhotos();
      const { getPhotosByCategory } = useListingPhotos();

      await expect(getPhotosByCategory('listing-1', 'engine')).rejects.toThrow('Failed to fetch photos: Not found');
    });
  });

  // -------------------------------------------------------------------------
  // updatePhotoOrder()
  // -------------------------------------------------------------------------
  describe('updatePhotoOrder()', () => {
    it('updates display_order for a photo filtered by id', async () => {
      resolveBuilderWith({ error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { updatePhotoOrder } = useListingPhotos();

      await updatePhotoOrder('photo-1', 5);

      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ display_order: 5 });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'photo-1');
    });

    it('throws when the update errors', async () => {
      resolveBuilderWith({ error: { message: 'Update failed' } });

      const useListingPhotos = await getUseListingPhotos();
      const { updatePhotoOrder } = useListingPhotos();

      await expect(updatePhotoOrder('photo-1', 5)).rejects.toThrow('Failed to update photo order: Update failed');
    });
  });

  // -------------------------------------------------------------------------
  // setPrimaryPhoto()
  // -------------------------------------------------------------------------
  describe('setPrimaryPhoto()', () => {
    it('unsets every primary for the listing, then sets the new primary by id', async () => {
      resolveBuilderWith({ error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { setPrimaryPhoto } = useListingPhotos();

      await setPrimaryPhoto('listing-1', 'photo-2');

      // First update unsets all for the listing; second sets the target.
      expect(mockSupabase._mockUpdate).toHaveBeenNthCalledWith(1, { is_primary: false });
      expect(mockSupabase._mockUpdate).toHaveBeenNthCalledWith(2, { is_primary: true });
      const eqCalls = mockSupabase._queryBuilder.eq.mock.calls;
      expect(eqCalls).toContainEqual(['listing_id', 'listing-1']);
      expect(eqCalls).toContainEqual(['id', 'photo-2']);
    });

    it('throws when setting the new primary fails (second update)', async () => {
      // First await (unset all) resolves OK; second (set primary) errors.
      let call = 0;
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => {
        call++;
        return resolve(call >= 2 ? { error: { message: 'Constraint error' } } : { error: null });
      });

      const useListingPhotos = await getUseListingPhotos();
      const { setPrimaryPhoto } = useListingPhotos();

      await expect(setPrimaryPhoto('listing-1', 'photo-2')).rejects.toThrow(
        'Failed to set primary photo: Constraint error'
      );
    });
  });

  // -------------------------------------------------------------------------
  // updatePhotoCaption()
  // -------------------------------------------------------------------------
  describe('updatePhotoCaption()', () => {
    it('updates the caption for a photo filtered by id', async () => {
      resolveBuilderWith({ error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { updatePhotoCaption } = useListingPhotos();

      await updatePhotoCaption('photo-1', 'New caption');

      expect(mockSupabase.from).toHaveBeenCalledWith('listing_photos');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ caption: 'New caption' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'photo-1');
    });

    it('allows an empty caption', async () => {
      resolveBuilderWith({ error: null });

      const useListingPhotos = await getUseListingPhotos();
      const { updatePhotoCaption } = useListingPhotos();

      await updatePhotoCaption('photo-1', '');

      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ caption: '' });
    });

    it('throws when the update errors', async () => {
      resolveBuilderWith({ error: { message: 'Caption too long' } });

      const useListingPhotos = await getUseListingPhotos();
      const { updatePhotoCaption } = useListingPhotos();

      await expect(updatePhotoCaption('photo-1', 'x')).rejects.toThrow('Failed to update caption: Caption too long');
    });
  });

  // -------------------------------------------------------------------------
  // prepareFileForUpload() — validation gate + optimizer delegation
  // -------------------------------------------------------------------------
  describe('prepareFileForUpload()', () => {
    it('rejects a disallowed MIME type before optimizing', async () => {
      const useListingPhotos = await getUseListingPhotos();
      const { prepareFileForUpload } = useListingPhotos();

      const gif = new File(['x'], 'anim.gif', { type: 'image/gif' });
      await expect(prepareFileForUpload(gif)).rejects.toThrow(/is not allowed/);
    });

    it('rejects a file with no extension', async () => {
      const useListingPhotos = await getUseListingPhotos();
      const { prepareFileForUpload } = useListingPhotos();

      // Empty type so the extension check is reached (MIME check allows empty).
      const noExt = new File(['x'], 'noextension', { type: '' });
      await expect(prepareFileForUpload(noExt)).rejects.toThrow(/no extension/);
    });

    it('rejects a disallowed extension even with an acceptable MIME', async () => {
      const useListingPhotos = await getUseListingPhotos();
      const { prepareFileForUpload } = useListingPhotos();

      // Empty MIME passes the type gate; .bmp fails the extension allowlist.
      const bmp = new File(['x'], 'image.bmp', { type: '' });
      await expect(prepareFileForUpload(bmp)).rejects.toThrow(/extension .bmp is not allowed/);
    });

    it('delegates to the image optimizer for a valid file and returns its result', async () => {
      const optimizeResult = {
        file: new File(['opt'], 'photo.webp', { type: 'image/webp' }),
        preview: 'data:image/webp;base64,xxx',
        originalSize: 1000,
        optimizedSize: 500,
        wasOptimized: true,
      };
      const onProgress = vi.fn();
      vi.doMock('~/utils/imageOptimizer', async () => {
        const actual = await vi.importActual<any>('~/utils/imageOptimizer');
        return { ...actual, optimizeImage: vi.fn().mockResolvedValue(optimizeResult) };
      });

      const useListingPhotos = await getUseListingPhotos();
      const { prepareFileForUpload } = useListingPhotos();

      const valid = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
      const result = await prepareFileForUpload(valid, onProgress);

      expect(result).toEqual(optimizeResult);

      vi.doUnmock('~/utils/imageOptimizer');
    });
  });

  // -------------------------------------------------------------------------
  // Re-exported utilities
  // -------------------------------------------------------------------------
  describe('re-exported utilities', () => {
    it('re-exports formatFileSize that formats byte counts', async () => {
      const useListingPhotos = await getUseListingPhotos();
      const { formatFileSize } = useListingPhotos();

      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(3 * 1024 * 1024)).toBe('3.00 MB');
    });

    it('re-exports isHeicFile that detects HEIC/HEIF by type or extension', async () => {
      const useListingPhotos = await getUseListingPhotos();
      const { isHeicFile } = useListingPhotos();

      expect(isHeicFile(new File(['x'], 'p.heic', { type: 'image/heic' }))).toBe(true);
      expect(isHeicFile(new File(['x'], 'p.HEIF', { type: '' }))).toBe(true);
      expect(isHeicFile(new File(['x'], 'p.jpg', { type: 'image/jpeg' }))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Return value shape
  // -------------------------------------------------------------------------
  describe('return value structure', () => {
    it('exposes every documented method and utility', async () => {
      const useListingPhotos = await getUseListingPhotos();
      const api = useListingPhotos();

      const expected = [
        'prepareFileForUpload',
        'uploadPhoto',
        'uploadPhotos',
        'deletePhoto',
        'getPhotoUrl',
        'getListingPhotos',
        'getPhotosByCategory',
        'updatePhotoOrder',
        'setPrimaryPhoto',
        'updatePhotoCaption',
        'formatFileSize',
        'isHeicFile',
      ];
      for (const key of expected) {
        expect(api).toHaveProperty(key);
        expect(typeof (api as any)[key]).toBe('function');
      }
    });
  });
});

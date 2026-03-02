import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'test-key' },
  }));
});

afterEach(() => {
  cleanupGlobalMocks();
});

const makeWheelRow = (overrides: Record<string, any> = {}) => ({
  id: 'wheel-1',
  name: 'Minilite',
  wheel_type: 'Alloy',
  size: 10,
  width: '5J',
  offset_value: 'ET0',
  notes: 'Classic look',
  legacy_submitted_by: 'TestUser',
  legacy_submitted_by_email: 'test@example.com',
  manufacturer: 'Minilite',
  bolt_pattern: '4x101.6',
  center_bore: '56.7mm',
  weight: '4.5kg',
  photos: ['wheels/photo1.jpg', 'wheels/photo2.jpg'],
  status: 'approved',
  ...overrides,
});

describe('useWheels', () => {
  describe('getPhotoUrl', () => {
    it('returns empty string for empty path', async () => {
      const { useWheels } = await import('~/app/composables/useWheels');
      const { getPhotoUrl } = useWheels();
      expect(getPhotoUrl('')).toBe('');
    });

    it('returns the URL unchanged if it already starts with http', async () => {
      const { useWheels } = await import('~/app/composables/useWheels');
      const { getPhotoUrl } = useWheels();
      expect(getPhotoUrl('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
    });

    it('returns the URL unchanged for http:// URLs', async () => {
      const { useWheels } = await import('~/app/composables/useWheels');
      const { getPhotoUrl } = useWheels();
      expect(getPhotoUrl('http://cdn.example.com/photo.jpg')).toBe('http://cdn.example.com/photo.jpg');
    });

    it('builds a full storage URL for relative paths', async () => {
      const { useWheels } = await import('~/app/composables/useWheels');
      const { getPhotoUrl } = useWheels();
      expect(getPhotoUrl('wheels/photo1.jpg')).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-wheels/wheels/photo1.jpg'
      );
    });
  });

  describe('listAll', () => {
    it('queries the wheels table with status=approved and orders by name', async () => {
      const rows = [makeWheelRow({ id: 'w1', name: 'Alpha' }), makeWheelRow({ id: 'w2', name: 'Beta' })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listAll } = useWheels();
      const result = await listAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('wheels');
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('name');
      expect(result).toHaveLength(2);
      expect(result[0].uuid).toBe('w1');
      expect(result[1].uuid).toBe('w2');
    });

    it('maps Supabase rows to IWheelsData correctly', async () => {
      const row = makeWheelRow();
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listAll } = useWheels();
      const result = await listAll();

      expect(result).toHaveLength(1);
      const wheel = result[0];
      expect(wheel.uuid).toBe('wheel-1');
      expect(wheel.name).toBe('Minilite');
      expect(wheel.type).toBe('Alloy');
      expect(wheel.size).toBe('10');
      expect(wheel.width).toBe('5J');
      expect(wheel.offset).toBe('ET0');
      expect(wheel.notes).toBe('Classic look');
      expect(wheel.userName).toBe('TestUser');
      expect(wheel.emailAddress).toBe('test@example.com');
      expect(wheel.referral).toBe('');
      expect(wheel.manufacturer).toBe('Minilite');
      expect(wheel.boltPattern).toBe('4x101.6');
      expect(wheel.centerBore).toBe('56.7mm');
      expect(wheel.weight).toBe('4.5kg');
      expect(wheel.images).toHaveLength(2);
      expect(wheel.images![0].src).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-wheels/wheels/photo1.jpg'
      );
      expect(wheel.images![1].src).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-wheels/wheels/photo2.jpg'
      );
    });

    it('returns empty array when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listAll } = useWheels();
      const result = await listAll();

      expect(result).toEqual([]);
    });

    it('throws on Supabase error', async () => {
      const supaError = { message: 'DB failure', code: '42P01' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: supaError }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listAll } = useWheels();

      await expect(listAll()).rejects.toEqual(supaError);
    });

    it('handles rows with missing optional fields gracefully', async () => {
      const sparseRow = {
        id: 'sparse-1',
        name: null,
        wheel_type: null,
        size: null,
        width: null,
        offset_value: null,
        notes: null,
        legacy_submitted_by: null,
        legacy_submitted_by_email: null,
        manufacturer: null,
        bolt_pattern: null,
        center_bore: null,
        weight: null,
        photos: null,
      };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [sparseRow], error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listAll } = useWheels();
      const result = await listAll();

      const wheel = result[0];
      expect(wheel.uuid).toBe('sparse-1');
      expect(wheel.name).toBe('');
      expect(wheel.type).toBe('');
      expect(wheel.size).toBe('');
      expect(wheel.width).toBe('');
      expect(wheel.offset).toBe('');
      expect(wheel.notes).toBe('');
      expect(wheel.userName).toBe('');
      expect(wheel.emailAddress).toBe('');
      expect(wheel.manufacturer).toBe('');
      expect(wheel.boltPattern).toBe('');
      expect(wheel.centerBore).toBe('');
      expect(wheel.weight).toBe('');
      expect(wheel.images).toEqual([]);
    });
  });

  describe('listBySize', () => {
    it('queries the wheels table filtered by size', async () => {
      const rows = [makeWheelRow({ id: 'w10', size: 10 })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySize } = useWheels();
      const result = await listBySize(10);

      expect(mockSupabase.from).toHaveBeenCalledWith('wheels');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('size', 10);
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('name');
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('w10');
    });

    it('returns empty array when no wheels match the size', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySize } = useWheels();
      const result = await listBySize(15);

      expect(result).toEqual([]);
    });

    it('throws on Supabase error', async () => {
      const supaError = { message: 'Connection lost', code: '08006' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: supaError }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySize } = useWheels();

      await expect(listBySize(10)).rejects.toEqual(supaError);
    });
  });

  describe('listBySizeName', () => {
    it('maps "ten" to size 10', async () => {
      const rows = [makeWheelRow({ id: 'w10', size: 10 })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySizeName } = useWheels();
      const result = await listBySizeName('ten');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('size', 10);
      expect(result).toHaveLength(1);
    });

    it('maps "twelve" to size 12', async () => {
      const rows = [makeWheelRow({ id: 'w12', size: 12 })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySizeName } = useWheels();
      const result = await listBySizeName('twelve');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('size', 12);
      expect(result).toHaveLength(1);
    });

    it('maps "thirteen" to size 13', async () => {
      const rows = [makeWheelRow({ id: 'w13', size: 13 })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySizeName } = useWheels();
      const result = await listBySizeName('thirteen');

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('size', 13);
      expect(result).toHaveLength(1);
    });

    it('returns all wheels when sizeName is "list"', async () => {
      const rows = [
        makeWheelRow({ id: 'w1', size: 10 }),
        makeWheelRow({ id: 'w2', size: 12 }),
        makeWheelRow({ id: 'w3', size: 13 }),
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySizeName } = useWheels();
      const result = await listBySizeName('list');

      // Should call listAll (no size filter), just status=approved
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(result).toHaveLength(3);
    });

    it('falls back to listAll for unknown size names', async () => {
      const rows = [makeWheelRow({ id: 'w1' })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySizeName } = useWheels();
      const result = await listBySizeName('fourteen');

      // Should call listAll (no size filter)
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(result).toHaveLength(1);
    });

    it('falls back to listAll for empty string', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));

      const { useWheels } = await import('~/app/composables/useWheels');
      const { listBySizeName } = useWheels();
      const result = await listBySizeName('');

      expect(result).toEqual([]);
    });
  });

  describe('getWheel', () => {
    it('fetches a single wheel by id', async () => {
      const row = makeWheelRow({ id: 'wheel-42' });
      mockSupabase._mockSingle.mockResolvedValue({ data: row, error: null });

      const { useWheels } = await import('~/app/composables/useWheels');
      const { getWheel } = useWheels();
      const result = await getWheel('wheel-42');

      expect(mockSupabase.from).toHaveBeenCalledWith('wheels');
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wheel-42');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result!.uuid).toBe('wheel-42');
      expect(result!.name).toBe('Minilite');
    });

    it('does not filter by status', async () => {
      const row = makeWheelRow({ id: 'wheel-pending', status: 'pending' });
      mockSupabase._mockSingle.mockResolvedValue({ data: row, error: null });

      const { useWheels } = await import('~/app/composables/useWheels');
      const { getWheel } = useWheels();
      const result = await getWheel('wheel-pending');

      // eq should only be called with 'id', not 'status'
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledTimes(1);
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'wheel-pending');
      expect(result).not.toBeNull();
    });

    it('returns null when Supabase returns an error', async () => {
      mockSupabase._mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const { useWheels } = await import('~/app/composables/useWheels');
      const { getWheel } = useWheels();
      const result = await getWheel('nonexistent');

      expect(result).toBeNull();
    });

    it('maps the fetched row to IWheelsData', async () => {
      const row = makeWheelRow({
        id: 'w-mapped',
        name: 'Cosmic',
        wheel_type: 'Steel',
        size: 12,
        width: '4.5J',
        offset_value: 'ET+10',
        photos: ['cosmic/front.jpg'],
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: row, error: null });

      const { useWheels } = await import('~/app/composables/useWheels');
      const { getWheel } = useWheels();
      const result = await getWheel('w-mapped');

      expect(result!.uuid).toBe('w-mapped');
      expect(result!.name).toBe('Cosmic');
      expect(result!.type).toBe('Steel');
      expect(result!.size).toBe('12');
      expect(result!.width).toBe('4.5J');
      expect(result!.offset).toBe('ET+10');
      expect(result!.images).toHaveLength(1);
      expect(result!.images![0].src).toContain('cosmic/front.jpg');
    });
  });

  describe('submitWheel', () => {
    it('throws if user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useWheels } = await import('~/app/composables/useWheels');
      const { submitWheel } = useWheels();

      await expect(submitWheel({ name: 'Test Wheel' })).rejects.toThrow('Must be authenticated to submit');
    });

    it('inserts into submission_queue when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const submittedData = { id: 'sub-1', type: 'new_item', target_type: 'wheel', status: 'pending' };
      mockSupabase._mockSingle.mockResolvedValue({ data: submittedData, error: null });

      const { useWheels } = await import('~/app/composables/useWheels');
      const { submitWheel } = useWheels();

      const wheelData = { name: 'Revolution', type: 'Alloy', size: '13' };
      const result = await submitWheel(wheelData);

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._queryBuilder.insert).toHaveBeenCalledWith({
        type: 'new_item',
        target_type: 'wheel',
        submitted_by: 'user-123',
        status: 'pending',
        data: wheelData,
      });
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(submittedData);
    });

    it('throws on Supabase insert error', async () => {
      const mockUser = { id: 'user-456', email: 'user@example.com' };
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const insertError = { message: 'Permission denied', code: '42501' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: insertError });

      const { useWheels } = await import('~/app/composables/useWheels');
      const { submitWheel } = useWheels();

      await expect(submitWheel({ name: 'Bad Wheel' })).rejects.toEqual(insertError);
    });
  });
});

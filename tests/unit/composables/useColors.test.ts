import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

const mockColorRow = {
  id: 'color-1',
  name: 'Almond Green',
  code: 'GN37',
  short_code: 'AG',
  ditzler_ppg_code: '43592',
  dulux_code: '6G-013',
  hex_value: '#5A7247',
  year_start: 1960,
  year_end: 1967,
  has_swatch: true,
  swatch_path: 'swatches/almond-green.png',
  contributor_images: [{ url: 'https://example.com/img.jpg', contributor: 'testuser' }],
  status: 'approved',
};

const mockColorRow2 = {
  id: 'color-2',
  name: 'Tartan Red',
  code: 'RD16',
  short_code: 'TR',
  ditzler_ppg_code: '70831',
  dulux_code: '2R-012',
  hex_value: '#C41E3A',
  year_start: 1961,
  year_end: 1970,
  has_swatch: false,
  swatch_path: null,
  contributor_images: [],
  status: 'approved',
};

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

describe('useColors', () => {
  describe('getSwatchUrl', () => {
    it('returns empty string for null path', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();

      expect(getSwatchUrl(null)).toBe('');
    });

    it('returns empty string for empty string path', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();

      expect(getSwatchUrl('')).toBe('');
    });

    it('returns the path as-is when it starts with http', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();

      const url = 'https://cdn.example.com/swatch.png';
      expect(getSwatchUrl(url)).toBe(url);
    });

    it('returns the path as-is when it starts with http (not https)', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();

      const url = 'http://cdn.example.com/swatch.png';
      expect(getSwatchUrl(url)).toBe(url);
    });

    it('builds a Supabase storage URL for relative paths', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();

      expect(getSwatchUrl('swatches/almond-green.png')).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-colors/swatches/almond-green.png',
      );
    });

    it('handles paths without subdirectories', async () => {
      const { useColors } = await import('~/app/composables/useColors');
      const { getSwatchUrl } = useColors();

      expect(getSwatchUrl('swatch.png')).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-colors/swatch.png',
      );
    });
  });

  describe('listColors', () => {
    it('queries the colors table with status approved and ordered by name', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [mockColorRow, mockColorRow2], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(mockSupabase.from).toHaveBeenCalledWith('colors');
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('name');
      expect(result).toHaveLength(2);
    });

    it('maps database rows to Color objects correctly', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [mockColorRow], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0]).toEqual({
        id: 'color-1',
        name: 'Almond Green',
        code: 'GN37',
        shortCode: 'AG',
        ditzlerPpgCode: '43592',
        duluxCode: '6G-013',
        primaryColor: '#5A7247',
        years: '1960-1967',
        hasSwatch: true,
        imageSwatch: 'https://test.supabase.co/storage/v1/object/public/archive-colors/swatches/almond-green.png',
        images: [{ url: 'https://example.com/img.jpg', contributor: 'testuser' }],
      });
    });

    it('returns empty array when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: null, error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result).toEqual([]);
    });

    it('returns empty array when no colors match', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result).toEqual([]);
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Database error', code: '42P01' };
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: null, error: supabaseError }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();

      await expect(listColors()).rejects.toEqual(supabaseError);
    });

    it('handles rows with missing optional fields gracefully', async () => {
      const minimalRow = {
        id: 'color-3',
        name: null,
        code: null,
        short_code: null,
        ditzler_ppg_code: null,
        dulux_code: null,
        hex_value: null,
        year_start: null,
        year_end: null,
        has_swatch: null,
        swatch_path: null,
        contributor_images: null,
        status: 'approved',
      };

      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [minimalRow], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0]).toEqual({
        id: 'color-3',
        name: '',
        code: '',
        shortCode: '',
        ditzlerPpgCode: '',
        duluxCode: '',
        primaryColor: '',
        years: '',
        hasSwatch: false,
        imageSwatch: '',
        images: [],
      });
    });

    it('handles row with only year_start (no year_end)', async () => {
      const rowWithStartOnly = {
        ...mockColorRow,
        id: 'color-4',
        year_start: 1965,
        year_end: null,
      };

      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [rowWithStartOnly], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].years).toBe('1965');
    });
  });

  describe('getColor', () => {
    it('queries colors table by id with .single()', async () => {
      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: mockColorRow,
        error: null,
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { getColor } = useColors();
      await getColor('color-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('colors');
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'color-1');
      expect(mockSupabase._queryBuilder.single).toHaveBeenCalled();
    });

    it('returns a PrettyColor object with raw and pretty fields', async () => {
      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: mockColorRow,
        error: null,
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { getColor } = useColors();
      const result = await getColor('color-1');

      expect(result).not.toBeNull();
      expect(result!.raw).toEqual({
        id: 'color-1',
        name: 'Almond Green',
        code: 'GN37',
        shortCode: 'AG',
        ditzlerPpgCode: '43592',
        duluxCode: '6G-013',
        primaryColor: '#5A7247',
        years: '1960-1967',
        hasSwatch: true,
        imageSwatch: 'https://test.supabase.co/storage/v1/object/public/archive-colors/swatches/almond-green.png',
        images: [{ url: 'https://example.com/img.jpg', contributor: 'testuser' }],
      });
      expect(result!.pretty).toEqual({
        'Primary Color': '#5A7247',
        Code: 'GN37',
        hasSwatch: true,
        'Ditzler PPG Code': '43592',
        'Dulux Code': '6G-013',
        Name: 'Almond Green',
        'Short Code': 'AG',
        Years: '1960-1967',
        ID: 'color-1',
      });
    });

    it('returns null when Supabase returns an error', async () => {
      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { getColor } = useColors();
      const result = await getColor('nonexistent-id');

      expect(result).toBeNull();
    });

    it('returns null when the color does not exist', async () => {
      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { getColor } = useColors();
      const result = await getColor('no-such-id');

      expect(result).toBeNull();
    });
  });

  describe('checkDuplicate', () => {
    it('queries colors table by code with limit 1', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { checkDuplicate } = useColors();
      await checkDuplicate('GN37');

      expect(mockSupabase.from).toHaveBeenCalledWith('colors');
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalledWith('id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('code', 'GN37');
      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(1);
    });

    it('returns true when a matching color exists', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [{ id: 'color-1' }], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { checkDuplicate } = useColors();
      const result = await checkDuplicate('GN37');

      expect(result).toBe(true);
    });

    it('returns false when no matching color exists', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { checkDuplicate } = useColors();
      const result = await checkDuplicate('NONEXISTENT');

      expect(result).toBe(false);
    });

    it('returns false when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: null, error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { checkDuplicate } = useColors();
      const result = await checkDuplicate('ANYTHING');

      expect(result).toBe(false);
    });
  });

  describe('submitColor', () => {
    it('throws when user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useColors } = await import('~/app/composables/useColors');
      const { submitColor } = useColors();

      await expect(submitColor({ name: 'Test Color' })).rejects.toThrow(
        'Must be authenticated to submit',
      );
    });

    it('inserts into submission_queue with correct data when authenticated', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const submissionData = { name: 'Island Blue', code: 'BL23' };
      const insertedRow = { id: 'sub-1', ...submissionData, status: 'pending' };

      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { submitColor } = useColors();
      const result = await submitColor(submissionData);

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._queryBuilder.insert).toHaveBeenCalledWith({
        type: 'new_item',
        target_type: 'color',
        submitted_by: 'test-user-id',
        status: 'pending',
        data: submissionData,
      });
      expect(mockSupabase._queryBuilder.select).toHaveBeenCalled();
      expect(mockSupabase._queryBuilder.single).toHaveBeenCalled();
      expect(result).toEqual(insertedRow);
    });

    it('throws when Supabase returns an error during submission', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Insert failed', code: '23505' };
      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: null,
        error: supabaseError,
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { submitColor } = useColors();

      await expect(submitColor({ name: 'Test' })).rejects.toEqual(supabaseError);
    });

    it('uses the authenticated user id as submitted_by', async () => {
      const customUser = createMockUser({ id: 'custom-user-123' });
      const mockAuth = createMockAuth(customUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.single.mockResolvedValue({
        data: { id: 'sub-2' },
        error: null,
      });

      const { useColors } = await import('~/app/composables/useColors');
      const { submitColor } = useColors();
      await submitColor({ name: 'Custom Color' });

      expect(mockSupabase._queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ submitted_by: 'custom-user-123' }),
      );
    });
  });

  describe('mapToColor (internal mapping)', () => {
    it('builds years string from year_start and year_end', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({ data: [{ ...mockColorRow, year_start: 1959, year_end: 2000 }], error: null }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].years).toBe('1959-2000');
    });

    it('uses year_start only when year_end is missing', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ ...mockColorRow, year_start: 1975, year_end: null }],
          error: null,
        }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].years).toBe('1975');
    });

    it('returns empty string for years when both year_start and year_end are missing', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ ...mockColorRow, year_start: null, year_end: null }],
          error: null,
        }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].years).toBe('');
    });

    it('builds swatch URL for relative swatch_path', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ ...mockColorRow, swatch_path: 'path/to/swatch.jpg' }],
          error: null,
        }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].imageSwatch).toBe(
        'https://test.supabase.co/storage/v1/object/public/archive-colors/path/to/swatch.jpg',
      );
    });

    it('returns empty imageSwatch when swatch_path is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ ...mockColorRow, swatch_path: null }],
          error: null,
        }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].imageSwatch).toBe('');
    });

    it('defaults contributor_images to empty array when null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve) =>
        resolve({
          data: [{ ...mockColorRow, contributor_images: null }],
          error: null,
        }),
      );

      const { useColors } = await import('~/app/composables/useColors');
      const { listColors } = useColors();
      const result = await listColors();

      expect(result[0].images).toEqual([]);
    });
  });
});

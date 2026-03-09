import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, cleanupGlobalMocks, createMockUser } from '../../setup/testHelpers';

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

// Sample row data as it comes back from Supabase
const makeRow = (overrides: Record<string, any> = {}) => ({
  id: 'row-1',
  year: 1967,
  model: 'Cooper S',
  body_number: 'B-12345',
  engine_number: 'E-67890',
  engine_size: 1275,
  body_type: 'Saloon',
  color: 'Tartan Red',
  trim: 'Black',
  build_date: '1967-03-15',
  notes: 'Numbers matching',
  legacy_submitted_by: 'John Doe',
  legacy_submitted_by_email: 'john@example.com',
  status: 'approved',
  ...overrides,
});

describe('useRegistry', () => {
  describe('listApproved()', () => {
    it('queries registry_entries table for approved entries ordered by year descending', async () => {
      const rows = [makeRow(), makeRow({ id: 'row-2', year: 1970 })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: rows, error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      // Verify correct table
      expect(mockSupabase.from).toHaveBeenCalledWith('registry_entries');
      // Verify select all
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      // Verify filtering for approved
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
      // Verify ordering
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('year', { ascending: false });

      // Verify result count
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when no data is returned', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result).toEqual([]);
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Database connection failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: null, error: supabaseError }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();

      await expect(listApproved()).rejects.toEqual(supabaseError);
    });

    it('maps rows to RegistryItem objects with correct field names', async () => {
      const row = makeRow();
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result[0]).toEqual({
        uniqueId: 'row-1',
        year: 1967,
        model: 'Cooper S',
        bodyNum: 'B-12345',
        engineNum: 'E-67890',
        engineSize: 1275,
        bodyType: 'Saloon',
        color: 'Tartan Red',
        trim: 'Black',
        buildDate: '1967-03-15',
        notes: 'Numbers matching',
        submittedBy: 'John Doe',
        submittedByEmail: 'john@example.com',
        status: 'A',
      });
    });

    it('handles rows with null/missing optional fields by providing defaults', async () => {
      const sparseRow = {
        id: 'sparse-1',
        year: 1960,
        model: null,
        body_number: null,
        engine_number: null,
        engine_size: null,
        body_type: null,
        color: null,
        trim: null,
        build_date: null,
        notes: null,
        legacy_submitted_by: null,
        legacy_submitted_by_email: null,
        status: 'approved',
      };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [sparseRow], error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result[0]).toEqual({
        uniqueId: 'sparse-1',
        year: 1960,
        model: '',
        bodyNum: '',
        engineNum: '',
        engineSize: 0,
        bodyType: '',
        color: '',
        trim: '',
        buildDate: null,
        notes: '',
        submittedBy: '',
        submittedByEmail: '',
        status: 'A',
      });
    });
  });

  describe('mapToRegistry (internal helper via listApproved)', () => {
    it('maps status "approved" to "A"', async () => {
      const row = makeRow({ status: 'approved' });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result[0].status).toBe('A');
    });

    it('maps status "pending" to "P"', async () => {
      // Even though listApproved filters for approved, mapToRegistry handles any status
      const row = makeRow({ status: 'pending' });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result[0].status).toBe('P');
    });

    it('maps status "rejected" to "R"', async () => {
      const row = makeRow({ status: 'rejected' });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result[0].status).toBe('R');
    });

    it('maps any unrecognized status to "R"', async () => {
      const row = makeRow({ status: 'unknown_status' });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: [row], error: null }));

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { listApproved } = useRegistry();
      const result = await listApproved();

      expect(result[0].status).toBe('R');
    });
  });

  describe('submitRegistryEntry()', () => {
    it('throws if user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { submitRegistryEntry } = useRegistry();

      await expect(submitRegistryEntry({ model: 'Cooper' })).rejects.toThrow('Must be authenticated to submit');
    });

    it('inserts into submission_queue with correct fields when authenticated', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const submissionData = { data: { id: 'new-sub' }, error: null };
      mockSupabase._mockSingle.mockResolvedValue(submissionData);

      const entry = { model: 'Cooper S', year: 1967 };

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { submitRegistryEntry } = useRegistry();
      const result = await submitRegistryEntry(entry);

      // Verify correct table
      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      // Verify insert payload
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        type: 'new_item',
        target_type: 'registry',
        submitted_by: 'test-user-id',
        status: 'pending',
        data: entry,
      });
      // Verify .select().single() chain
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();

      // Verify returned data
      expect(result).toEqual({ id: 'new-sub' });
    });

    it('throws when Supabase returns an error on insert', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Insert failed', code: '23505' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { submitRegistryEntry } = useRegistry();

      await expect(submitRegistryEntry({ model: 'Cooper' })).rejects.toEqual(supabaseError);
    });

    it('passes the full entry object as the data field', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: {}, error: null });

      const fullEntry = {
        model: 'Mini Mayfair',
        year: 1990,
        bodyNum: 'B-99999',
        engineNum: 'E-11111',
        engineSize: 998,
        bodyType: 'Saloon',
        color: 'British Racing Green',
        trim: 'Tan',
        buildDate: '1990-06-01',
        notes: 'Factory fresh',
      };

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { submitRegistryEntry } = useRegistry();
      await submitRegistryEntry(fullEntry);

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.data).toEqual(fullEntry);
      expect(insertArg.target_type).toBe('registry');
      expect(insertArg.type).toBe('new_item');
      expect(insertArg.status).toBe('pending');
      expect(insertArg.submitted_by).toBe('test-user-id');
    });

    it('returns the data from the single() response', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const responseData = {
        id: 'queue-123',
        type: 'new_item',
        target_type: 'registry',
        status: 'pending',
        submitted_by: 'test-user-id',
      };
      mockSupabase._mockSingle.mockResolvedValue({ data: responseData, error: null });

      const { useRegistry } = await import('~/app/composables/useRegistry');
      const { submitRegistryEntry } = useRegistry();
      const result = await submitRegistryEntry({ model: 'Cooper' });

      expect(result).toEqual(responseData);
    });
  });
});

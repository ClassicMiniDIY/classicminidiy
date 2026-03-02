import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

// Sample submission row as it comes back from Supabase
const makeSubmissionRow = (overrides: Record<string, any> = {}) => ({
  id: 'sub-1',
  type: 'new_item',
  target_type: 'document',
  target_id: null,
  status: 'pending',
  data: { title: 'Test Document' },
  reviewer_notes: null,
  created_at: '2026-01-15T10:00:00Z',
  reviewed_at: null,
  submitted_by: 'test-user-id',
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useSubmissions', () => {
  describe('listMySubmissions()', () => {
    it('returns empty array when user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      const result = await listMySubmissions();

      expect(result).toEqual([]);
    });

    it('queries submission_queue filtered by current user and ordered by created_at descending', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const rows = [makeSubmissionRow(), makeSubmissionRow({ id: 'sub-2' })];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      const result = await listMySubmissions();

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('submitted_by', 'test-user-id');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toHaveLength(2);
    });

    it('applies status filter when provided', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      await listMySubmissions({ status: 'approved' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('applies targetType filter when provided', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      await listMySubmissions({ targetType: 'registry' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('target_type', 'registry');
    });

    it('applies both status and targetType filters when both provided', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      await listMySubmissions({ status: 'pending', targetType: 'color' });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('submitted_by', 'test-user-id');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('target_type', 'color');
    });

    it('maps rows to SubmissionItem objects with correct field names', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const row = makeSubmissionRow({
        id: 'sub-mapped',
        type: 'edit_suggestion',
        target_type: 'wheel',
        target_id: 'wheel-123',
        status: 'approved',
        data: { changes: { name: { from: 'Old', to: 'New' } }, reason: 'Typo fix' },
        reviewer_notes: 'Looks good',
        created_at: '2026-02-01T12:00:00Z',
        reviewed_at: '2026-02-02T08:00:00Z',
      });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [row], error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      const result = await listMySubmissions();

      expect(result[0]).toEqual({
        id: 'sub-mapped',
        type: 'edit_suggestion',
        targetType: 'wheel',
        targetId: 'wheel-123',
        status: 'approved',
        data: { changes: { name: { from: 'Old', to: 'New' } }, reason: 'Typo fix' },
        reviewerNotes: 'Looks good',
        createdAt: '2026-02-01T12:00:00Z',
        reviewedAt: '2026-02-02T08:00:00Z',
      });
    });

    it('returns empty array when data is null', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      const result = await listMySubmissions();

      expect(result).toEqual([]);
    });

    it('throws when Supabase returns an error', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Database connection failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: supabaseError }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();

      await expect(listMySubmissions()).rejects.toEqual(supabaseError);
    });

    it('defaults data to empty object when row data is null', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const row = makeSubmissionRow({ data: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [row], error: null }),
      );

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { listMySubmissions } = useSubmissions();
      const result = await listMySubmissions();

      expect(result[0].data).toEqual({});
    });
  });

  describe('submitNewItem()', () => {
    it('throws if user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitNewItem } = useSubmissions();

      await expect(submitNewItem('document', { title: 'Test' })).rejects.toThrow(
        'Must be authenticated to submit',
      );
    });

    it('inserts into submission_queue with correct fields when authenticated', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const insertedRow = makeSubmissionRow({
        type: 'new_item',
        target_type: 'collection',
        data: { name: 'My Collection' },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const itemData = { name: 'My Collection' };

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitNewItem } = useSubmissions();
      await submitNewItem('collection', itemData);

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        type: 'new_item',
        target_type: 'collection',
        submitted_by: 'test-user-id',
        status: 'pending',
        data: itemData,
      });
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('returns a mapped SubmissionItem on success', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const insertedRow = makeSubmissionRow({
        id: 'new-sub-1',
        type: 'new_item',
        target_type: 'registry',
        data: { model: 'Cooper S' },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitNewItem } = useSubmissions();
      const result = await submitNewItem('registry', { model: 'Cooper S' });

      expect(result).toEqual({
        id: 'new-sub-1',
        type: 'new_item',
        targetType: 'registry',
        targetId: null,
        status: 'pending',
        data: { model: 'Cooper S' },
        reviewerNotes: null,
        createdAt: '2026-01-15T10:00:00Z',
        reviewedAt: null,
      });
    });

    it('throws when Supabase returns an error on insert', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Insert failed', code: '23505' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitNewItem } = useSubmissions();

      await expect(submitNewItem('document', { title: 'Test' })).rejects.toEqual(supabaseError);
    });

    it('uses the correct target_type for each type argument', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: makeSubmissionRow(), error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitNewItem } = useSubmissions();
      await submitNewItem('wheel', { brand: 'Minilite' });

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ target_type: 'wheel' }),
      );
    });

    it('uses the authenticated user id as submitted_by', async () => {
      const customUser = createMockUser({ id: 'custom-user-456' });
      const mockAuth = createMockAuth(customUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: makeSubmissionRow(), error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitNewItem } = useSubmissions();
      await submitNewItem('color', { name: 'Almond Green' });

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ submitted_by: 'custom-user-456' }),
      );
    });
  });

  describe('submitEditSuggestion()', () => {
    it('throws if user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitEditSuggestion } = useSubmissions();

      await expect(
        submitEditSuggestion('document', 'doc-1', { title: { from: 'Old', to: 'New' } }, 'Typo fix'),
      ).rejects.toThrow('Must be authenticated to suggest edits');
    });

    it('inserts into submission_queue with type edit_suggestion and correct payload', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const insertedRow = makeSubmissionRow({
        type: 'edit_suggestion',
        target_type: 'registry',
        target_id: 'reg-99',
        data: {
          changes: { model: { from: 'Cooper', to: 'Cooper S' } },
          reason: 'Incorrect model designation',
        },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const changes = { model: { from: 'Cooper', to: 'Cooper S' } };
      const reason = 'Incorrect model designation';

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitEditSuggestion } = useSubmissions();
      await submitEditSuggestion('registry', 'reg-99', changes, reason);

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        type: 'edit_suggestion',
        target_type: 'registry',
        target_id: 'reg-99',
        submitted_by: 'test-user-id',
        status: 'pending',
        data: { changes, reason },
      });
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('returns a mapped SubmissionItem on success', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const insertedRow = makeSubmissionRow({
        id: 'edit-sub-1',
        type: 'edit_suggestion',
        target_type: 'color',
        target_id: 'color-5',
        data: {
          changes: { hex_value: { from: '#000', to: '#111' } },
          reason: 'Wrong hex',
        },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: insertedRow, error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitEditSuggestion } = useSubmissions();
      const result = await submitEditSuggestion(
        'color',
        'color-5',
        { hex_value: { from: '#000', to: '#111' } },
        'Wrong hex',
      );

      expect(result).toEqual({
        id: 'edit-sub-1',
        type: 'edit_suggestion',
        targetType: 'color',
        targetId: 'color-5',
        status: 'pending',
        data: {
          changes: { hex_value: { from: '#000', to: '#111' } },
          reason: 'Wrong hex',
        },
        reviewerNotes: null,
        createdAt: '2026-01-15T10:00:00Z',
        reviewedAt: null,
      });
    });

    it('throws when Supabase returns an error on insert', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Insert failed', code: '23503' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitEditSuggestion } = useSubmissions();

      await expect(
        submitEditSuggestion('wheel', 'wheel-1', { size: { from: 10, to: 12 } }, 'Wrong size'),
      ).rejects.toEqual(supabaseError);
    });

    it('includes target_id in the insert payload', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: makeSubmissionRow(), error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitEditSuggestion } = useSubmissions();
      await submitEditSuggestion('document', 'doc-42', { content: { from: 'a', to: 'b' } }, 'Fix');

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ target_id: 'doc-42' }),
      );
    });

    it('wraps changes and reason into the data field', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: makeSubmissionRow(), error: null });

      const changes = { name: { from: 'Foo', to: 'Bar' }, code: { from: 'X', to: 'Y' } };
      const reason = 'Multiple corrections needed';

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { submitEditSuggestion } = useSubmissions();
      await submitEditSuggestion('collection', 'col-1', changes, reason);

      const insertArg = mockSupabase._mockInsert.mock.calls[0][0];
      expect(insertArg.data).toEqual({ changes, reason });
    });
  });

  describe('getSubmission()', () => {
    it('queries submission_queue by id with maybeSingle', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { getSubmission } = useSubmissions();
      await getSubmission('sub-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('submission_queue');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'sub-123');
      expect(mockSupabase._mockMaybeSingle).toHaveBeenCalled();
    });

    it('returns a mapped SubmissionItem when data is found', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const row = makeSubmissionRow({
        id: 'sub-found',
        type: 'new_item',
        target_type: 'document',
        target_id: null,
        status: 'approved',
        data: { title: 'Found Doc' },
        reviewer_notes: 'Approved by admin',
        created_at: '2026-01-20T14:00:00Z',
        reviewed_at: '2026-01-21T09:00:00Z',
      });
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: row, error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { getSubmission } = useSubmissions();
      const result = await getSubmission('sub-found');

      expect(result).toEqual({
        id: 'sub-found',
        type: 'new_item',
        targetType: 'document',
        targetId: null,
        status: 'approved',
        data: { title: 'Found Doc' },
        reviewerNotes: 'Approved by admin',
        createdAt: '2026-01-20T14:00:00Z',
        reviewedAt: '2026-01-21T09:00:00Z',
      });
    });

    it('returns null when no data is found', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { getSubmission } = useSubmissions();
      const result = await getSubmission('nonexistent-id');

      expect(result).toBeNull();
    });

    it('returns null when Supabase returns an error', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Not found', code: 'PGRST116' };
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { getSubmission } = useSubmissions();
      const result = await getSubmission('bad-id');

      expect(result).toBeNull();
    });

    it('does not require authentication to fetch a submission', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const row = makeSubmissionRow({ id: 'public-sub' });
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: row, error: null });

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const { getSubmission } = useSubmissions();
      const result = await getSubmission('public-sub');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('public-sub');
    });
  });

  describe('auth requirement', () => {
    it('calls useAuth at composable initialization time', async () => {
      const mockAuth = createMockAuth(null);
      const useAuthSpy = vi.fn(() => mockAuth);
      vi.stubGlobal('useAuth', useAuthSpy);

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      useSubmissions();

      expect(useAuthSpy).toHaveBeenCalled();
    });

    it('provides all four methods from the composable', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useSubmissions } = await import('~/app/composables/useSubmissions');
      const result = useSubmissions();

      expect(result).toHaveProperty('listMySubmissions');
      expect(result).toHaveProperty('submitNewItem');
      expect(result).toHaveProperty('submitEditSuggestion');
      expect(result).toHaveProperty('getSubmission');
      expect(typeof result.listMySubmissions).toBe('function');
      expect(typeof result.submitNewItem).toBe('function');
      expect(typeof result.submitEditSuggestion).toBe('function');
      expect(typeof result.getSubmission).toBe('function');
    });
  });
});

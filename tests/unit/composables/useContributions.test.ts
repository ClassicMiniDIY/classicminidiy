import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);
});

afterEach(() => {
  cleanupGlobalMocks();
});

const makeProfileRow = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  display_name: 'Mini Enthusiast',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Classic Mini lover since 1985',
  trust_level: 'contributor',
  total_submissions: 12,
  approved_submissions: 9,
  created_at: '2024-01-15T10:00:00Z',
  ...overrides,
});

const makeContributionRow = (overrides: Record<string, any> = {}) => ({
  id: 'contrib-1',
  action: 'submitted',
  target_type: 'document',
  target_id: 'doc-123',
  target_title: 'Workshop Manual',
  details: 'Uploaded new scan',
  created_at: '2025-06-01T12:00:00Z',
  user_id: 'user-1',
  ...overrides,
});

describe('useContributions', () => {
  describe('getContributorProfile()', () => {
    it('queries profiles table by userId with maybeSingle()', async () => {
      const profileRow = makeProfileRow();
      mockSupabase._mockMaybeSingle.mockResolvedValue({
        data: profileRow,
        error: null,
      });

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributorProfile } = useContributions();
      await getContributorProfile('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(
        'id, display_name, avatar_url, bio, trust_level, total_submissions, approved_submissions, created_at',
      );
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockSupabase._mockMaybeSingle).toHaveBeenCalled();
    });

    it('returns a mapped ContributorProfile when data exists', async () => {
      const profileRow = makeProfileRow();
      mockSupabase._mockMaybeSingle.mockResolvedValue({
        data: profileRow,
        error: null,
      });

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributorProfile } = useContributions();
      const result = await getContributorProfile('user-1');

      expect(result).toEqual({
        id: 'user-1',
        displayName: 'Mini Enthusiast',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Classic Mini lover since 1985',
        trustLevel: 'contributor',
        totalSubmissions: 12,
        approvedSubmissions: 9,
        joinedAt: '2024-01-15T10:00:00Z',
      });
    });

    it('returns null when data is null', async () => {
      mockSupabase._mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributorProfile } = useContributions();
      const result = await getContributorProfile('nonexistent-user');

      expect(result).toBeNull();
    });

    it('returns null when Supabase returns an error', async () => {
      const supabaseError = { message: 'Database error', code: '500' };
      mockSupabase._mockMaybeSingle.mockResolvedValue({
        data: null,
        error: supabaseError,
      });

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributorProfile } = useContributions();
      const result = await getContributorProfile('user-1');

      expect(result).toBeNull();
    });

    it('returns null when there is an error even if data is present', async () => {
      const profileRow = makeProfileRow();
      const supabaseError = { message: 'Partial error', code: '500' };
      mockSupabase._mockMaybeSingle.mockResolvedValue({
        data: profileRow,
        error: supabaseError,
      });

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributorProfile } = useContributions();
      const result = await getContributorProfile('user-1');

      expect(result).toBeNull();
    });

    it('maps all trust levels correctly', async () => {
      for (const trustLevel of ['new', 'contributor', 'trusted', 'moderator', 'admin']) {
        vi.resetModules();
        mockSupabase = createMockSupabaseClient();
        vi.stubGlobal('useSupabase', () => mockSupabase);

        const profileRow = makeProfileRow({ trust_level: trustLevel });
        mockSupabase._mockMaybeSingle.mockResolvedValue({
          data: profileRow,
          error: null,
        });

        const { useContributions } = await import('~/app/composables/useContributions');
        const { getContributorProfile } = useContributions();
        const result = await getContributorProfile('user-1');

        expect(result!.trustLevel).toBe(trustLevel);
      }
    });
  });

  describe('listContributions()', () => {
    it('queries contributions table by userId ordered by created_at desc', async () => {
      const rows = [makeContributionRow()];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      await listContributions('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('contributions');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('returns mapped ContributionItem objects', async () => {
      const row = makeContributionRow();
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [row], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'contrib-1',
        action: 'submitted',
        targetType: 'document',
        targetId: 'doc-123',
        targetTitle: 'Workshop Manual',
        details: 'Uploaded new scan',
        createdAt: '2025-06-01T12:00:00Z',
      });
    });

    it('returns multiple items in correct order', async () => {
      const rows = [
        makeContributionRow({ id: 'contrib-2', created_at: '2025-07-01T12:00:00Z' }),
        makeContributionRow({ id: 'contrib-1', created_at: '2025-06-01T12:00:00Z' }),
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('contrib-2');
      expect(result[1].id).toBe('contrib-1');
    });

    it('returns empty array when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when no contributions exist', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result).toEqual([]);
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Query failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: supabaseError }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();

      await expect(listContributions('user-1')).rejects.toEqual(supabaseError);
    });

    it('applies targetType filter when provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      await listContributions('user-1', { targetType: 'registry' });

      // eq is called twice: once for user_id, once for target_type
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('target_type', 'registry');
    });

    it('applies limit filter when provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      await listContributions('user-1', { limit: 5 });

      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(5);
    });

    it('applies both targetType and limit filters when provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      await listContributions('user-1', { targetType: 'color', limit: 10 });

      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('target_type', 'color');
      expect(mockSupabase._queryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('does not call eq for target_type when targetType option is not provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      await listContributions('user-1');

      // eq should only be called once (for user_id)
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledTimes(1);
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('does not call limit when limit option is not provided', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      await listContributions('user-1');

      expect(mockSupabase._queryBuilder.limit).not.toHaveBeenCalled();
    });

    it('maps all action types correctly', async () => {
      const actions = ['submitted', 'edited', 'approved', 'rejected'] as const;
      const rows = actions.map((action, i) =>
        makeContributionRow({ id: `contrib-${i}`, action }),
      );
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result.map((r) => r.action)).toEqual(['submitted', 'edited', 'approved', 'rejected']);
    });

    it('maps all target types correctly', async () => {
      const types = ['document', 'collection', 'registry', 'color', 'wheel'] as const;
      const rows = types.map((type, i) =>
        makeContributionRow({ id: `contrib-${i}`, target_type: type }),
      );
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result.map((r) => r.targetType)).toEqual([
        'document',
        'collection',
        'registry',
        'color',
        'wheel',
      ]);
    });

    it('handles rows with null target_title and details', async () => {
      const row = makeContributionRow({ target_title: null, details: null });
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [row], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { listContributions } = useContributions();
      const result = await listContributions('user-1');

      expect(result[0].targetTitle).toBeNull();
      expect(result[0].details).toBeNull();
    });
  });

  describe('getContributionStats()', () => {
    it('queries contributions table filtered by userId and action approved', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();
      await getContributionStats('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('contributions');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('target_type');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('action', 'approved');
    });

    it('returns counts grouped by target_type', async () => {
      const rows = [
        { target_type: 'document' },
        { target_type: 'document' },
        { target_type: 'registry' },
        { target_type: 'color' },
        { target_type: 'color' },
        { target_type: 'color' },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();
      const result = await getContributionStats('user-1');

      expect(result).toEqual({
        document: 2,
        registry: 1,
        color: 3,
      });
    });

    it('returns empty object when no approved contributions exist', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();
      const result = await getContributionStats('user-1');

      expect(result).toEqual({});
    });

    it('returns empty object when data is null', async () => {
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();
      const result = await getContributionStats('user-1');

      expect(result).toEqual({});
    });

    it('throws when Supabase returns an error', async () => {
      const supabaseError = { message: 'Aggregation failed', code: '500' };
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: supabaseError }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();

      await expect(getContributionStats('user-1')).rejects.toEqual(supabaseError);
    });

    it('counts a single target_type correctly', async () => {
      const rows = [{ target_type: 'wheel' }];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();
      const result = await getContributionStats('user-1');

      expect(result).toEqual({ wheel: 1 });
    });

    it('handles all five target types present', async () => {
      const rows = [
        { target_type: 'document' },
        { target_type: 'collection' },
        { target_type: 'registry' },
        { target_type: 'color' },
        { target_type: 'wheel' },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: rows, error: null }),
      );

      const { useContributions } = await import('~/app/composables/useContributions');
      const { getContributionStats } = useContributions();
      const result = await getContributionStats('user-1');

      expect(result).toEqual({
        document: 1,
        collection: 1,
        registry: 1,
        color: 1,
        wheel: 1,
      });
    });
  });
});

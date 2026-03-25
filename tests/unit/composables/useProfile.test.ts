import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
let mockCapture: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  mockCapture = vi.fn();
  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('usePostHog', () => ({ capture: mockCapture, identify: vi.fn(), reset: vi.fn() }));
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useProfile', () => {
  // ---------------------------------------------------------------------------
  // fetchProfile()
  // ---------------------------------------------------------------------------
  describe('fetchProfile()', () => {
    it('throws when user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useProfile } = await import('~/app/composables/useProfile');
      const { fetchProfile } = useProfile();

      await expect(fetchProfile()).rejects.toThrow('Not authenticated');
    });

    it('queries profiles table filtered by user id with single()', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const profileData = { id: 'test-user-id', display_name: 'Test User' };
      mockSupabase._mockSingle.mockResolvedValue({ data: profileData, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { fetchProfile } = useProfile();
      await fetchProfile();

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'test-user-id');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('returns the profile data on success', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const profileData = { id: 'test-user-id', display_name: 'Test User', bio: 'Mini fan' };
      mockSupabase._mockSingle.mockResolvedValue({ data: profileData, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { fetchProfile } = useProfile();
      const result = await fetchProfile();

      expect(result).toEqual(profileData);
    });

    it('throws when Supabase returns an error', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Database error', code: '500' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { fetchProfile } = useProfile();

      await expect(fetchProfile()).rejects.toEqual(supabaseError);
    });
  });

  // ---------------------------------------------------------------------------
  // updateProfile()
  // ---------------------------------------------------------------------------
  describe('updateProfile()', () => {
    it('throws when user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useProfile } = await import('~/app/composables/useProfile');
      const { updateProfile } = useProfile();

      await expect(updateProfile({ display_name: 'New Name' })).rejects.toThrow('Not authenticated');
    });

    it('calls update on profiles table with the provided updates and filters by user id', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const updatedData = { id: 'test-user-id', display_name: 'New Name' };
      mockSupabase._mockSingle.mockResolvedValue({ data: updatedData, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { updateProfile } = useProfile();
      await updateProfile({ display_name: 'New Name' });

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ display_name: 'New Name' });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'test-user-id');
      expect(mockSupabase._mockSelect).toHaveBeenCalled();
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('returns updated data on success', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const updatedData = { id: 'test-user-id', display_name: 'New Name', bio: 'Updated bio' };
      mockSupabase._mockSingle.mockResolvedValue({ data: updatedData, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { updateProfile } = useProfile();
      const result = await updateProfile({ display_name: 'New Name', bio: 'Updated bio' });

      expect(result).toEqual(updatedData);
    });

    it('throws when Supabase returns an error', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const supabaseError = { message: 'Update failed', code: '23505' };
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: supabaseError });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { updateProfile } = useProfile();

      await expect(updateProfile({ display_name: 'New Name' })).rejects.toEqual(supabaseError);
    });

    it('only sends the fields provided in the updates object', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockSingle.mockResolvedValue({ data: {}, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { updateProfile } = useProfile();
      await updateProfile({ bio: 'Just a bio update' });

      const updateArg = mockSupabase._mockUpdate.mock.calls[0][0];
      expect(updateArg).toEqual({ bio: 'Just a bio update' });
      expect(updateArg).not.toHaveProperty('display_name');
      expect(updateArg).not.toHaveProperty('avatar_url');
    });
  });

  // ---------------------------------------------------------------------------
  // uploadAvatar()
  // ---------------------------------------------------------------------------
  describe('uploadAvatar()', () => {
    it('throws when user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useProfile } = await import('~/app/composables/useProfile');
      const { uploadAvatar } = useProfile();

      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      await expect(uploadAvatar(file)).rejects.toThrow('Not authenticated');
    });

    it('throws on invalid file type (not jpeg/png/webp)', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useProfile } = await import('~/app/composables/useProfile');
      const { uploadAvatar } = useProfile();

      const file = new File(['data'], 'avatar.gif', { type: 'image/gif' });
      await expect(uploadAvatar(file)).rejects.toThrow('Invalid file type');
    });

    it('throws on file too large (>5MB)', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useProfile } = await import('~/app/composables/useProfile');
      const { uploadAvatar } = useProfile();

      // Create a file larger than 5MB
      const largeContent = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeContent], 'avatar.png', { type: 'image/png' });
      await expect(uploadAvatar(file)).rejects.toThrow('File too large');
    });

    it('uploads to the correct bucket and path pattern', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      // Mock the profile fetch for old avatar cleanup
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      // Create a shared storage mock so we can inspect calls
      const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/mock-url' } });
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.storage.from = vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
      }));

      const { useProfile } = await import('~/app/composables/useProfile');
      const { uploadAvatar } = useProfile();

      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      await uploadAvatar(file);

      // Verify storage bucket is 'avatars'
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('avatars');

      // Verify upload was called with a path starting with the user id
      const uploadCall = mockUpload.mock.calls[0];
      expect(uploadCall[0]).toMatch(/^test-user-id\/avatar\//);
      expect(uploadCall[1]).toBe(file);
    });

    it('returns the public URL on successful upload', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { uploadAvatar } = useProfile();

      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      const result = await uploadAvatar(file);

      expect(result).toBe('https://example.com/mock-url');
    });

    it('calls capture with avatar_uploaded event', async () => {
      const mockUser = createMockUser();
      const mockAuth = createMockAuth(mockUser);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { uploadAvatar } = useProfile();

      const file = new File(['data'], 'avatar.png', { type: 'image/png' });
      await uploadAvatar(file);

      expect(mockCapture).toHaveBeenCalledWith('avatar_uploaded', {
        file_size_kb: expect.any(Number),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPublicProfile()
  // ---------------------------------------------------------------------------
  describe('getPublicProfile()', () => {
    it('calls rpc get_public_profile_by_id with the identifier', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const profileData = { id: 'user-123', display_name: 'Public User' };
      mockSupabase._mockSingle.mockResolvedValue({ data: profileData, error: null });
      mockSupabase.rpc = vi.fn().mockReturnValue({
        single: mockSupabase._mockSingle,
      });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfile } = useProfile();
      await getPublicProfile('user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_public_profile_by_id', { p_user_id: 'user-123' });
    });

    it('returns { profile: data } when profile is found and public', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const profileData = { id: 'user-123', display_name: 'Public User', is_public: true };
      mockSupabase._mockSingle.mockResolvedValue({ data: profileData, error: null });
      mockSupabase.rpc = vi.fn().mockReturnValue({
        single: mockSupabase._mockSingle,
      });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfile } = useProfile();
      const result = await getPublicProfile('user-123');

      expect(result).toEqual({ profile: profileData });
    });

    it('returns { private: true } when RPC fails but profile exists', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      // RPC fails
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockSupabase.rpc = vi.fn().mockReturnValue({
        single: mockSupabase._mockSingle,
      });

      // But profile exists check succeeds
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: { id: 'user-123' }, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfile } = useProfile();
      const result = await getPublicProfile('user-123');

      expect(result).toEqual({ private: true });
    });

    it('returns null when user does not exist at all', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      // RPC fails
      mockSupabase._mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockSupabase.rpc = vi.fn().mockReturnValue({
        single: mockSupabase._mockSingle,
      });

      // Profile does not exist
      mockSupabase._mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfile } = useProfile();
      const result = await getPublicProfile('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getPublicProfileVehicles()
  // ---------------------------------------------------------------------------
  describe('getPublicProfileVehicles()', () => {
    it('queries vehicles table filtered by user_id ordered by year desc', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const vehicles = [
        { id: 'v1', name: 'Red Mini', year: 1970, make: 'BMC', model: 'Cooper S', color: 'Red' },
        { id: 'v2', name: 'Green Mini', year: 1965, make: 'BMC', model: 'Cooper', color: 'Green' },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: vehicles, error: null }));

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfileVehicles } = useProfile();
      const result = await getPublicProfileVehicles('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('id, name, year, make, model, color');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabase._queryBuilder.order).toHaveBeenCalledWith('year', { ascending: false });
      expect(result).toHaveLength(2);
    });

    it('returns empty array on error', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase._queryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'Query failed' } })
      );

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfileVehicles } = useProfile();
      const result = await getPublicProfileVehicles('user-123');

      expect(result).toEqual([]);
    });

    it('returns array of vehicles on success', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const vehicles = [
        { id: 'v1', name: 'Red Mini', year: 1970, make: 'BMC', model: 'Cooper S', color: 'Red' },
      ];
      mockSupabase._queryBuilder.then = vi.fn((resolve: any) => resolve({ data: vehicles, error: null }));

      const { useProfile } = await import('~/app/composables/useProfile');
      const { getPublicProfileVehicles } = useProfile();
      const result = await getPublicProfileVehicles('user-123');

      expect(result).toEqual(vehicles);
    });
  });
});

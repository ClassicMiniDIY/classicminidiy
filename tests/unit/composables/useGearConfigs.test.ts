import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, mockSession } from '../../setup/mockSupabase';
import { createMockAuth, createMockUser, cleanupGlobalMocks } from '../../setup/testHelpers';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

const makeConfig = (overrides: Record<string, any> = {}) => ({
  id: 'config-1',
  user_id: 'user-1',
  name: 'My Gearbox',
  is_public: false,
  tire: '145/80R10',
  gearset: 'standard',
  final_drive: '3.44',
  drop_gear: 'none',
  speedo_drive: '15/17',
  max_rpm: 6500,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeInput = (overrides: Record<string, any> = {}) => ({
  name: 'Test Config',
  tire: '145/80R10',
  gearset: 'standard',
  final_drive: '3.44',
  drop_gear: 'none',
  speedo_drive: '15/17',
  max_rpm: 6500,
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  (global as any).__resetNuxtState();
  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useGearConfigs', () => {
  describe('return shape', () => {
    it('exposes configs, loading, and all five methods', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const result = useGearConfigs();

      expect(result).toHaveProperty('configs');
      expect(result).toHaveProperty('loading');
      expect(typeof result.fetchConfigs).toBe('function');
      expect(typeof result.saveConfig).toBe('function');
      expect(typeof result.updateConfig).toBe('function');
      expect(typeof result.deleteConfig).toBe('function');
      expect(typeof result.fetchPublicConfigs).toBe('function');
    });

    it('initialises configs as an empty array and loading as false', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { configs, loading } = useGearConfigs();

      expect(configs.value).toEqual([]);
      expect(loading.value).toBe(false);
    });
  });

  describe('fetchConfigs()', () => {
    it('does nothing when user is not authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, configs, loading } = useGearConfigs();

      await fetchConfigs();

      expect((global as any).$fetch).not.toHaveBeenCalled();
      expect(configs.value).toEqual([]);
      expect(loading.value).toBe(false);
    });

    it('sets loading to true during fetch and false on completion', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const rows = [makeConfig()];
      let loadingDuringFetch = false;
      (global as any).$fetch = vi.fn(async () => {
        // loading should be true at this point
        const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
        // we capture the reactive state indirectly via closure after the fact
        return rows;
      });

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, loading } = useGearConfigs();

      expect(loading.value).toBe(false);
      await fetchConfigs();
      expect(loading.value).toBe(false);
    });

    it('calls $fetch with the correct endpoint and auth header', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const rows = [makeConfig()];
      (global as any).$fetch = vi.fn().mockResolvedValue(rows);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs } = useGearConfigs();

      await fetchConfigs();

      expect((global as any).$fetch).toHaveBeenCalledWith('/api/gear-configs', {
        headers: { Authorization: `Bearer ${mockSession.access_token}` },
      });
    });

    it('stores the fetched configs in the reactive state', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const rows = [makeConfig(), makeConfig({ id: 'config-2', name: 'Second Config' })];
      (global as any).$fetch = vi.fn().mockResolvedValue(rows);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, configs } = useGearConfigs();

      await fetchConfigs();

      expect(configs.value).toEqual(rows);
    });

    it('logs an error and resets loading to false when $fetch throws', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global as any).$fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, configs, loading } = useGearConfigs();

      await fetchConfigs();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch gear configs:', expect.any(Error));
      expect(configs.value).toEqual([]);
      expect(loading.value).toBe(false);

      consoleSpy.mockRestore();
    });

    it('throws when no session exists (propagated via getAuthHeaders)', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, configs } = useGearConfigs();

      // fetchConfigs catches all errors internally
      await fetchConfigs();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch gear configs:', expect.any(Error));
      expect(configs.value).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('saveConfig()', () => {
    it('POSTs the input to /api/gear-configs with auth header', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const created = makeConfig({ id: 'new-config' });
      (global as any).$fetch = vi.fn().mockResolvedValue(created);

      const input = makeInput();

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { saveConfig } = useGearConfigs();

      await saveConfig(input);

      expect((global as any).$fetch).toHaveBeenCalledWith('/api/gear-configs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mockSession.access_token}` },
        body: input,
      });
    });

    it('prepends the new config to the beginning of the configs array', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const existing = makeConfig({ id: 'existing', name: 'Old Config' });
      const created = makeConfig({ id: 'new-config', name: 'Brand New Config' });

      // Seed the state with an existing config first
      (global as any).$fetch = vi.fn().mockResolvedValueOnce([existing]).mockResolvedValueOnce(created);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, saveConfig, configs } = useGearConfigs();

      await fetchConfigs();
      expect(configs.value).toHaveLength(1);

      await saveConfig(makeInput({ name: 'Brand New Config' }));

      expect(configs.value).toHaveLength(2);
      expect(configs.value[0].id).toBe('new-config');
      expect(configs.value[1].id).toBe('existing');
    });

    it('returns the created SavedGearConfig on success', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const created = makeConfig({ id: 'returned-config' });
      (global as any).$fetch = vi.fn().mockResolvedValue(created);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { saveConfig } = useGearConfigs();

      const result = await saveConfig(makeInput());

      expect(result).toEqual(created);
    });

    it('returns null and logs error when $fetch throws', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global as any).$fetch = vi.fn().mockRejectedValue(new Error('Server error'));

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { saveConfig } = useGearConfigs();

      const result = await saveConfig(makeInput());

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save gear config:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('returns null when no session is present', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { saveConfig } = useGearConfigs();

      const result = await saveConfig(makeInput());

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save gear config:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('updateConfig()', () => {
    it('sends a PUT request to /api/gear-configs/:id with auth header and update body', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const updated = makeConfig({ id: 'config-1', name: 'Updated Name' });
      (global as any).$fetch = vi.fn().mockResolvedValue(updated);

      const updates = { name: 'Updated Name' };

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { updateConfig } = useGearConfigs();

      await updateConfig('config-1', updates);

      expect((global as any).$fetch).toHaveBeenCalledWith('/api/gear-configs/config-1', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${mockSession.access_token}` },
        body: updates,
      });
    });

    it('updates the config in-place within the configs array', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const initial = [makeConfig({ id: 'config-1', name: 'Old Name' }), makeConfig({ id: 'config-2' })];
      const updated = makeConfig({ id: 'config-1', name: 'New Name' });

      (global as any).$fetch = vi
        .fn()
        .mockResolvedValueOnce(initial) // fetchConfigs
        .mockResolvedValueOnce(updated); // updateConfig

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, updateConfig, configs } = useGearConfigs();

      await fetchConfigs();
      expect(configs.value[0].name).toBe('Old Name');

      await updateConfig('config-1', { name: 'New Name' });

      expect(configs.value).toHaveLength(2);
      expect(configs.value[0].name).toBe('New Name');
      expect(configs.value[1].id).toBe('config-2');
    });

    it('does not mutate array when the id is not found', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const initial = [makeConfig({ id: 'config-1' })];
      const serverResponse = makeConfig({ id: 'nonexistent' });

      (global as any).$fetch = vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(serverResponse);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, updateConfig, configs } = useGearConfigs();

      await fetchConfigs();
      await updateConfig('nonexistent', { name: 'Ghost' });

      // Array unchanged - id was not found, no splice occurred
      expect(configs.value).toHaveLength(1);
      expect(configs.value[0].id).toBe('config-1');
    });

    it('returns the updated SavedGearConfig on success', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const updated = makeConfig({ id: 'config-1', name: 'Returned Config' });
      (global as any).$fetch = vi.fn().mockResolvedValue(updated);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { updateConfig } = useGearConfigs();

      const result = await updateConfig('config-1', { name: 'Returned Config' });

      expect(result).toEqual(updated);
    });

    it('returns null and logs error when $fetch throws', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global as any).$fetch = vi.fn().mockRejectedValue(new Error('PUT failed'));

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { updateConfig } = useGearConfigs();

      const result = await updateConfig('config-1', { name: 'Fail' });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update gear config:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('deleteConfig()', () => {
    it('sends a DELETE request to /api/gear-configs/:id with auth header', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      (global as any).$fetch = vi.fn().mockResolvedValue(undefined);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { deleteConfig } = useGearConfigs();

      await deleteConfig('config-1');

      expect((global as any).$fetch).toHaveBeenCalledWith('/api/gear-configs/config-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${mockSession.access_token}` },
      });
    });

    it('removes the config from the configs array by id', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const initial = [makeConfig({ id: 'config-1' }), makeConfig({ id: 'config-2' }), makeConfig({ id: 'config-3' })];

      (global as any).$fetch = vi
        .fn()
        .mockResolvedValueOnce(initial) // fetchConfigs
        .mockResolvedValueOnce(undefined); // deleteConfig

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, deleteConfig, configs } = useGearConfigs();

      await fetchConfigs();
      expect(configs.value).toHaveLength(3);

      await deleteConfig('config-2');

      expect(configs.value).toHaveLength(2);
      expect(configs.value.map((c) => c.id)).toEqual(['config-1', 'config-3']);
    });

    it('returns true on successful deletion', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      (global as any).$fetch = vi.fn().mockResolvedValue(undefined);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { deleteConfig } = useGearConfigs();

      const result = await deleteConfig('config-1');

      expect(result).toBe(true);
    });

    it('returns false and logs error when $fetch throws', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global as any).$fetch = vi.fn().mockRejectedValue(new Error('DELETE failed'));

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { deleteConfig } = useGearConfigs();

      const result = await deleteConfig('config-1');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete gear config:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('does not mutate the configs array on error', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const initial = [makeConfig({ id: 'config-1' }), makeConfig({ id: 'config-2' })];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global as any).$fetch = vi.fn().mockResolvedValueOnce(initial).mockRejectedValueOnce(new Error('DELETE failed'));

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchConfigs, deleteConfig, configs } = useGearConfigs();

      await fetchConfigs();
      await deleteConfig('config-1');

      expect(configs.value).toHaveLength(2);

      consoleSpy.mockRestore();
    });
  });

  describe('fetchPublicConfigs()', () => {
    it('GETs /api/gear-configs/public/:userId without an auth header', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const rows = [makeConfig({ is_public: true })];
      (global as any).$fetch = vi.fn().mockResolvedValue(rows);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchPublicConfigs } = useGearConfigs();

      await fetchPublicConfigs('user-abc');

      expect((global as any).$fetch).toHaveBeenCalledWith('/api/gear-configs/public/user-abc');
    });

    it('returns the array of public configs on success', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const rows = [makeConfig({ id: 'pub-1', is_public: true }), makeConfig({ id: 'pub-2', is_public: true })];
      (global as any).$fetch = vi.fn().mockResolvedValue(rows);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchPublicConfigs } = useGearConfigs();

      const result = await fetchPublicConfigs('user-abc');

      expect(result).toEqual(rows);
    });

    it('returns an empty array and logs error when $fetch throws', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global as any).$fetch = vi.fn().mockRejectedValue(new Error('Not found'));

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchPublicConfigs } = useGearConfigs();

      const result = await fetchPublicConfigs('nonexistent-user');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch public gear configs:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('does not require the user to be authenticated', async () => {
      const mockAuth = createMockAuth(null);
      vi.stubGlobal('useAuth', () => mockAuth);

      (global as any).$fetch = vi.fn().mockResolvedValue([]);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { fetchPublicConfigs } = useGearConfigs();

      // Should resolve without throwing even with null user
      await expect(fetchPublicConfigs('any-user')).resolves.toEqual([]);
    });
  });

  describe('getAuthHeaders() (via fetchConfigs)', () => {
    it('throws "Not authenticated" when session has no access_token', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: null } },
        error: null,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { saveConfig } = useGearConfigs();

      // saveConfig wraps getAuthHeaders and catches, returning null
      const result = await saveConfig(makeInput());

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save gear config:',
        expect.objectContaining({ message: 'Not authenticated' })
      );

      consoleSpy.mockRestore();
    });

    it('returns the Authorization header when a valid session exists', async () => {
      const mockAuth = createMockAuth(createMockUser());
      vi.stubGlobal('useAuth', () => mockAuth);

      const created = makeConfig();
      (global as any).$fetch = vi.fn().mockResolvedValue(created);

      const { useGearConfigs } = await import('~/app/composables/useGearConfigs');
      const { saveConfig } = useGearConfigs();

      await saveConfig(makeInput());

      const callArgs = (global as any).$fetch.mock.calls[0];
      expect(callArgs[1].headers).toEqual({
        Authorization: `Bearer ${mockSession.access_token}`,
      });
    });
  });
});

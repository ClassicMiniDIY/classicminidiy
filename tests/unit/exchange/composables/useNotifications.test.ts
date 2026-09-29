import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '../../../setup/mockSupabase';
import { setupGlobalMocks, createMockUser, cleanupGlobalMocks } from '../../../setup/testHelpers';

// The composable calls useToast() at the top level. setupGlobalMocks only
// stubs useAuth + useSupabase, and the global vitest.setup does NOT stub
// useToast, so we stub it per-test and keep a handle on the spy.
let mockToast: { add: ReturnType<typeof vi.fn> };
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

const DEFAULT_PREFS = {
  email_new_messages: true,
  email_new_comments: true,
  email_comment_replies: true,
  email_listing_status: true,
  email_weekly_digest: false,
  push_new_messages: true,
  email_saved_search_matches: true,
};

const stubToast = () => {
  mockToast = { add: vi.fn() };
  vi.stubGlobal('useToast', () => mockToast);
};

const importComposable = async () => {
  const mod = await import('~/app/composables/useNotifications');
  return mod.useNotifications;
};

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useNotifications', () => {
  // ---------------------------------------------------------------------------
  // fetchPreferences()
  // ---------------------------------------------------------------------------
  describe('fetchPreferences()', () => {
    it('returns null and skips the DB when user is not authenticated', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: null }));
      stubToast();

      const useNotifications = await importComposable();
      const { fetchPreferences, preferences } = useNotifications();

      const result = await fetchPreferences();

      expect(result).toBeNull();
      expect(preferences.value).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('queries notification_preferences filtered by user_id with maybeSingle()', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      const existing = { user_id: 'test-user-id', ...DEFAULT_PREFS };
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: existing, error: null });

      const useNotifications = await importComposable();
      const { fetchPreferences } = useNotifications();

      await fetchPreferences();

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_preferences');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabase._mockMaybeSingle).toHaveBeenCalled();
    });

    it('returns existing preferences and stores them in the ref', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      const existing = { user_id: 'test-user-id', ...DEFAULT_PREFS, email_weekly_digest: true };
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: existing, error: null });

      const useNotifications = await importComposable();
      const { fetchPreferences, preferences } = useNotifications();

      const result = await fetchPreferences();

      expect(result).toEqual(existing);
      expect(preferences.value).toEqual(existing);
      // Existing prefs were found, so no insert should have happened.
      expect(mockSupabase._mockInsert).not.toHaveBeenCalled();
    });

    it('creates default preferences when none exist yet', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      // First lookup finds nothing...
      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // ...so it inserts defaults and reads them back via .single().
      const inserted = { user_id: 'test-user-id', ...DEFAULT_PREFS };
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: inserted, error: null });

      const useNotifications = await importComposable();
      const { fetchPreferences, preferences } = useNotifications();

      const result = await fetchPreferences();

      expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        email_new_messages: true,
        email_new_comments: true,
        email_comment_replies: true,
        email_listing_status: true,
        email_weekly_digest: false,
        push_new_messages: true,
        email_saved_search_matches: true,
      });
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
      expect(result).toEqual(inserted);
      expect(preferences.value).toEqual(inserted);
    });

    it('shows an error toast and returns null when the lookup errors', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } });

      const useNotifications = await importComposable();
      const { fetchPreferences } = useNotifications();

      const result = await fetchPreferences();

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
    });

    it('shows an error toast and returns null when the default insert errors', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase._mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      const useNotifications = await importComposable();
      const { fetchPreferences } = useNotifications();

      const result = await fetchPreferences();

      expect(result).toBeNull();
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
    });

    it('clears the loading flag after a successful fetch', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: { user_id: 'test-user-id', ...DEFAULT_PREFS }, error: null });

      const useNotifications = await importComposable();
      const { fetchPreferences, loading } = useNotifications();

      // loading initializes to true
      expect(loading.value).toBe(true);

      await fetchPreferences();

      expect(loading.value).toBe(false);
    });

    it('clears the loading flag even when the fetch errors', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

      const useNotifications = await importComposable();
      const { fetchPreferences, loading } = useNotifications();

      await fetchPreferences();

      expect(loading.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // updatePreferences()
  // ---------------------------------------------------------------------------
  describe('updatePreferences()', () => {
    it('shows a warning toast and returns false when user is not authenticated', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: null }));
      stubToast();

      const useNotifications = await importComposable();
      const { updatePreferences } = useNotifications();

      const result = await updatePreferences({ email_weekly_digest: true });

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Authentication Required', color: 'warning' })
      );
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates notification_preferences filtered by user_id and returns true', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      // update().eq() resolves through the thenable query builder.
      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const useNotifications = await importComposable();
      const { updatePreferences } = useNotifications();

      const result = await updatePreferences({ email_weekly_digest: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_preferences');
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ email_weekly_digest: true });
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(result).toBe(true);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Saved', color: 'success' })
      );
    });

    it('merges the update into the local preferences ref on success', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const useNotifications = await importComposable();
      const { updatePreferences, preferences } = useNotifications();

      preferences.value = { ...DEFAULT_PREFS };

      await updatePreferences({ email_weekly_digest: true, email_new_messages: false });

      expect(preferences.value?.email_weekly_digest).toBe(true);
      expect(preferences.value?.email_new_messages).toBe(false);
      // Untouched fields are preserved.
      expect(preferences.value?.email_new_comments).toBe(true);
    });

    it('does not throw when the preferences ref is null on success', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const useNotifications = await importComposable();
      const { updatePreferences, preferences } = useNotifications();

      // preferences starts null; the guard `if (preferences.value)` should skip the merge.
      expect(preferences.value).toBeNull();

      const result = await updatePreferences({ email_weekly_digest: true });

      expect(result).toBe(true);
      expect(preferences.value).toBeNull();
    });

    it('shows an error toast and returns false when the update errors', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: { message: 'Update failed' } });

      const useNotifications = await importComposable();
      const { updatePreferences } = useNotifications();

      const result = await updatePreferences({ email_weekly_digest: true });

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error', description: 'Update failed' })
      );
    });

    it('falls back to a generic error description when the error has no message', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: {} });

      const useNotifications = await importComposable();
      const { updatePreferences } = useNotifications();

      const result = await updatePreferences({ email_weekly_digest: true });

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error', description: 'Failed to save preferences' })
      );
    });

    it('clears the saving flag after a successful update', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const useNotifications = await importComposable();
      const { updatePreferences, saving } = useNotifications();

      expect(saving.value).toBe(false);

      await updatePreferences({ email_weekly_digest: true });

      expect(saving.value).toBe(false);
    });

    it('clears the saving flag even when the update errors', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: { message: 'nope' } });

      const useNotifications = await importComposable();
      const { updatePreferences, saving } = useNotifications();

      await updatePreferences({ email_weekly_digest: true });

      expect(saving.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // togglePreference()
  // ---------------------------------------------------------------------------
  describe('togglePreference()', () => {
    it('returns false without calling the DB when preferences are not loaded', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      const useNotifications = await importComposable();
      const { togglePreference, preferences } = useNotifications();

      preferences.value = null;

      const result = await togglePreference('email_new_messages');

      expect(result).toBe(false);
      expect(mockSupabase._mockUpdate).not.toHaveBeenCalled();
    });

    it('persists the current (already-flipped) value when toggled off', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const useNotifications = await importComposable();
      const { togglePreference, preferences } = useNotifications();

      // v-model already flipped email_new_messages true -> false
      preferences.value = { ...DEFAULT_PREFS, email_new_messages: false };

      const result = await togglePreference('email_new_messages');

      expect(result).toBe(true);
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ email_new_messages: false });
    });

    it('persists the current (already-flipped) value when toggled on', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: null });

      const useNotifications = await importComposable();
      const { togglePreference, preferences } = useNotifications();

      // v-model already flipped email_weekly_digest false -> true
      preferences.value = { ...DEFAULT_PREFS, email_weekly_digest: true };

      const result = await togglePreference('email_weekly_digest');

      expect(result).toBe(true);
      expect(mockSupabase._mockUpdate).toHaveBeenCalledWith({ email_weekly_digest: true });
    });

    it('propagates an update failure (returns false)', async () => {
      ({ mockSupabase } = setupGlobalMocks({ user: createMockUser() }));
      stubToast();

      mockSupabase._queryBuilder.then = (resolve: any) => resolve({ error: { message: 'Update failed' } });

      const useNotifications = await importComposable();
      const { togglePreference, preferences } = useNotifications();

      preferences.value = { ...DEFAULT_PREFS, push_new_messages: false };

      const result = await togglePreference('push_new_messages');

      expect(result).toBe(false);
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', color: 'error' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // returned surface
  // ---------------------------------------------------------------------------
  describe('exposed state', () => {
    it('exposes preferences/loading/saving refs with correct initial values', async () => {
      setupGlobalMocks({ user: createMockUser() });
      stubToast();

      const useNotifications = await importComposable();
      const { preferences, loading, saving } = useNotifications();

      expect(preferences.value).toBeNull();
      expect(loading.value).toBe(true);
      expect(saving.value).toBe(false);
    });
  });
});

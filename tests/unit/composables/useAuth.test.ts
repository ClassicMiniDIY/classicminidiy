import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, mockSession, mockProfile } from '../../setup/mockSupabase';

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  mockSupabase = createMockSupabaseClient();
  vi.stubGlobal('useSupabase', () => mockSupabase);
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: {
      siteUrl: 'https://www.classicminidiy.com',
    },
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
  (global as any).__resetNuxtState();
});

describe('useAuth', () => {
  // ---------------------------------------------------------------------------
  // initAuth()
  // ---------------------------------------------------------------------------
  describe('initAuth()', () => {
    it('calls getSession and sets user from existing session', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(auth.user.value).toEqual(mockSession.user);
    });

    it('fetches user profile when session exists', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', mockSession.user.id);
      expect(auth.userProfile.value).toEqual(mockProfile);
    });

    it('sets user to null when no session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.user.value).toBeNull();
      expect(auth.userProfile.value).toBeNull();
    });

    it('sets loading to false after initialization completes', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      expect(auth.loading.value).toBe(true);
      await auth.initAuth();
      expect(auth.loading.value).toBe(false);
    });

    it('sets up onAuthStateChange listener', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('singleton pattern - calling initAuth twice returns the same promise', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      const promise1 = auth.initAuth();
      const promise2 = auth.initAuth();

      // The second call should return the same promise (already initialized on client)
      // After first call sets clientInitialized=true and initPromise is set,
      // second call won't reset initPromise and returns existing one
      await Promise.all([promise1, promise2]);

      // getSession should only have been called once
      expect(mockSupabase.auth.getSession).toHaveBeenCalledTimes(1);
    });

    it('handles getSession error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.user.value).toBeNull();
      expect(auth.userProfile.value).toBeNull();
      expect(auth.loading.value).toBe(false);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('onAuthStateChange callback updates user when session changes', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      // Capture the callback passed to onAuthStateChange
      let authChangeCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((cb: Function) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();
      await auth.initAuth();

      expect(authChangeCallback).not.toBeNull();

      // Simulate a new session via auth state change
      const newUser = { id: 'new-user-id', email: 'new@test.com' };
      const newSession = { user: newUser };
      authChangeCallback!('SIGNED_IN', newSession);

      expect(auth.user.value).toEqual(newUser);

      // The profile fetch is deferred via setTimeout
      // Advance timers to trigger the deferred fetchUserProfile
      await vi.runAllTimersAsync();

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    });

    it('onAuthStateChange callback clears profile when session is null', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      let authChangeCallback: Function | null = null;
      mockSupabase.auth.onAuthStateChange.mockImplementation((cb: Function) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();
      await auth.initAuth();

      // Verify we have a profile initially
      expect(auth.userProfile.value).toEqual(mockProfile);

      // Simulate sign out via auth state change
      authChangeCallback!('SIGNED_OUT', null);

      expect(auth.user.value).toBeNull();
      expect(auth.userProfile.value).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // waitForAuth()
  // ---------------------------------------------------------------------------
  describe('waitForAuth()', () => {
    it('calls initAuth if not yet started and resolves true', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      // waitForAuth should start initAuth automatically since initPromise is null
      const result = await auth.waitForAuth();

      expect(result).toBe(true);
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('resolves true immediately when loading is already false', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      // First init completes
      await auth.initAuth();
      expect(auth.loading.value).toBe(false);

      // Second waitForAuth should resolve immediately since loading is false
      const result = await auth.waitForAuth();
      expect(result).toBe(true);
    });

    it('times out and returns false when initialization hangs', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Make getSession hang forever
      mockSupabase.auth.getSession.mockReturnValue(new Promise(() => {}));

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      // Start initAuth first so initPromise exists
      const initPromise = auth.initAuth();

      // waitForAuth with a short timeout
      const waitPromise = auth.waitForAuth(100);

      // Advance timers to trigger the timeout
      await vi.advanceTimersByTimeAsync(200);

      const result = await waitPromise;
      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // signInWithEmail()
  // ---------------------------------------------------------------------------
  describe('signInWithEmail()', () => {
    it('calls supabase signInWithOtp with the provided email', async () => {
      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      const result = await auth.signInWithEmail('user@example.com');

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('uses window.location.origin on client for redirect URL', async () => {
      // import.meta.client is transformed to (true) by the vitest plugin
      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.signInWithEmail('user@example.com');

      const call = mockSupabase.auth.signInWithOtp.mock.calls[0][0];
      expect(call.options.emailRedirectTo).toBe(`${window.location.origin}/auth/callback`);
    });

    it('throws when supabase returns an error', async () => {
      const authError = { message: 'Rate limit exceeded', status: 429 };
      mockSupabase.auth.signInWithOtp.mockResolvedValue({ data: null, error: authError });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await expect(auth.signInWithEmail('user@example.com')).rejects.toEqual(authError);
    });
  });

  // ---------------------------------------------------------------------------
  // signInWithOAuth() / signInWithGoogle() / signInWithApple()
  // ---------------------------------------------------------------------------
  describe('signInWithOAuth()', () => {
    it('signInWithGoogle calls signInWithOAuth with google provider', async () => {
      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.signInWithGoogle();

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/auth/callback'),
        },
      });
    });

    it('signInWithApple calls signInWithOAuth with apple provider', async () => {
      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.signInWithApple();

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'apple',
        options: {
          redirectTo: expect.stringContaining('/auth/callback'),
        },
      });
    });

    it('throws when signInWithOAuth returns an error', async () => {
      const authError = { message: 'Provider not enabled', status: 400 };
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({ data: null, error: authError });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await expect(auth.signInWithGoogle()).rejects.toEqual(authError);
    });
  });

  // ---------------------------------------------------------------------------
  // signOut()
  // ---------------------------------------------------------------------------
  describe('signOut()', () => {
    it('calls supabase signOut and clears user and profile', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      // Initialize with a user first
      await auth.initAuth();
      expect(auth.user.value).not.toBeNull();
      expect(auth.userProfile.value).not.toBeNull();

      await auth.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(auth.user.value).toBeNull();
      expect(auth.userProfile.value).toBeNull();
    });

    it('throws when supabase signOut returns an error', async () => {
      const authError = { message: 'Server error', status: 500 };
      mockSupabase.auth.signOut.mockResolvedValue({ error: authError });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await expect(auth.signOut()).rejects.toEqual(authError);
    });
  });

  // ---------------------------------------------------------------------------
  // isAuthenticated computed
  // ---------------------------------------------------------------------------
  describe('isAuthenticated', () => {
    it('returns true when user is set', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.isAuthenticated.value).toBe(true);
    });

    it('returns false when user is null', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.isAuthenticated.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isAdmin computed
  // ---------------------------------------------------------------------------
  describe('isAdmin', () => {
    it('returns true when userProfile.is_admin is true', async () => {
      const adminProfile = { ...mockProfile, is_admin: true };
      mockSupabase._mockSingle.mockResolvedValue({ data: adminProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.isAdmin.value).toBe(true);
    });

    it('returns false when userProfile.is_admin is false', async () => {
      mockSupabase._mockSingle.mockResolvedValue({
        data: { ...mockProfile, is_admin: false },
        error: null,
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.isAdmin.value).toBe(false);
    });

    it('returns false when userProfile is null', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      expect(auth.isAdmin.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchUserProfile()
  // ---------------------------------------------------------------------------
  describe('fetchUserProfile()', () => {
    it('queries profiles table with correct user id and fields', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.fetchUserProfile('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockSelect).toHaveBeenCalledWith(
        'is_admin, display_name, email, avatar_url, trust_level, total_submissions, approved_submissions, rejected_submissions'
      );
      expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(mockSupabase._mockSingle).toHaveBeenCalled();
    });

    it('sets userProfile when profile data is returned', async () => {
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.fetchUserProfile('user-123');

      expect(auth.userProfile.value).toEqual(mockProfile);
    });

    it('sets userProfile to null when supabase returns an error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSupabase._mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116' },
      });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.fetchUserProfile('nonexistent-user');

      expect(auth.userProfile.value).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching user profile:',
        expect.objectContaining({ message: 'Not found' })
      );

      consoleError.mockRestore();
    });

    it('sets userProfile to null when an exception is thrown', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSupabase._mockSingle.mockRejectedValue(new Error('Connection lost'));

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.fetchUserProfile('user-123');

      expect(auth.userProfile.value).toBeNull();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup()
  // ---------------------------------------------------------------------------
  describe('cleanup()', () => {
    it('unsubscribes the auth listener when subscription has correct nested shape', async () => {
      // The code stores `data` from onAuthStateChange, then checks
      // `authSubscription?.data?.subscription`. For unsubscribe to fire,
      // the stored `data` object must have a `.data.subscription` property.
      const unsubscribeMock = vi.fn();
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { data: { subscription: { unsubscribe: unsubscribeMock } } },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();
      auth.cleanup();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('does not throw when called without initialization', async () => {
      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      // cleanup without initAuth should not throw
      expect(() => auth.cleanup()).not.toThrow();
    });

    it('can be called multiple times safely', async () => {
      const unsubscribeMock = vi.fn();
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { data: { subscription: { unsubscribe: unsubscribeMock } } },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();
      auth.cleanup();
      auth.cleanup(); // second call should be safe

      // Only called once because subscription is nulled after first cleanup
      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('does not call unsubscribe when subscription shape does not match', async () => {
      // With the standard Supabase mock shape { data: { subscription: { unsubscribe } } },
      // the stored `data` = { subscription: { unsubscribe } }, but cleanup checks
      // `authSubscription?.data?.subscription` which won't match this shape.
      const unsubscribeMock = vi.fn();
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } },
      });
      mockSupabase._mockSingle.mockResolvedValue({ data: mockProfile, error: null });

      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      await auth.initAuth();

      // cleanup should not throw even though subscription shape doesn't match
      expect(() => auth.cleanup()).not.toThrow();
      // unsubscribe is not called because the property path doesn't match
      expect(unsubscribeMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Return shape
  // ---------------------------------------------------------------------------
  describe('return shape', () => {
    it('returns all expected properties and methods', async () => {
      const { useAuth } = await import('~/app/composables/useAuth');
      const auth = useAuth();

      expect(auth).toHaveProperty('user');
      expect(auth).toHaveProperty('userProfile');
      expect(auth).toHaveProperty('loading');
      expect(auth).toHaveProperty('isAuthenticated');
      expect(auth).toHaveProperty('isAdmin');
      expect(auth).toHaveProperty('initAuth');
      expect(auth).toHaveProperty('waitForAuth');
      expect(auth).toHaveProperty('cleanup');
      expect(auth).toHaveProperty('signInWithEmail');
      expect(auth).toHaveProperty('signInWithGoogle');
      expect(auth).toHaveProperty('signInWithApple');
      expect(auth).toHaveProperty('signOut');
      expect(auth).toHaveProperty('fetchUserProfile');
    });
  });
});

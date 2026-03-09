import type { User } from '@supabase/supabase-js';

interface UserProfile {
  is_admin: boolean;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  trust_level: 'new' | 'contributor' | 'trusted' | 'moderator' | 'admin';
  total_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
}

// Store auth subscription and init promise outside of useState to avoid SSR serialization issues
let authSubscription: { data: { subscription: any } } | null = null;
let initPromise: Promise<void> | null = null;
let clientInitialized = false;

export const useAuth = () => {
  const supabase = useSupabase();
  const config = useRuntimeConfig();
  const user = useState<User | null>('user', () => null);
  const userProfile = useState<UserProfile | null>('user-profile', () => null);
  const loading = useState<boolean>('auth-loading', () => true);

  // Fetch user profile including admin status
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'is_admin, display_name, email, avatar_url, trust_level, total_submissions, approved_submissions, rejected_submissions'
        )
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        userProfile.value = null;
        return;
      }

      userProfile.value = data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      userProfile.value = null;
    }
  };

  // Initialize auth state
  const initAuth = async () => {
    // On client-side, if we haven't initialized yet, force re-initialization
    // This ensures we load the session from localStorage after SSR
    if (import.meta.client && !clientInitialized) {
      initPromise = null;
      clientInitialized = true;
    }

    // Return existing promise if already initializing
    if (initPromise) {
      return initPromise;
    }

    // Reset loading state to true when starting initialization
    loading.value = true;

    // Create and store the initialization promise
    initPromise = (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        user.value = session?.user ?? null;

        // Fetch profile if user is authenticated
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('[initAuth] Error initializing auth:', error);
        user.value = null;
        userProfile.value = null;
      } finally {
        loading.value = false;
      }

      // Listen for auth changes.
      // IMPORTANT: This callback must be synchronous (not async) and defer any
      // Supabase data calls to a macrotask via setTimeout to avoid deadlock.
      // See TME's useAuth.ts for full explanation.
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        user.value = session?.user ?? null;

        if (session?.user) {
          // Defer profile fetch to avoid auth lock deadlock
          setTimeout(() => fetchUserProfile(session.user.id), 0);
        } else {
          userProfile.value = null;
        }
      });

      // Store subscription for cleanup
      authSubscription = data;
    })();

    return initPromise;
  };

  // Wait for auth to be ready (Promise-based)
  const waitForAuth = async (timeout: number = 5000): Promise<boolean> => {
    // If init hasn't started yet, start it
    if (!initPromise) {
      await initAuth();
      return true;
    }

    // If loading is false, init has already completed
    if (!loading.value) {
      return true;
    }

    // Wait for the current initialization to complete
    try {
      await Promise.race([
        initPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth initialization timeout')), timeout)),
      ]);
      return true;
    } catch (error) {
      console.error('[waitForAuth] Auth initialization timed out:', error);
      return false;
    }
  };

  // Cleanup auth subscription
  const cleanup = () => {
    if (authSubscription?.data?.subscription) {
      authSubscription.data.subscription.unsubscribe();
      authSubscription = null;
    }
  };

  // Sign in with magic link
  const signInWithEmail = async (email: string) => {
    const redirectUrl = import.meta.client
      ? `${window.location.origin}/auth/callback`
      : `${config.public.siteUrl}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) throw error;

    return { success: true };
  };

  // Sign in with OAuth provider (Google, Apple)
  const signInWithOAuth = async (provider: 'google' | 'apple') => {
    const redirectUrl = import.meta.client
      ? `${window.location.origin}/auth/callback`
      : `${config.public.siteUrl}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) throw error;
  };

  const signInWithGoogle = () => signInWithOAuth('google');
  const signInWithApple = () => signInWithOAuth('apple');

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    user.value = null;
    userProfile.value = null;
  };

  // Check if user is authenticated
  const isAuthenticated = computed(() => !!user.value);

  // Check if user is admin
  const isAdmin = computed(() => userProfile.value?.is_admin ?? false);

  return {
    user,
    userProfile,
    loading,
    isAuthenticated,
    isAdmin,
    initAuth,
    waitForAuth,
    cleanup,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut,
    fetchUserProfile,
  };
};

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
  // Sustaining Member status. NOT a `profiles` column — it is computed by
  // user_has_subscription() and folded in here so the badge + benefits area
  // can gate on shared auth state (keystone §9). See fetchMembership below.
  is_sustaining_member: boolean;
}

// Store auth subscription and init promise outside of useState to avoid SSR serialization issues
let authSubscription: { data: { subscription: any } } | null = null;
let initPromise: Promise<void> | null = null;
let clientInitialized = false;

export const useAuth = () => {
  const supabase = useSupabase();
  const config = useRuntimeConfig();
  const { identifyUser, resetIdentity } = useAnalytics();
  const user = useState<User | null>('user', () => null);
  const userProfile = useState<UserProfile | null>('user-profile', () => null);
  const loading = useState<boolean>('auth-loading', () => true);

  // Tie PostHog's distinct_id to the authenticated user so all subsequent
  // events are attributable. Reads from userProfile, so call AFTER
  // fetchUserProfile has resolved. No-op on SSR ($posthog is client-only).
  const syncPostHogIdentity = (userId: string) => {
    const p = userProfile.value;
    identifyUser(userId, {
      email_domain: p?.email ? p.email.split('@')[1] : undefined,
      trust_level: p?.trust_level,
      is_admin: p?.is_admin,
      is_sustaining_member: p?.is_sustaining_member,
    });
  };

  // Read Sustaining Member status through the canonical gate (keystone §9).
  // This is the ONLY contract-approved way to read own membership — never query
  // the `subscriptions` table directly. Defaults to false on any error so the
  // profile still loads.
  const fetchMembership = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('user_has_subscription', { p_user_id: userId });
      if (error) {
        console.error('Error checking sustaining membership:', error);
        return false;
      }
      return data ?? false;
    } catch (error) {
      console.error('Error checking sustaining membership:', error);
      return false;
    }
  };

  // Fetch user profile including admin status + Sustaining Member status
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

      // Membership is computed, not a profiles column — fold it into shared state.
      const isSustaining = await fetchMembership(userId);
      userProfile.value = { ...data, is_sustaining_member: isSustaining } as UserProfile;
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
          syncPostHogIdentity(session.user.id);
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
          // Defer profile fetch to avoid auth lock deadlock, then attach
          // the PostHog identity once profile props are available.
          setTimeout(() => {
            fetchUserProfile(session.user.id).then(() => syncPostHogIdentity(session.user.id));
          }, 0);
        } else {
          userProfile.value = null;
          // Signed out — clear identity so the next session isn't merged in.
          resetIdentity();
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
  const signInWithEmail = async (email: string, captchaToken?: string) => {
    const redirectUrl = import.meta.client
      ? `${window.location.origin}/auth/callback`
      : `${config.public.siteUrl}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
        captchaToken,
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

  // Single source of truth for Sustaining Member gating across pages/components.
  const isSustainingMember = computed(() => userProfile.value?.is_sustaining_member ?? false);

  return {
    user,
    userProfile,
    loading,
    isAuthenticated,
    isAdmin,
    isSustainingMember,
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

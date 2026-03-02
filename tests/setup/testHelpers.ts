import { vi } from 'vitest';
import { ref, computed } from 'vue';
import { createMockSupabaseClient, mockProfile } from './mockSupabase';

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockAuth = (userValue: any = null) => {
  const user = ref(userValue);
  const userProfileRef = ref(userValue ? mockProfile : null);
  const loading = ref(false);
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => userProfileRef.value?.is_admin ?? false);

  return {
    user,
    userProfile: userProfileRef,
    loading,
    isAuthenticated,
    isAdmin,
    initAuth: vi.fn().mockResolvedValue(undefined),
    waitForAuth: vi.fn().mockResolvedValue(true),
    fetchUserProfile: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue({ success: true }),
    signInWithOAuth: vi.fn().mockResolvedValue(undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithApple: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
  };
};

export const setupGlobalMocks = (options: { user?: any; supabase?: any } = {}) => {
  const mockUser = options.user !== undefined ? options.user : null;
  const mockAuth = createMockAuth(mockUser);
  const mockSupabase = options.supabase || createMockSupabaseClient();

  vi.stubGlobal('useAuth', () => mockAuth);
  vi.stubGlobal('useSupabase', () => mockSupabase);

  return { mockAuth, mockSupabase };
};

export const cleanupGlobalMocks = () => {
  vi.unstubAllGlobals();
  vi.resetModules();
  if ((global as any).__resetNuxtState) {
    (global as any).__resetNuxtState();
  }
};

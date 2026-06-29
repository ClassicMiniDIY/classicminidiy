import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed } from 'vue';
import { cleanupGlobalMocks } from '../../../setup/testHelpers';

/**
 * Tests for useOnboardingGate — the single source of truth for
 * "does this user still need to complete onboarding?".
 *
 * Contract (from the composable's docblock):
 *   needsOnboarding === true  iff  ALL of:
 *     - exchangeEnabled is truthy            (flag gate)
 *     - isAuthenticated.value is true        (logged in)
 *     - userProfile.value is truthy          (profile loaded, not null)
 *     - userProfile.value.onboarding_completed === false  (explicit false)
 *
 * It is intentionally conservative: a still-loading (null) profile, or a
 * profile whose onboarding_completed is undefined/true, yields false. So does
 * the flag being off or the user being anonymous.
 */

// Fine-grained auth stub. Unlike testHelpers' createMockAuth (which couples
// userProfile to a fixed mockProfile), this lets each test drive the exact
// isAuthenticated + userProfile state needed to exercise one truth-table row.
type ProfileShape = { onboarding_completed?: boolean | null } | null;

const stubAuth = (opts: { authed: boolean; profile: ProfileShape }) => {
  const user = ref(opts.authed ? { id: 'test-user-id' } : null);
  const userProfile = ref<ProfileShape>(opts.profile);
  const isAuthenticated = computed(() => !!user.value);
  const auth = { user, userProfile, isAuthenticated };
  vi.stubGlobal('useAuth', () => auth);
  return auth;
};

const stubExchangeFlag = (value: unknown) => {
  vi.stubGlobal(
    'useRuntimeConfig',
    vi.fn(() => ({
      public: {
        siteUrl: 'https://www.classicminidiy.com',
        exchangeEnabled: value,
      },
    }))
  );
};

const loadComposable = async () => {
  const { useOnboardingGate } = await import('~/app/composables/useOnboardingGate');
  return useOnboardingGate();
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useOnboardingGate', () => {
  // ---------------------------------------------------------------------------
  // Flag gate: exchangeEnabled off short-circuits everything
  // ---------------------------------------------------------------------------
  describe('flag gate (exchangeEnabled)', () => {
    it('is false when the flag is off, even with a fully-onboarding-pending user', async () => {
      stubExchangeFlag(false);
      stubAuth({ authed: true, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });

    it('is false when the flag is undefined (default runtime config has no exchangeEnabled)', async () => {
      stubExchangeFlag(undefined);
      stubAuth({ authed: true, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });

    it('is true only when the flag is on AND every other condition is met', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Auth gate: anonymous users never need onboarding
  // ---------------------------------------------------------------------------
  describe('auth gate (isAuthenticated)', () => {
    it('is false for an anonymous visitor even with the flag on', async () => {
      stubExchangeFlag(true);
      // Anonymous: no user. createMockAuth-style anon also nulls the profile,
      // but assert the auth gate independently of the profile gate.
      stubAuth({ authed: false, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });

    it('is false for an anonymous visitor with a null profile (typical anon state)', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: false, profile: null });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Profile-loaded gate: null profile (still loading) stays false — no flash
  // ---------------------------------------------------------------------------
  describe('profile-loaded gate (userProfile)', () => {
    it('is false while the profile is still null (loading), preventing a premature nudge flash', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: null });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // onboarding_completed branch: must be EXPLICIT === false
  // ---------------------------------------------------------------------------
  describe('onboarding_completed branch (strict === false)', () => {
    it('is true when onboarding_completed === false', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(true);
    });

    it('is false when onboarding_completed === true (already onboarded)', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: { onboarding_completed: true } });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });

    it('is false when onboarding_completed is undefined (column absent on profile)', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: {} });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(false);
    });

    it('is false when onboarding_completed is null (strict equality, not loose falsy)', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: { onboarding_completed: null } });

      const { needsOnboarding } = await loadComposable();

      // null !== false — the === false check must NOT treat null as "needs onboarding".
      expect(needsOnboarding.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Truth table — every combination of (flag, authed, profile-present,
  // onboarding_completed). The single true case is the conjunction of all gates.
  // ---------------------------------------------------------------------------
  describe('full truth table', () => {
    type Row = {
      flag: boolean;
      authed: boolean;
      profile: ProfileShape;
      expected: boolean;
      label: string;
    };

    const rows: Row[] = [
      // flag OFF — always false regardless of the rest
      { flag: false, authed: false, profile: null, expected: false, label: 'flag off / anon / no profile' },
      {
        flag: false,
        authed: true,
        profile: { onboarding_completed: false },
        expected: false,
        label: 'flag off / authed / pending',
      },
      {
        flag: false,
        authed: true,
        profile: { onboarding_completed: true },
        expected: false,
        label: 'flag off / authed / done',
      },
      // flag ON, anon — always false
      { flag: true, authed: false, profile: null, expected: false, label: 'flag on / anon / no profile' },
      {
        flag: true,
        authed: false,
        profile: { onboarding_completed: false },
        expected: false,
        label: 'flag on / anon / pending profile present',
      },
      // flag ON, authed, profile null — false (loading)
      { flag: true, authed: true, profile: null, expected: false, label: 'flag on / authed / profile loading (null)' },
      // flag ON, authed, profile present — depends on onboarding_completed
      {
        flag: true,
        authed: true,
        profile: { onboarding_completed: false },
        expected: true,
        label: 'flag on / authed / pending (=== false) ⇒ THE one true case',
      },
      {
        flag: true,
        authed: true,
        profile: { onboarding_completed: true },
        expected: false,
        label: 'flag on / authed / done (true)',
      },
      {
        flag: true,
        authed: true,
        profile: {},
        expected: false,
        label: 'flag on / authed / onboarding_completed undefined',
      },
      {
        flag: true,
        authed: true,
        profile: { onboarding_completed: null },
        expected: false,
        label: 'flag on / authed / onboarding_completed null',
      },
    ];

    it.each(rows)('$label ⇒ $expected', async ({ flag, authed, profile, expected }) => {
      stubExchangeFlag(flag);
      stubAuth({ authed, profile });

      const { needsOnboarding } = await loadComposable();

      expect(needsOnboarding.value).toBe(expected);
    });

    it('has exactly one true row in the truth table (only the full conjunction)', () => {
      expect(rows.filter((r) => r.expected).length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Reactivity — the computed re-evaluates when underlying auth refs change.
  // This is the load-bearing behavior: the nudge must appear/disappear as the
  // profile finishes loading and onboarding gets completed, without remount.
  // ---------------------------------------------------------------------------
  describe('reactivity', () => {
    it('flips false → true when a null (loading) profile resolves to a pending one', async () => {
      stubExchangeFlag(true);
      const auth = stubAuth({ authed: true, profile: null });

      const { needsOnboarding } = await loadComposable();
      expect(needsOnboarding.value).toBe(false);

      // Profile finishes loading, onboarding not yet done.
      auth.userProfile.value = { onboarding_completed: false };
      expect(needsOnboarding.value).toBe(true);
    });

    it('flips true → false when the user completes onboarding', async () => {
      stubExchangeFlag(true);
      const auth = stubAuth({ authed: true, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();
      expect(needsOnboarding.value).toBe(true);

      auth.userProfile.value = { onboarding_completed: true };
      expect(needsOnboarding.value).toBe(false);
    });

    it('flips true → false when the user signs out (auth ref clears)', async () => {
      stubExchangeFlag(true);
      const auth = stubAuth({ authed: true, profile: { onboarding_completed: false } });

      const { needsOnboarding } = await loadComposable();
      expect(needsOnboarding.value).toBe(true);

      // Sign out: clear the user; profile clears too in real signOut.
      auth.user.value = null;
      auth.userProfile.value = null;
      expect(needsOnboarding.value).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Surface shape
  // ---------------------------------------------------------------------------
  describe('returned API', () => {
    it('exposes only needsOnboarding as a readable computed ref', async () => {
      stubExchangeFlag(true);
      stubAuth({ authed: true, profile: { onboarding_completed: true } });

      const result = await loadComposable();

      expect(Object.keys(result)).toEqual(['needsOnboarding']);
      // computed refs expose a .value getter
      expect(result.needsOnboarding).toHaveProperty('value');
      expect(typeof result.needsOnboarding.value).toBe('boolean');
    });
  });
});

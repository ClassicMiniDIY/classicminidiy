/**
 * Single source of truth for "does this user still need to complete onboarding?"
 *
 * Drives three consumers:
 *  - OnboardingNudge.vue (renders the soft toolbox nudge when true)
 *  - pages/index.vue     (hides the homepage chat overlay when true)
 *  - middleware/exchange-onboarding.global.ts (the hard /exchange gate — though
 *    the middleware does its own async profile fetch to avoid the load race)
 *
 * The whole onboarding concept is flag-gated: when `exchangeEnabled` is off
 * (pre-cutover) this is always false, so nothing about onboarding is visible.
 *
 * `needsOnboarding` is intentionally conservative: it is true ONLY once we have
 * a loaded profile whose `onboarding_completed` is explicitly false. While the
 * profile is still loading (null) it stays false, so there's no premature nudge
 * flash before auth settles.
 */
export function useOnboardingGate() {
  const { exchangeEnabled } = useRuntimeConfig().public;
  const { isAuthenticated, userProfile } = useAuth();

  // Needs onboarding = a loaded profile that is NOT explicitly completed. This
  // covers existing users whose `onboarding_completed` is null (the column was
  // backfilled to null, not false) as well as new users (false) — both get the
  // nudge that drives them into the flow. Requiring a LOADED profile (`!!`) keeps
  // it from flashing before auth/profile settle.
  const needsOnboarding = computed(
    () =>
      !!exchangeEnabled &&
      isAuthenticated.value &&
      !!userProfile.value &&
      userProfile.value.onboarding_completed !== true
  );

  return { needsOnboarding };
}

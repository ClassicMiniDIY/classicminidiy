// Hard onboarding gate for the Mini Exchange section.
//
// When the exchange is live (NUXT_PUBLIC_EXCHANGE_ENABLED on), a logged-in user
// whose profile isn't complete cannot enter any /exchange route — they're
// redirected to the full /onboarding page (non-skippable), with their intended
// destination preserved as ?redirect=. Anonymous visitors pass through so public
// listing pages stay browsable + indexable. The soft, skippable toolbox nudge
// lives in OnboardingNudge.vue (see useOnboardingGate).
//
// Client-only: the Supabase session is in localStorage, so SSR can't know auth
// state. We actively wait for auth + fetch the profile before deciding, so a
// not-onboarded user can't slip in during the auth-load window. Verified state
// is cached per user id to avoid refetching on every in-section navigation.
import { EXCHANGE_PREFIXES, pathInPrefixes } from '~/utils/exchangeRoutes';

let verifiedUserId: string | null = null;

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  // The whole onboarding concept is flag-gated.
  const { exchangeEnabled } = useRuntimeConfig().public;
  if (!exchangeEnabled) return;

  // Guard the whole Exchange — the /exchange section AND the user's marketplace
  // management tabs under /dashboard (shared prefix list with the flag-gate).
  if (!pathInPrefixes(to.path, EXCHANGE_PREFIXES)) return;

  // Never trap the onboarding page or the auth callback.
  if (to.path === '/onboarding' || to.path === '/auth/callback') return;

  const { user, userProfile, waitForAuth, fetchUserProfile } = useAuth();
  await waitForAuth(1500);

  // Anonymous browsing of the exchange stays public.
  if (!user.value) return;

  // Already verified this user this session — skip.
  if (verifiedUserId === user.value.id) return;

  // Race with the deferred onAuthStateChange fetch: pull the profile now.
  if (!userProfile.value) {
    await fetchUserProfile(user.value.id);
  }

  if (userProfile.value?.onboarding_completed) {
    verifiedUserId = user.value.id;
    return;
  }

  // Incomplete (or profile still unknown) → send to the full onboarding flow,
  // preserving where they were headed.
  return navigateTo(`/onboarding?redirect=${encodeURIComponent(to.fullPath)}`);
});

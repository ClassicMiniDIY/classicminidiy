// Onboarding gate for the Mini Exchange — applied only at the point of ACTION.
//
// When the exchange is live (NUXT_PUBLIC_EXCHANGE_ENABLED on), browsing the
// marketplace is open to EVERYONE (anonymous or logged-in, onboarded or not) so
// existing users are never walled out. Onboarding is only required to *act* —
// create a listing, post a want, submit a find, or message (EXCHANGE_ONBOARDING_
// PREFIXES). A logged-in user without a completed profile who hits one of those
// is redirected to the full /onboarding page, intended destination preserved as
// ?redirect=. The soft nudge that DRIVES onboarding from browse pages lives in
// OnboardingNudge.vue (see useOnboardingGate).
//
// Client-only: the Supabase session is in localStorage, so SSR can't know auth
// state. We actively wait for auth + fetch the profile before deciding, so a
// not-onboarded user can't slip in during the auth-load window. Verified state
// is cached per user id to avoid refetching on every in-section navigation.
import { EXCHANGE_ONBOARDING_PREFIXES, pathInPrefixes } from '~/utils/exchangeRoutes';

let verifiedUserId: string | null = null;

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  // The whole onboarding concept is flag-gated.
  const { exchangeEnabled } = useRuntimeConfig().public;
  if (!exchangeEnabled) return;

  // Only gate the action routes (create/list/post/message). Browse + detail +
  // dashboard tabs are intentionally NOT here — they stay open to everyone.
  if (!pathInPrefixes(to.path, EXCHANGE_ONBOARDING_PREFIXES)) return;

  // Never trap the onboarding page or the auth callback.
  if (to.path === '/onboarding' || to.path === '/auth/callback') return;

  const { user, userProfile, waitForAuth, fetchUserProfile } = useAuth();
  // Wait for auth to actually settle before deciding. If the bounded wait times
  // out (e.g. a slow session/token refresh), extend it once — otherwise a
  // slow-loading logged-in user would be read as null here, mistaken for an
  // anonymous visitor, and allowed to bypass onboarding.
  if (!(await waitForAuth(1500))) {
    await waitForAuth();
  }

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

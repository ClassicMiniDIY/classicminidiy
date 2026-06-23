// Named middleware for auth-gated Mini Exchange pages (create/edit listing,
// wanted/new, finds/submit, messages, watchlist). Mirrors admin.global.ts but
// for any-authenticated-user. Client-side (session is in localStorage); SSR
// passes through and the client redirects if signed out. Reference via
// definePageMeta({ middleware: 'exchange-auth' }).
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;
  const { waitForAuth, isAuthenticated } = useAuth();
  await waitForAuth();
  if (!isAuthenticated.value) {
    return navigateTo('/login', { replace: true });
  }
});

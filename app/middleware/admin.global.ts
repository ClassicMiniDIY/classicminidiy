export default defineNuxtRouteMiddleware(async (to) => {
  // Only apply to admin routes
  if (!to.path.startsWith('/admin')) {
    return;
  }

  // Skip middleware on server-side during initial page load
  if (import.meta.server) {
    return;
  }

  const { waitForAuth, isAuthenticated, isAdmin } = useAuth();
  await waitForAuth();

  if (!isAuthenticated.value || !isAdmin.value) {
    return navigateTo('/login', { replace: true });
  }
});

// The Mini Exchange cutover gate. Until NUXT_PUBLIC_EXCHANGE_ENABLED flips true
// at go-live, every marketplace surface 404s — on the server too, so the routes
// are invisible and uncrawlable in production even while the `tme-merge` code is
// already merged to main. Flipping the flag (env-only, no rebuild) lights them up.
//
// Runs on server AND client (unlike admin.global.ts) so SSR returns a real 404,
// not a flash of content. Keep this list in sync as marketplace surfaces land:
// the /exchange section, the dashboard/admin exchange tabs, and the feeds.
const GUARDED_PREFIXES = [
  '/exchange',
  '/dashboard/listings',
  '/dashboard/wanted',
  '/dashboard/notifications',
  '/dashboard/saved-searches',
  '/admin/exchange',
];

export default defineNuxtRouteMiddleware((to) => {
  const isGuarded = GUARDED_PREFIXES.some((prefix) => to.path === prefix || to.path.startsWith(`${prefix}/`));
  if (!isGuarded) {
    return;
  }

  const { exchangeEnabled } = useRuntimeConfig().public;
  if (!exchangeEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' });
  }
});

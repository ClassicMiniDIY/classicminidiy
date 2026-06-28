// The Mini Exchange cutover gate. Until NUXT_PUBLIC_EXCHANGE_ENABLED flips true
// at go-live, every marketplace surface 404s — on the server too, so the routes
// are invisible and uncrawlable in production even while the `tme-merge` code is
// already merged to main. Flipping the flag (env-only, no rebuild) lights them up.
//
// Runs on server AND client (unlike admin.global.ts) so SSR returns a real 404,
// not a flash of content. The guarded set lives in ~/utils/exchangeRoutes so the
// flag-gate and the onboarding-gate share one definition of "the Exchange".
import { EXCHANGE_FLAG_PREFIXES, pathInPrefixes } from '~/utils/exchangeRoutes';

export default defineNuxtRouteMiddleware((to) => {
  if (!pathInPrefixes(to.path, EXCHANGE_FLAG_PREFIXES)) {
    return;
  }

  const { exchangeEnabled } = useRuntimeConfig().public;
  if (!exchangeEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' });
  }
});

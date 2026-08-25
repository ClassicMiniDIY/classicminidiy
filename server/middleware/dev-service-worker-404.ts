/**
 * Quietly 404 service-worker asset requests in DEVELOPMENT ONLY.
 *
 * `@vite-pwa/nuxt` has no `devOptions.enabled` in nuxt.config.ts, so no
 * `sw.js` is generated when running `nuxi dev`. A browser that has previously
 * registered the production service worker — from classicminidiy.com, or from
 * a local `bun run build && bun run start` on the same origin — keeps polling
 * `/sw.js` for updates every few seconds regardless.
 *
 * With no file to serve, that request falls through to the Vue catch-all
 * (`app/pages/[...slug].vue`), which correctly throws a fatal 404 ("Archive
 * document not found"). Correct, but it renders a full page and prints a
 * multi-line fatal stack trace into the dev server log every few seconds,
 * which buries real errors.
 *
 * This returns the same 404 without involving the router. It is gated on
 * `import.meta.dev`, so in production these paths are untouched and the real
 * service worker is served from the static output as before — do not remove
 * that guard.
 */

const SERVICE_WORKER_PATHS = /^\/(sw\.js|workbox-[^/]+\.js|registerSW\.js)$/;

export default defineEventHandler((event) => {
  if (!import.meta.dev) return;

  const path = getRequestURL(event).pathname;
  if (!SERVICE_WORKER_PATHS.test(path)) return;

  setResponseStatus(event, 404);
  return '';
});

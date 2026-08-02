/**
 * JSON 404 for unmatched `/api/**` paths.
 *
 * Without this, a request to an API path with no handler is not answered by
 * Nitro at all — it falls through to the Vue app, matches the site-wide
 * catch-all `app/pages/[...slug].vue`, and that page (correctly, since 2026-07)
 * throws `createError({ statusCode: 404, fatal: true })` with the message
 * "Archive document not found".
 *
 * So a missing API route surfaced as an HTML error page carrying an unrelated
 * archive message, `$fetch` callers saw a parse-shaped failure instead of a 404,
 * and the whole SSR render was spent on it. That is how one missing route
 * (`/api/exchange-rates`) turned into a 500 on every marketplace listing page.
 *
 * Nitro prefers the most specific route, so this only ever runs when nothing
 * else matched.
 */
export default defineEventHandler((event) => {
  throw createError({
    statusCode: 404,
    statusMessage: `No API route for ${event.method} ${event.path}`,
  });
});

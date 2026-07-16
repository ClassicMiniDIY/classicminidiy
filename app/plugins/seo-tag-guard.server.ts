import { normalizeSocialImageContent } from '../utils/seoTagGuards';

/**
 * SSR-only safety net for nuxt-og-image (see app/utils/seoTagGuards.ts).
 * `tags:beforeResolve` always runs before any `tags:afterResolve` hook, so the
 * non-string content is sanitized before nuxt-og-image calls `.replaceAll()`
 * on it. Without this, a page passing a non-string og:image/twitter:image
 * (e.g. an empty string, which unhead coerces to `true`) 500s the whole page.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.ssrContext?.head?.use({
    key: 'cmdiy:social-image-content-guard',
    hooks: {
      'tags:beforeResolve': (ctx) => {
        normalizeSocialImageContent(ctx.tags);
      },
    },
  });
});

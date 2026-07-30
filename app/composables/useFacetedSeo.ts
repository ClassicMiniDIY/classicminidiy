/**
 * Canonical + robots handling for browse/index pages that carry query parameters.
 *
 * The problem this solves: `nuxt-seo-utils` derives the self-referencing canonical
 * from the CURRENT URL including its query string. On a faceted browse page that
 * means every filter/sort permutation self-canonicalises into its own indexable
 * URL — `/exchange/listings?category=engine&sort=price_asc&page=3` declared itself
 * the canonical version of a page that is really just `/exchange/listings`. With a
 * handful of facets that is a combinatorial crawl trap, and every combination is a
 * near-duplicate of the unfiltered list.
 *
 * The policy here is the conventional one for faceted navigation:
 *
 *   - **Pagination is indexable.** `?page=2` gets a self-referencing canonical, so
 *     deep items stay discoverable. (Google deprecated rel=prev/next; a plain
 *     self-canonical on each page is the current recommendation.)
 *   - **Filters and sorts are not.** Any parameter outside `indexableParams` makes
 *     the response `noindex, follow` and points the canonical at the clean URL.
 *     `follow` matters — crawlers should still traverse into the detail pages a
 *     filtered view links to; we just don't want the view itself in the index.
 *   - **Unknown/junk params are treated as filters**, which also neutralises
 *     tracking-parameter URLs (`?utm_source=…`, `?fbclid=…`) that get linked from
 *     elsewhere and would otherwise duplicate the page.
 *
 * Params are sorted when rebuilt so `?page=2&type=manual` and `?type=manual&page=2`
 * can never produce two different canonicals for the same view.
 *
 * @example
 * useFacetedSeo('/exchange/listings');              // only ?page= stays indexable
 * useFacetedSeo('/models', { indexableParams: [] }); // nothing but the bare path
 */
export interface FacetedSeoOptions {
  /**
   * Query params allowed to remain in the canonical URL and keep the page
   * indexable. Defaults to `['page']`. Pass `[]` to canonicalise everything to the
   * bare path.
   */
  indexableParams?: string[];
}

export const useFacetedSeo = (path: string, options: FacetedSeoOptions = {}) => {
  const { indexableParams = ['page'] } = options;
  const route = useRoute();
  const config = useRuntimeConfig();
  const siteUrl = (config.public.siteUrl as string) || 'https://www.classicminidiy.com';

  const allowed = new Set(indexableParams);

  /** Params on the current URL that are NOT in the indexable allowlist. */
  const facetParams = computed(() => Object.keys(route.query).filter((key) => !allowed.has(key)));

  /** True when the current view is a filtered/sorted slice rather than the list itself. */
  const isFaceted = computed(() => facetParams.value.length > 0);

  const canonical = computed(() => {
    // Rebuild from the allowlist only, dropping empty values so `?page=` and
    // `?page=1` both collapse onto the bare path rather than splitting it in two.
    const params = new URLSearchParams();
    for (const key of indexableParams) {
      const raw = route.query[key];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value == null || value === '') continue;
      if (key === 'page' && String(value) === '1') continue;
      params.set(key, String(value));
    }
    params.sort();
    const qs = params.toString();
    return `${siteUrl}${path}${qs ? `?${qs}` : ''}`;
  });

  useHead({
    link: [{ rel: 'canonical', href: () => canonical.value }],
  });

  // Go through @nuxtjs/robots rather than writing the meta tag ourselves. Setting
  // `robots` via useSeoMeta REPLACES the module's tag, which silently drops
  // `max-image-preview:large` / `max-snippet:-1` from clean URLs — directives that
  // matter for rich results and AI snippets.
  //
  // Set the rule ONLY on faceted views. Never assign `true` to "restore" the
  // default: useRobotsRule maps `true` to `robotsEnabledValue` unconditionally,
  // which would force `index, follow` onto preview deployments that are supposed
  // to stay noindex. Not calling it at all is what leaves the environment default
  // intact.
  //
  // This runs once per SSR request, which is the only pass that matters — a
  // crawler always fetches the faceted URL directly and gets this response.
  // Client-side filter changes don't re-run setup, and don't need to.
  if (isFaceted.value) {
    useRobotsRule('noindex, follow');
  }

  return { canonical, isFaceted, facetParams };
};

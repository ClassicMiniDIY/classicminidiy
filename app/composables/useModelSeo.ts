import { type ModelDetail, priceLabel } from '~~/data/models/model-library';

/**
 * Centralizes SEO + social metadata for a 3D Model Library detail page
 * (`/models/[slug]`): canonical/OG/Twitter tags, schema.org Product JSON-LD, and
 * the branded OG image (via nuxt-og-image). Kept out of the page component so the
 * tag logic stays in one place.
 *
 * i18n note: vue-i18n's per-component `<i18n>` blocks aren't visible from a
 * composable's scope, so the caller resolves the fallback strings with its own
 * `t()` and passes them in. Real models almost always have a title + summary, so
 * the fallbacks only surface for thin records.
 */

// Site-wide default OG image (mirrors nuxt.config head) — used when a model has
// no uploaded photo so a share never renders an empty image.
const SITE_DEFAULT_OG = 'https://classicminidiy.s3.us-east-1.amazonaws.com/misc/seo-images/avatar.jpg';
const BRAND = 'Classic Mini DIY';

function excerpt(s: string | null | undefined, max = 160): string {
  if (!s) return '';
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function useModelSeo(opts: {
  model: Ref<ModelDetail | null | undefined>;
  slug: Ref<string>;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const { model, slug, fallbackTitle, fallbackDescription } = opts;
  const site = useSiteConfig();

  const baseUrl = computed(() => (site.url || 'https://classicminidiy.com').replace(/\/$/, ''));
  const canonical = computed(() => `${baseUrl.value}/models/${slug.value}`);

  const pageTitle = computed(() => `${model.value?.title || fallbackTitle} | ${BRAND}`);

  // Description: prefer the seller's summary, then a description excerpt, then the
  // generic fallback — so a model without a summary still gets meaningful text.
  const description = computed(
    () => model.value?.summary?.trim() || excerpt(model.value?.description) || fallbackDescription
  );

  // The seller's tags drive keywords + article:tag (they did nothing before).
  const tags = computed(() => (model.value?.tags ?? []).filter(Boolean).slice(0, 12));
  const keywords = computed(() => [...tags.value, 'classic mini', '3d printing', 'stl'].join(', '));

  // The model's uploaded photo, if any — embedded in the branded OG card below.
  const photo = computed(() => model.value?.images?.[0]?.url || '');

  useSeoMeta({
    title: () => pageTitle.value,
    description: () => description.value,
    keywords: () => keywords.value,
    ogType: 'article',
    ogTitle: () => model.value?.title || fallbackTitle,
    ogDescription: () => description.value,
    ogUrl: () => canonical.value,
    twitterCard: 'summary_large_image',
    twitterTitle: () => model.value?.title || fallbackTitle,
    twitterDescription: () => description.value,
  });

  // Branded OG image for every listing — nuxt-og-image owns og:image /
  // twitter:image / dimensions from here. The card shows the model photo when
  // present and a branded text card when not, so a listing is never imageless.
  defineOgImageComponent('ModelCard', {
    title: (model.value?.title || fallbackTitle).slice(0, 90),
    summary: excerpt(model.value?.summary || model.value?.description, 110),
    price: model.value ? priceLabel(model.value) : '',
    author: model.value?.author?.displayName || model.value?.author?.username || '',
    image: photo.value,
  });

  // schema.org Product — gives Google price/availability/author for rich results.
  const jsonLd = computed(() => {
    const m = model.value;
    if (!m) return null;
    const currency = (m.currency || 'usd').toUpperCase();
    const priceFor = () => {
      if (m.pricingMode === 'fixed' && m.priceCents != null) return (m.priceCents / 100).toFixed(2);
      if (m.pricingMode === 'pwyw') return ((m.minPriceCents ?? 100) / 100).toFixed(2);
      return '0.00'; // free / tips
    };
    const authorName = m.author?.displayName || m.author?.username || null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: m.title,
      description: description.value,
      image: photo.value ? [photo.value] : [SITE_DEFAULT_OG],
      category: m.categorySlug,
      url: canonical.value,
      brand: { '@type': 'Brand', name: BRAND },
      ...(authorName ? { author: { '@type': 'Person', name: authorName } } : {}),
      ...(tags.value.length ? { keywords: tags.value.join(', ') } : {}),
      offers: {
        '@type': 'Offer',
        price: priceFor(),
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
        url: canonical.value,
      },
    };
  });

  useHead(() => ({
    title: pageTitle.value,
    link: [{ rel: 'canonical', href: canonical.value }],
    meta: tags.value.map((tag) => ({ property: 'article:tag', content: tag })),
    script: jsonLd.value
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) }]
      : [],
  }));

  return { canonical, photo, description };
}

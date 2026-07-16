import { describe, it, expect } from 'vitest';
import { isSocialImageMetaTag, normalizeSocialImageContent } from '~/app/utils/seoTagGuards';

// Regression for the /archive/colors/[id] SSR 500:
// "TypeError: tag.props.content.replaceAll is not a function" in
// nuxt-og-image's tags:afterResolve hook. useSeoMeta({ ogImage: '' }) is
// unpacked by unhead's flat-meta handling into og:image content === true
// (boolean), which that hook then calls .replaceAll() on.
describe('normalizeSocialImageContent', () => {
  const meta = (props: Record<string, unknown>) => ({ tag: 'meta', props });

  it('empties boolean content (unhead coerces empty-string useSeoMeta values to true)', () => {
    const tags = [meta({ property: 'og:image', content: true }), meta({ name: 'twitter:image', content: true })];
    normalizeSocialImageContent(tags);
    expect(tags[0]?.props.content).toBe('');
    expect(tags[1]?.props.content).toBe('');
  });

  it('stringifies numeric content', () => {
    const tags = [meta({ property: 'og:image', content: 1275 })];
    normalizeSocialImageContent(tags);
    expect(tags[0]?.props.content).toBe('1275');
  });

  it('empties object/array content and non-finite numbers', () => {
    const tags = [
      meta({ property: 'og:image', content: { url: 'x' } }),
      meta({ name: 'twitter:image:src', content: ['a', 'b'] }),
      meta({ property: 'og:image', content: NaN }),
    ];
    normalizeSocialImageContent(tags);
    for (const tag of tags) expect(tag.props.content).toBe('');
  });

  it('leaves string, null, and undefined content untouched', () => {
    const url = 'https://classicminidiy.s3.amazonaws.com/misc/noSwatch.jpeg';
    const tags = [
      meta({ property: 'og:image', content: url }),
      meta({ name: 'twitter:image', content: null }),
      meta({ property: 'og:image' }),
    ];
    normalizeSocialImageContent(tags);
    expect(tags[0]?.props.content).toBe(url);
    expect(tags[1]?.props.content).toBeNull();
    expect(tags[2]?.props.content).toBeUndefined();
  });

  it('ignores meta tags nuxt-og-image does not touch', () => {
    const widthTag = meta({ property: 'og:image:width', content: 1200 });
    const descTag = meta({ name: 'description', content: 42 });
    normalizeSocialImageContent([widthTag, descTag]);
    expect(widthTag.props.content).toBe(1200);
    expect(descTag.props.content).toBe(42);
  });

  it('matches exactly the tags nuxt-og-image rewrites', () => {
    expect(isSocialImageMetaTag({ tag: 'meta', props: { property: 'og:image' } })).toBe(true);
    expect(isSocialImageMetaTag({ tag: 'meta', props: { name: 'twitter:image' } })).toBe(true);
    expect(isSocialImageMetaTag({ tag: 'meta', props: { name: 'twitter:image:src' } })).toBe(true);
    expect(isSocialImageMetaTag({ tag: 'meta', props: { property: 'og:image:height' } })).toBe(false);
    expect(isSocialImageMetaTag({ tag: 'link', props: { property: 'og:image' } })).toBe(false);
    expect(isSocialImageMetaTag({ tag: 'meta' })).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  detectSourceSite,
  extractExternalId,
  normalizeExternalUrl,
  isValidExternalUrl,
} from '~~/data/models/external-sources';
import {
  decodeHtmlEntities,
  parseMetaTags,
  parseOpenGraph,
  parseJsonLd,
} from '~~/server/utils/external-models/ogParser';
import { enrich } from '~~/server/utils/external-models/enrichers';
import { fetchExternalMetadata } from '~~/server/utils/external-models';
import { ScrapeError } from '~~/server/utils/external-models/errors';

// --- external-sources: detection / id / normalization -----------------------

describe('detectSourceSite', () => {
  it('maps known hosts to their site', () => {
    expect(detectSourceSite('https://www.thingiverse.com/thing:42')).toBe('thingiverse');
    expect(detectSourceSite('https://printables.com/model/99-foo')).toBe('printables');
    expect(detectSourceSite('https://makerworld.com/en/models/7')).toBe('makerworld');
    expect(detectSourceSite('https://cults3d.com/en/3d-model/tool/foo')).toBe('cults3d');
    expect(detectSourceSite('https://thangs.com/designer/x/3d-model/foo-123')).toBe('thangs');
    expect(detectSourceSite('https://www.myminifactory.com/object/3d-print-foo-123')).toBe('myminifactory');
  });
  it('falls back to other for unknown hosts and null for non-URLs', () => {
    expect(detectSourceSite('https://example.com/cool-model')).toBe('other');
    expect(detectSourceSite('not a url')).toBeNull();
  });
});

describe('extractExternalId', () => {
  it('pulls the platform id from canonical URLs', () => {
    expect(extractExternalId('https://www.thingiverse.com/thing:123456')).toBe('123456');
    expect(extractExternalId('https://www.printables.com/model/98765-foo')).toBe('98765');
    expect(extractExternalId('https://makerworld.com/en/models/555')).toBe('555');
    expect(extractExternalId('https://cults3d.com/en/3d-model/various/mini-knob')).toBe('mini-knob');
  });
  it('returns null when there is no id pattern', () => {
    expect(extractExternalId('https://example.com/foo')).toBeNull();
  });
});

describe('normalizeExternalUrl', () => {
  it('strips tracking params + hash + trailing slash and lowercases host', () => {
    expect(normalizeExternalUrl('https://WWW.Thingiverse.com/thing:1/?utm_source=x&fbclid=y#frag')).toBe(
      'https://www.thingiverse.com/thing:1'
    );
  });
  it('keeps meaningful query params', () => {
    expect(normalizeExternalUrl('https://example.com/a?page=2')).toBe('https://example.com/a?page=2');
  });
  it('returns the input unchanged when unparseable', () => {
    expect(normalizeExternalUrl('garbage')).toBe('garbage');
  });
});

describe('isValidExternalUrl', () => {
  it('accepts http(s) and rejects everything else', () => {
    expect(isValidExternalUrl('https://example.com')).toBe(true);
    expect(isValidExternalUrl('http://example.com')).toBe(true);
    expect(isValidExternalUrl('ftp://example.com')).toBe(false);
    expect(isValidExternalUrl('nope')).toBe(false);
  });
});

// --- ogParser ---------------------------------------------------------------

describe('decodeHtmlEntities', () => {
  it('decodes named + numeric entities', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry&#39;s &quot;car&quot; &#x2014; ok')).toBe('Tom & Jerry\'s "car" — ok');
  });
});

describe('parseMetaTags / parseOpenGraph', () => {
  const html = `
    <html><head>
      <title>Fallback Title</title>
      <meta content="OG Title" property="og:title">
      <meta property="og:description" content="A &amp; B description">
      <meta property="og:image" content="https://cdn.test/a.jpg">
      <meta property="og:image" content="https://cdn.test/a.jpg">
      <meta property="og:image:secure_url" content="https://cdn.test/b.jpg">
      <meta name="twitter:image" content="https://cdn.test/c.jpg">
      <meta name="keywords" content="mini, gear, knob">
      <script type="application/ld+json">{"@type":"CreativeWork","name":"LD Name","author":{"name":"Jane"},"keywords":["alpha","beta"]}</script>
    </head><body></body></html>`;

  it('extracts meta regardless of attribute order', () => {
    const { meta, title } = parseMetaTags(html);
    expect(title).toBe('Fallback Title');
    expect(meta['og:title']).toEqual(['OG Title']);
  });

  it('normalizes OG with dedup + jsonLd + entity decode', () => {
    const og = parseOpenGraph(html);
    expect(og.title).toBe('OG Title');
    expect(og.description).toBe('A & B description');
    // primary image is the first; duplicates collapsed; secure_url + twitter merged
    expect(og.image).toBe('https://cdn.test/b.jpg');
    expect(og.images).toContain('https://cdn.test/a.jpg');
    expect(og.images.filter((u) => u === 'https://cdn.test/a.jpg')).toHaveLength(1);
    expect(og.author).toBe('Jane');
    expect(og.keywords).toEqual(expect.arrayContaining(['mini', 'gear', 'knob', 'alpha', 'beta']));
  });

  it('falls back to <title> when no og:title', () => {
    const og = parseOpenGraph('<title>Only Title</title>');
    expect(og.title).toBe('Only Title');
  });

  it('parseJsonLd ignores malformed blocks', () => {
    const blocks = parseJsonLd('<script type="application/ld+json">{bad json}</script>');
    expect(blocks).toEqual([]);
  });
});

// --- enrichers --------------------------------------------------------------

describe('enrichers', () => {
  const base = (over: Partial<ReturnType<typeof parseOpenGraph>> = {}) => ({
    title: null,
    description: null,
    image: null,
    images: [],
    siteName: null,
    author: null,
    keywords: [],
    license: null,
    jsonLd: [],
    ...over,
  });

  it('thingiverse splits "Title by Author - Thingiverse"', () => {
    const f = enrich(base({ title: 'Mini Gear Knob by Bob - Thingiverse' }), {
      url: 'https://thingiverse.com/thing:1',
      site: 'thingiverse',
      externalId: '1',
    });
    expect(f.title).toBe('Mini Gear Knob');
    expect(f.authorName).toBe('Bob');
    expect(f.authorUrl).toBe('https://www.thingiverse.com/Bob');
    expect(f.commercialUseAllowed).toBe(true); // CC-BY-SA default
  });

  it('printables splits "Title by Author | Download…"', () => {
    const f = enrich(base({ title: 'Widget by Alice | Download free STL model | Printables.com' }), {
      url: 'https://printables.com/model/2',
      site: 'printables',
      externalId: '2',
    });
    expect(f.title).toBe('Widget');
    expect(f.authorName).toBe('Alice');
    expect(f.commercialUseAllowed).toBe(false); // CC-BY-NC-SA default
  });

  it('makerworld strips suffix + reads "designed by"', () => {
    const f = enrich(
      base({ title: 'Cool Part - Free 3D Print Model - MakerWorld', description: 'Download this free 3D print file designed by Carol. Extra.' }),
      { url: 'https://makerworld.com/en/models/3', site: 'makerworld', externalId: '3' }
    );
    expect(f.title).toBe('Cool Part');
    expect(f.authorName).toBe('Carol');
    expect(f.description).toBe('Extra.');
  });

  it('generic (other) passes the OG title through', () => {
    const f = enrich(base({ title: 'Some Random Model' }), {
      url: 'https://example.com/x',
      site: 'other',
      externalId: null,
    });
    expect(f.title).toBe('Some Random Model');
    expect(f.license).toBeNull();
  });
});

// --- fetchExternalMetadata (injected fetch) ---------------------------------

function fakeFetch(html: string, status = 200) {
  return async (url: string) =>
    ({ text: async () => html, url, status }) as unknown as Response;
}

describe('fetchExternalMetadata', () => {
  it('scrapes + enriches a Thingiverse page', async () => {
    const html = `<title>X</title>
      <meta property="og:title" content="Sump Guard by Dave - Thingiverse">
      <meta property="og:description" content="A sturdy guard">
      <meta property="og:image" content="https://cdn.test/sump.jpg">`;
    const result = await fetchExternalMetadata('https://www.thingiverse.com/thing:9001?utm_source=x', {
      fetchImpl: fakeFetch(html),
    });
    expect(result.sourceSite).toBe('thingiverse');
    expect(result.externalId).toBe('9001');
    expect(result.sourceUrl).toBe('https://www.thingiverse.com/thing:9001');
    expect(result.title).toBe('Sump Guard');
    expect(result.authorName).toBe('Dave');
    expect(result.images[0]).toEqual({ url: 'https://cdn.test/sump.jpg', isPrimary: true });
  });

  it('handles an unknown host as a generic listing', async () => {
    const html = `<meta property="og:title" content="Mystery Model"><meta property="og:image" content="https://x/y.jpg">`;
    const result = await fetchExternalMetadata('https://randomsite.example/thing', { fetchImpl: fakeFetch(html) });
    expect(result.sourceSite).toBe('other');
    expect(result.title).toBe('Mystery Model');
  });

  it('throws ScrapeError on 404', async () => {
    await expect(
      fetchExternalMetadata('https://www.thingiverse.com/thing:404', { fetchImpl: fakeFetch('', 404) })
    ).rejects.toBeInstanceOf(ScrapeError);
  });

  it('rejects an invalid URL', async () => {
    await expect(fetchExternalMetadata('not-a-url', { fetchImpl: fakeFetch('') })).rejects.toBeInstanceOf(ScrapeError);
  });
});

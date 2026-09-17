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
import { renderExternalPage } from '~~/server/utils/external-models/render';
import { fetchPrintablesModel, mapPrintablesPrint } from '~~/server/utils/external-models/printables';
import { fetchCults3dModel, mapCults3dCreation } from '~~/server/utils/external-models/cults3d';
import { normalizeLicenseLabel } from '~~/server/utils/external-models/license';

// --- external-sources: detection / id / normalization -----------------------

describe('detectSourceSite', () => {
  it('maps known hosts to their site', () => {
    expect(detectSourceSite('https://www.thingiverse.com/thing:42')).toBe('thingiverse');
    expect(detectSourceSite('https://printables.com/model/99-foo')).toBe('printables');
    expect(detectSourceSite('https://makerworld.com/en/models/7')).toBe('makerworld');
    expect(detectSourceSite('https://cults3d.com/en/3d-model/tool/foo')).toBe('cults3d');
    expect(detectSourceSite('https://thangs.com/designer/x/3d-model/foo-123')).toBe('thangs');
    expect(detectSourceSite('https://www.myminifactory.com/object/3d-print-foo-123')).toBe('myminifactory');
    expect(detectSourceSite('https://grabcad.com/library/austin-mini-1')).toBe('grabcad');
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
    expect(extractExternalId('https://grabcad.com/library/classic-mini-rear-trailing-arm-1')).toBe(
      'classic-mini-rear-trailing-arm-1'
    );
  });
  it('returns null when there is no id pattern', () => {
    expect(extractExternalId('https://example.com/foo')).toBeNull();
    // GrabCAD profile pages aren't model pages — no id
    expect(extractExternalId('https://grabcad.com/mike--223/models')).toBeNull();
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

  it('ignores ng-attr-content and drops {{ }} template placeholders (SPA shell)', () => {
    // GrabCAD-style AngularJS shell: the real `content` must win over the
    // adjacent `ng-attr-content`, and a pure-placeholder og:title is skipped.
    const html = `
      <title ng-bind="title">Free CAD Designs, Files &amp; 3D Models | The GrabCAD Community Library</title>
      <meta name="description" ng-attr-content="{{meta.description}}" content="Static fallback blurb">
      <meta property="og:title" content="{{model.title}}">`;
    const og = parseOpenGraph(html);
    expect(og.description).toBe('Static fallback blurb');
    expect(og.title).toBe('Free CAD Designs, Files & 3D Models | The GrabCAD Community Library');
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
      base({
        title: 'Cool Part - Free 3D Print Model - MakerWorld',
        description: 'Download this free 3D print file designed by Carol. Extra.',
      }),
      { url: 'https://makerworld.com/en/models/3', site: 'makerworld', externalId: '3' }
    );
    expect(f.title).toBe('Cool Part');
    expect(f.authorName).toBe('Carol');
    expect(f.description).toBe('Extra.');
  });

  it('grabcad strips its title suffixes', () => {
    const e = (title: string, externalId: string | null = 'x') =>
      enrich(base({ title }), { url: 'https://grabcad.com/library/x', site: 'grabcad', externalId }).title;
    expect(e('Classic Mini Trailing Arm | The GrabCAD Community Library')).toBe('Classic Mini Trailing Arm');
    expect(e('Mike | CAD Models | GrabCAD', null)).toBe('Mike');
    expect(e('Widget - GrabCAD')).toBe('Widget');
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
  return async (url: string) => ({ text: async () => html, url, status }) as unknown as Response;
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

// --- render-service fallback (Jina Reader) ---------------------------------

function fakeJsonFetch(payload: unknown, status = 200) {
  return async () => ({ status, json: async () => payload }) as unknown as Response;
}

/** A Jina Reader success envelope for a page whose `<head>` carried `meta`. */
function jinaPage(meta: Record<string, string>, extra: Record<string, unknown> = {}) {
  return {
    code: 200,
    status: 20000,
    data: { title: meta['og:title'] ?? '', httpStatus: 200, metadata: meta, ...extra },
  };
}

describe('renderExternalPage (fallback)', () => {
  it('maps the rendered page metadata to OG metadata', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const og = await renderExternalPage(
      'https://makerworld.com/en/models/1',
      (async (url: string, init?: RequestInit) => {
        calls.push({ url, headers: init?.headers as Record<string, string> });
        return fakeJsonFetch(
          jinaPage({
            'og:title': 'Mount - MakerWorld',
            'og:description': 'd',
            'og:site_name': 'MakerWorld',
            'og:image': 'https://cdn.test/x.jpg',
            'twitter:image': 'https://cdn.test/x.jpg',
            author: 'Bob',
            keywords: 'mini, bracket',
          })
        )();
      }) as unknown as typeof fetch,
      'jina_test_key'
    );
    expect(og.title).toBe('Mount - MakerWorld');
    expect(og.description).toBe('d');
    expect(og.image).toBe('https://cdn.test/x.jpg');
    expect(og.images).toEqual(['https://cdn.test/x.jpg']); // de-duplicated
    expect(og.author).toBe('Bob');
    expect(og.siteName).toBe('MakerWorld');
    expect(og.keywords).toEqual(['mini', 'bracket']);
    // URL is passed as the path; metadata-only render; key as Bearer.
    expect(calls[0].url).toBe('https://r.jina.ai/https://makerworld.com/en/models/1');
    expect(calls[0].headers['X-Target-Selector']).toBe('head');
    expect(calls[0].headers.Authorization).toBe('Bearer jina_test_key');
  });

  it('tolerates array meta values from repeated tags and keeps every image', async () => {
    const og = await renderExternalPage(
      'https://x/y',
      fakeJsonFetch(
        jinaPage({} as Record<string, string>, {
          title: 'Fallback title',
          metadata: { 'og:image': ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg'], keywords: ['a, b'] },
        })
      )
    );
    expect(og.title).toBe('Fallback title');
    expect(og.images).toEqual(['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg']);
    expect(og.keywords).toEqual(['a', 'b']);
  });

  it('sends no Authorization header without a key', async () => {
    let headers: Record<string, string> = {};
    await renderExternalPage('https://x/y', (async (_u: string, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      return fakeJsonFetch(jinaPage({ 'og:title': 't' }))();
    }) as unknown as typeof fetch);
    expect(headers.Authorization).toBeUndefined();
  });

  it('throws ScrapeError when the service cannot render (4xx envelope)', async () => {
    await expect(
      renderExternalPage('https://x/y', fakeJsonFetch({ code: 422, message: 'Failed to render' }, 422))
    ).rejects.toBeInstanceOf(ScrapeError);
  });

  it('throws ScrapeError when rate-limited', async () => {
    await expect(renderExternalPage('https://x/y', fakeJsonFetch({}, 429))).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('throws ScrapeError when the rendered page errored upstream (httpStatus >= 400)', async () => {
    // Jina reports success but the upstream page was a CloudFront 403 error.
    await expect(
      renderExternalPage(
        'https://grabcad.com/library/x',
        fakeJsonFetch(
          jinaPage(
            { 'og:image': 'https://t3.gstatic.com/favicon' },
            { title: 'ERROR: The request could not be satisfied', httpStatus: 403 }
          )
        )
      )
    ).rejects.toBeInstanceOf(ScrapeError);
  });

  it('maps a rendered upstream 404 to the not-found error, not "blocked"', async () => {
    await expect(
      renderExternalPage(
        'https://www.myminifactory.com/object/gone-1',
        fakeJsonFetch(jinaPage({ 'og:title': 'Page not found' }, { httpStatus: 404 }))
      )
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('treats a Cloudflare interstitial as blocked even though it renders as 200', async () => {
    await expect(
      renderExternalPage(
        'https://cults3d.com/en/3d-model/x',
        fakeJsonFetch(jinaPage({}, { title: 'Just a moment...' }))
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('requires a title — an image-only render is a soft-404 share card, not a model', async () => {
    await expect(
      renderExternalPage(
        'https://makerworld.com/en/models/999',
        fakeJsonFetch(jinaPage({ 'og:image': 'https://cdn.test/default.jpg' }))
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('fetchExternalMetadata — render fallback wiring', () => {
  it('falls back to the render service when the direct fetch is blocked (403)', async () => {
    const result = await fetchExternalMetadata('https://makerworld.com/en/models/1830846-foo', {
      fetchImpl: fakeFetch('', 403), // Cloudflare block
      renderImpl: fakeJsonFetch(
        jinaPage({
          'og:title': 'Classic Mini Gauge Mount - Free 3D Print Model - MakerWorld',
          author: 'Dana',
          'og:image': 'https://cdn.test/m.jpg',
        })
      ) as unknown as typeof fetch,
    });
    expect(result.sourceSite).toBe('makerworld');
    expect(result.title).toBe('Classic Mini Gauge Mount'); // enricher stripped the MakerWorld suffix
    expect(result.images[0]).toEqual({ url: 'https://cdn.test/m.jpg', isPrimary: true });
  });

  it('does NOT fall back when the direct fetch succeeds', async () => {
    let rendered = false;
    const result = await fetchExternalMetadata('https://www.thingiverse.com/thing:5', {
      fetchImpl: fakeFetch('<meta property="og:title" content="Sump Guard by Dave - Thingiverse">', 200),
      renderImpl: (async () => {
        rendered = true;
        return fakeJsonFetch({})();
      }) as unknown as typeof fetch,
    });
    expect(rendered).toBe(false);
    expect(result.title).toBe('Sump Guard');
  });

  it('does NOT render on a real 404 (terminal — saves render quota)', async () => {
    let rendered = false;
    await expect(
      fetchExternalMetadata('https://www.thingiverse.com/thing:404', {
        fetchImpl: fakeFetch('', 404),
        renderImpl: (async () => {
          rendered = true;
          return fakeJsonFetch({})();
        }) as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(ScrapeError);
    expect(rendered).toBe(false);
  });
});

describe('fetchExternalMetadata — requiresRender (GrabCAD SPA)', () => {
  it('skips the direct fetch entirely and renders', async () => {
    let directHit = false;
    const result = await fetchExternalMetadata('https://grabcad.com/library/classic-mini-boot-rough-1', {
      fetchImpl: (async (url: string) => {
        directHit = true; // must NOT be called for a requiresRender site
        return {
          text: async () => '<title>Free CAD Designs, Files & 3D Models | The GrabCAD Community Library</title>',
          url,
          status: 200,
        } as unknown as Response;
      }) as unknown as typeof fetch,
      renderImpl: fakeJsonFetch(
        jinaPage({ 'og:title': 'Classic Mini Boot | GrabCAD', author: 'Bob', 'og:image': 'https://cdn.test/boot.jpg' })
      ) as unknown as typeof fetch,
    });
    expect(directHit).toBe(false);
    expect(result.sourceSite).toBe('grabcad');
    expect(result.title).toBe('Classic Mini Boot'); // enricher stripped the GrabCAD suffix
    expect(result.images[0]).toEqual({ url: 'https://cdn.test/boot.jpg', isPrimary: true });
  });

  it('fails cleanly (no junk stored) when GrabCAD is blocked upstream', async () => {
    await expect(
      fetchExternalMetadata('https://grabcad.com/library/classic-mini-rear-trailing-arm-1', {
        fetchImpl: fakeFetch('', 200),
        renderImpl: fakeJsonFetch(
          jinaPage(
            { 'og:image': 'https://t3.gstatic.com/fav' },
            { title: 'ERROR: The request could not be satisfied', httpStatus: 403 }
          )
        ) as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(ScrapeError);
  });
});

// --- Printables GraphQL API path --------------------------------------------

const PRINTABLES_URL = 'https://www.printables.com/model/1843117-classic-mini-su-carburetor-needle-marking-plate';

function printablesApi(payload: unknown, status = 200) {
  const calls: { url: string; body: unknown }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    return { ok: status >= 200 && status < 300, status, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const PRINT_NODE = {
  id: '1843117',
  name: 'Classic Mini SU Carburetor Needle Marking Plate',
  summary: 'Holds an SU needle so you can mark the stations.',
  description:
    '<p>Holds an SU needle in a repeatable position.&nbsp; Stations every .125&quot;.<br>See <em>The SU Carburettor High-Performance Manual</em>.</p>',
  user: { publicUsername: 'fisherbt', handle: 'fisherbt_330466' },
  license: { abbreviation: 'CC-BY-NC-SA' },
  tags: [{ name: 'classic mini' }, { name: 'su carb' }],
  image: { filePath: 'media/prints/a/images/1/front.jpg' },
  images: [{ filePath: 'media/prints/a/images/1/front.jpg' }, { filePath: '/media/prints/b/images/2/back.jpg' }],
  layerHeights: [0.2],
  nozzleDiameters: ['0.4'],
  materials: [{ name: 'PLA' }, { name: 'PETG' }],
};

describe('mapPrintablesPrint', () => {
  it('maps the API node to listing fields', () => {
    const m = mapPrintablesPrint(PRINT_NODE);
    expect(m.fields.title).toBe('Classic Mini SU Carburetor Needle Marking Plate');
    expect(m.fields.description).toBe(
      'Holds an SU needle in a repeatable position. Stations every .125".\nSee The SU Carburettor High-Performance Manual.'
    );
    expect(m.fields.summary).toBe('Holds an SU needle so you can mark the stations.');
    expect(m.fields.authorName).toBe('fisherbt');
    expect(m.fields.authorUrl).toBe('https://www.printables.com/@fisherbt_330466'); // handle, not display name
    expect(m.fields.license).toBe('CC-BY-NC-SA');
    expect(m.fields.remixesAllowed).toBe(true);
    expect(m.fields.commercialUseAllowed).toBe(false);
    expect(m.fields.tags).toEqual(['classic mini', 'su carb']);
    expect(m.fields.printSettings).toEqual({
      recommendedMaterial: 'PLA',
      alternativeMaterials: ['PETG'],
      layerHeight: 0.2,
      nozzleSize: 0.4,
    });
    // primary first, de-duplicated, leading slash tolerated
    expect(m.images).toEqual([
      'https://media.printables.com/media/prints/a/images/1/front.jpg',
      'https://media.printables.com/media/prints/b/images/2/back.jpg',
    ]);
  });

  it('derives remix/commercial flags from the real license, defaults for unknown ones', () => {
    const flags = (abbreviation: string | null) => {
      const f = mapPrintablesPrint({ name: 'L', license: { abbreviation } }).fields;
      return [f.remixesAllowed, f.commercialUseAllowed];
    };
    expect(flags('CC-BY')).toEqual([true, true]);
    expect(flags('CC-BY-SA')).toEqual([true, true]);
    expect(flags('CC-BY-ND')).toEqual([false, true]);
    expect(flags('CC-BY-NC-ND')).toEqual([false, false]);
    expect(flags('CC0')).toEqual([true, true]);
    expect(flags('Standard Digital File License')).toEqual([null, null]); // reported but not understood
    expect(flags(null)).toEqual([true, false]); // registry default only when nothing was reported
  });

  it('keeps an absolute image filePath as-is instead of double-prefixing it', () => {
    const m = mapPrintablesPrint({ name: 'A', image: { filePath: 'https://cdn.example/x.jpg' } });
    expect(m.images).toEqual(['https://cdn.example/x.jpg']);
  });

  it('strips nested tags completely', () => {
    const m = mapPrintablesPrint({ name: 'T', description: '<p>safe <scr<script>ipt>alert(1)</script> text</p>' });
    expect(m.fields.description).not.toMatch(/<[^>]*>/);
    expect(m.fields.description).toContain('safe');
  });

  it('falls back to registry defaults and derives a summary when the API is sparse', () => {
    const m = mapPrintablesPrint({ name: 'Bare', description: '<p>' + 'x'.repeat(400) + '</p>' });
    expect(m.fields.license).toBe('CC-BY-NC-SA');
    expect(m.fields.summary?.length).toBe(280);
    expect(m.fields.authorUrl).toBeNull();
    expect(m.fields.printSettings).toEqual({});
    expect(m.images).toEqual([]);
  });
});

describe('fetchPrintablesModel', () => {
  it('POSTs the id to the GraphQL endpoint and maps the result', async () => {
    const api = printablesApi({ data: { print: PRINT_NODE } });
    const m = await fetchPrintablesModel('1843117', api.impl);
    expect(m?.fields.title).toBe('Classic Mini SU Carburetor Needle Marking Plate');
    expect(api.calls[0].url).toBe('https://api.printables.com/graphql/');
    expect((api.calls[0].body as { variables: { id: string } }).variables.id).toBe('1843117');
  });

  it('throws a 404 ScrapeError when the API says the print does not exist', async () => {
    await expect(
      fetchPrintablesModel('999999999', printablesApi({ data: { print: null } }).impl)
    ).rejects.toMatchObject({
      name: 'ScrapeError',
      statusCode: 404,
    });
  });

  it('returns null (fall back) on GraphQL errors, non-2xx, bad JSON and transport failure', async () => {
    expect(
      await fetchPrintablesModel('1', printablesApi({ errors: [{ message: "Cannot query field 'x'" }] }, 400).impl)
    ).toBeNull();
    expect(await fetchPrintablesModel('1', printablesApi({ errors: [{ message: 'nope' }] }).impl)).toBeNull();
    expect(await fetchPrintablesModel('1', printablesApi({}, 503).impl)).toBeNull();
    expect(
      await fetchPrintablesModel(
        '1',
        (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => {
              throw new Error('x');
            },
          }) as unknown as Response) as unknown as typeof fetch
      )
    ).toBeNull();
    expect(
      await fetchPrintablesModel('1', (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch)
    ).toBeNull();
    expect(await fetchPrintablesModel('not-digits', printablesApi({ data: { print: PRINT_NODE } }).impl)).toBeNull();
  });
});

describe('fetchExternalMetadata — Printables API wiring', () => {
  it('uses the API and never fetches the (challenged) page or the render service', async () => {
    let pageHit = false;
    let rendered = false;
    const result = await fetchExternalMetadata(PRINTABLES_URL, {
      fetchImpl: (async (url: string) => {
        pageHit = true;
        return { text: async () => '<title>Just a moment...</title>', url, status: 403 } as unknown as Response;
      }) as unknown as typeof fetch,
      renderImpl: (async () => {
        rendered = true;
        return fakeJsonFetch({})();
      }) as unknown as typeof fetch,
      apiImpl: printablesApi({ data: { print: PRINT_NODE } }).impl,
    });
    expect(pageHit).toBe(false);
    expect(rendered).toBe(false);
    expect(result.sourceSite).toBe('printables');
    expect(result.externalId).toBe('1843117');
    expect(result.sourceUrl).toBe(PRINTABLES_URL);
    expect(result.title).toBe('Classic Mini SU Carburetor Needle Marking Plate');
    expect(result.authorName).toBe('fisherbt');
    expect(result.images[0]).toEqual({
      url: 'https://media.printables.com/media/prints/a/images/1/front.jpg',
      isPrimary: true,
    });
    expect(result.images[1].isPrimary).toBe(false);
  });

  it('falls through to the page scrape when the API is unavailable', async () => {
    const result = await fetchExternalMetadata(PRINTABLES_URL, {
      fetchImpl: fakeFetch(
        '<meta property="og:title" content="Needle Plate by fisherbt | Download free STL model | Printables.com"><meta property="og:image" content="https://cdn.test/p.jpg">'
      ),
      apiImpl: printablesApi({}, 503).impl,
    });
    expect(result.title).toBe('Needle Plate');
    expect(result.authorName).toBe('fisherbt');
  });

  it('surfaces the API 404 without rendering', async () => {
    let rendered = false;
    await expect(
      fetchExternalMetadata('https://www.printables.com/model/999999999-gone', {
        fetchImpl: fakeFetch('', 403),
        renderImpl: (async () => {
          rendered = true;
          return fakeJsonFetch({})();
        }) as unknown as typeof fetch,
        apiImpl: printablesApi({ data: { print: null } }).impl,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(rendered).toBe(false);
  });
});

// --- Cults3D GraphQL API path -----------------------------------------------

const CULTS_URL = 'https://cults3d.com/en/3d-model/various/john-cooper-logo';
const CULTS_CREDS = { user: 'cmdiy', apiKey: 'k' };

function cultsApi(payload: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return { ok: status >= 200 && status < 300, status, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const CREATION_NODE = {
  slug: 'john-cooper-logo',
  name: 'CLASSIC MINI COOPER JOHN COOPER BADGE EMBLEM',
  url: CULTS_URL,
  description: 'John Cooper LOGO for the classic mini cooper.\r\n',
  details: 'For exterior car emblem print solid. No supports.\r\nResize in slicer.',
  illustrationImageUrl:
    'https://images.cults3d.com/a=/516x516/filters:no_upscale()/https://fbi.cults3d.com/u/1/front.png',
  illustrations: [
    { imageUrl: 'https://images.cults3d.com/a=/516x516/filters:no_upscale()/https://fbi.cults3d.com/u/1/front.png' },
    { imageUrl: 'https://images.cults3d.com/b=/516x516/filters:no_upscale()/https://fbi.cults3d.com/u/1/side.jpg' },
  ],
  creator: { nick: 'Go-Ballistic', url: 'https://cults3d.com/en/users/Go-Ballistic' },
  license: {
    code: 'cults_pu',
    name: 'CULTS PU - Private Use',
    spdxId: 'LicenseRef-Cults-PU',
    allowsCommercialUse: false,
  },
  tags: ['john cooper', 'classic mini cooper', '1275gt'],
  category: { name: 'Various' },
  safe: true,
  visibility: 'PUBLIC',
};

describe('license helpers', () => {
  it('normalizes CC labels and SPDX ids to the stored abbreviation', () => {
    expect(normalizeLicenseLabel('CC-BY-NC-4.0')).toBe('CC-BY-NC');
    expect(normalizeLicenseLabel('CC BY-SA - Attribution - Share alike')).toBe('CC-BY-SA');
    expect(normalizeLicenseLabel('Creative Commons — Attribution — Noncommercial — Share Alike')).toBe('CC-BY-NC-SA');
    expect(normalizeLicenseLabel('CC0-1.0')).toBe('CC0');
    expect(normalizeLicenseLabel('CULTS PU - Private Use')).toBe('CULTS PU - Private Use');
    expect(normalizeLicenseLabel('  ')).toBeNull();
  });
});

describe('mapCults3dCreation', () => {
  it('maps the API node to listing fields', () => {
    const m = mapCults3dCreation(CREATION_NODE);
    expect(m.fields.title).toBe('CLASSIC MINI COOPER JOHN COOPER BADGE EMBLEM');
    expect(m.fields.description).toBe(
      'John Cooper LOGO for the classic mini cooper.\n\nFor exterior car emblem print solid. No supports.\nResize in slicer.'
    );
    expect(m.fields.summary).toBe('John Cooper LOGO for the classic mini cooper.');
    expect(m.fields.authorName).toBe('Go-Ballistic');
    expect(m.fields.authorUrl).toBe('https://cults3d.com/en/users/Go-Ballistic');
    expect(m.fields.license).toBe('CULTS PU - Private Use');
    expect(m.fields.remixesAllowed).toBe(false);
    expect(m.fields.commercialUseAllowed).toBe(false);
    expect(m.fields.tags).toEqual(['john cooper', 'classic mini cooper', '1275gt']);
    expect(m.images).toHaveLength(2); // primary de-duplicated against the gallery
    expect(m.images[0]).toContain('front.png');
  });

  it('derives flags per Cults license family', () => {
    const flags = (license: (typeof CREATION_NODE)['license']) => {
      const f = mapCults3dCreation({ name: 'x', license }).fields;
      return [f.license, f.remixesAllowed, f.commercialUseAllowed];
    };
    expect(
      flags({ code: 'cc_by_nc_nd', name: 'CC BY-NC-ND', spdxId: 'CC-BY-NC-ND-4.0', allowsCommercialUse: false })
    ).toEqual(['CC-BY-NC-ND', false, false]);
    expect(flags({ code: 'cc_by', name: 'CC BY', spdxId: 'CC-BY-4.0', allowsCommercialUse: true })).toEqual([
      'CC-BY',
      true,
      true,
    ]);
    // Cults marks CC0 non-commercial; the SPDX id wins.
    expect(flags({ code: 'cc_pddc', name: 'CC0', spdxId: 'CC0-1.0', allowsCommercialUse: false })).toEqual([
      'CC0',
      true,
      true,
    ]);
    expect(
      flags({
        code: 'cults_cu',
        name: 'CULTS CU - Commercial Use',
        spdxId: 'LicenseRef-Cults-CU',
        allowsCommercialUse: true,
      })
    ).toEqual(['CULTS CU - Commercial Use', true, true]);
    expect(
      flags({ code: 'cults_cu_nd', name: 'CULTS CU-ND', spdxId: 'LicenseRef-Cults-CU-ND', allowsCommercialUse: true })
    ).toEqual(['CULTS CU-ND', false, true]);
    expect(flags({ code: 'gpl', name: 'GNU GPL', spdxId: 'GPL-3.0-or-later', allowsCommercialUse: false })).toEqual([
      'GNU GPL',
      true,
      false,
    ]);
    expect(flags(null)).toEqual(['CC-BY-NC', true, false]); // registry default
  });
});

describe('fetchCults3dModel', () => {
  it('POSTs the slug with Basic auth and maps the result', async () => {
    const api = cultsApi({ data: { creation: CREATION_NODE } });
    const m = await fetchCults3dModel('john-cooper-logo', CULTS_CREDS, api.impl);
    expect(m?.fields.title).toContain('JOHN COOPER');
    expect(api.calls[0].url).toBe('https://cults3d.com/graphql');
    expect(api.calls[0].headers.Authorization).toBe(`Basic ${btoa('cmdiy:k')}`);
    expect(api.calls[0].headers['User-Agent']).toContain('ClassicMiniDIY');
    expect((api.calls[0].body as { variables: { slug: string } }).variables.slug).toBe('john-cooper-logo');
  });

  it('returns null without credentials and never calls the API', async () => {
    const api = cultsApi({ data: { creation: CREATION_NODE } });
    expect(await fetchCults3dModel('john-cooper-logo', {}, api.impl)).toBeNull();
    expect(await fetchCults3dModel('john-cooper-logo', { user: 'u' }, api.impl)).toBeNull();
    expect(api.calls).toHaveLength(0);
  });

  it('throws 404 when the creation is missing, 422 when NSFW or not public', async () => {
    await expect(
      fetchCults3dModel('gone', CULTS_CREDS, cultsApi({ data: { creation: null } }).impl)
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      fetchCults3dModel('x', CULTS_CREDS, cultsApi({ data: { creation: { ...CREATION_NODE, safe: false } } }).impl)
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      fetchCults3dModel(
        'x',
        CULTS_CREDS,
        cultsApi({ data: { creation: { ...CREATION_NODE, visibility: 'PRIVATE' } } }).impl
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('returns null (fall back) on 401, GraphQL errors, and transport failure', async () => {
    expect(await fetchCults3dModel('x', CULTS_CREDS, cultsApi({}, 401).impl)).toBeNull();
    expect(await fetchCults3dModel('x', CULTS_CREDS, cultsApi({ errors: [{ message: 'nope' }] }).impl)).toBeNull();
    expect(
      await fetchCults3dModel('x', CULTS_CREDS, (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch)
    ).toBeNull();
    expect(
      await fetchCults3dModel('bad slug!', CULTS_CREDS, cultsApi({ data: { creation: CREATION_NODE } }).impl)
    ).toBeNull();
  });
});

describe('fetchExternalMetadata — Cults3D API wiring', () => {
  it('uses the API with the forwarded credentials and skips the page and render', async () => {
    let pageHit = false;
    let rendered = false;
    const api = cultsApi({ data: { creation: CREATION_NODE } });
    const result = await fetchExternalMetadata(CULTS_URL, {
      fetchImpl: (async (url: string) => {
        pageHit = true;
        return { text: async () => '<title>Just a moment...</title>', url, status: 403 } as unknown as Response;
      }) as unknown as typeof fetch,
      renderImpl: (async () => {
        rendered = true;
        return fakeJsonFetch({})();
      }) as unknown as typeof fetch,
      apiImpl: api.impl,
      cults3d: CULTS_CREDS,
    });
    expect(pageHit).toBe(false);
    expect(rendered).toBe(false);
    expect(result.sourceSite).toBe('cults3d');
    expect(result.externalId).toBe('john-cooper-logo');
    expect(result.authorName).toBe('Go-Ballistic');
    expect(result.images[0].isPrimary).toBe(true);
  });

  it('falls through to the page path when no credentials are configured', async () => {
    let pageHit = false;
    await expect(
      fetchExternalMetadata(CULTS_URL, {
        fetchImpl: (async (url: string) => {
          pageHit = true;
          return { text: async () => '', url, status: 403 } as unknown as Response;
        }) as unknown as typeof fetch,
        apiImpl: cultsApi({ data: { creation: CREATION_NODE } }).impl,
        renderImpl: fakeJsonFetch(jinaPage({}, { title: 'Just a moment...' })) as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(pageHit).toBe(true);
  });
});

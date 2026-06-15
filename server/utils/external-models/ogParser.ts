/**
 * Self-hosted Open Graph / Twitter Card / JSON-LD scraper for external 3D
 * model pages. Replaces OpenECUAlliance's Microlink dependency — no third-party
 * API, no per-request cost, full control. `parseMetaTags` / `parseOpenGraph`
 * are pure and unit-testable against captured HTML fixtures.
 */
import { ScrapeError } from './errors';
import { safeFetch, readBodyCapped, SsrfError } from './ssrf';

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB — generous for HTML, fatal for binaries

export interface OgMetadata {
  title: string | null;
  description: string | null;
  /** Primary image (og:image / twitter:image). */
  image: string | null;
  /** All discovered image URLs (og:image may repeat), de-duplicated, primary first. */
  images: string[];
  siteName: string | null;
  author: string | null;
  /** Raw keyword/tag strings discovered in meta or JSON-LD. */
  keywords: string[];
  /** License URL/string if the page declares one (og/JSON-LD). */
  license: string | null;
  /** Parsed JSON-LD blocks (best-effort). */
  jsonLd: unknown[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  '#x27': "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

/** Decode the handful of HTML entities that show up in meta `content`. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (whole, body: string) => {
    const key = body.toLowerCase();
    if (key in NAMED_ENTITIES) return NAMED_ENTITIES[key];
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return whole;
        }
      }
    }
    return whole;
  });
}

function getAttr(tag: string, attr: string): string | null {
  // attr="value" | attr='value' (attribute order within the tag is irrelevant)
  const re = new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[2] ?? m[3] ?? '').trim();
}

/** Extract a flat map of `<meta>` property/name → content, plus the <title>. */
export function parseMetaTags(html: string): { meta: Record<string, string[]>; title: string | null } {
  const meta: Record<string, string[]> = {};
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const key = (getAttr(tag, 'property') ?? getAttr(tag, 'name') ?? getAttr(tag, 'itemprop'))?.toLowerCase();
    const content = getAttr(tag, 'content');
    if (!key || content == null || content === '') continue;
    (meta[key] ??= []).push(content);
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : null;
  return { meta, title };
}

/** Parse every `<script type="application/ld+json">` block, ignoring bad JSON. */
export function parseJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some pages embed multiple objects or trailing commas — skip silently.
    }
  }
  return blocks;
}

function firstString(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) if (v && v.trim()) return v.trim();
  return null;
}

/** Pull useful fields out of JSON-LD CreativeWork/Product/3DModel nodes. */
function harvestJsonLd(blocks: unknown[]): {
  name: string | null;
  description: string | null;
  image: string[];
  author: string | null;
  keywords: string[];
  license: string | null;
} {
  const out = { name: null as string | null, description: null as string | null, image: [] as string[], author: null as string | null, keywords: [] as string[], license: null as string | null };
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) (obj['@graph'] as unknown[]).forEach(visit);
    if (typeof obj.name === 'string') out.name ??= obj.name;
    if (typeof obj.headline === 'string') out.name ??= obj.headline;
    if (typeof obj.description === 'string') out.description ??= obj.description;
    if (typeof obj.license === 'string') out.license ??= obj.license;
    // image: string | {url} | array
    const img = obj.image;
    if (typeof img === 'string') out.image.push(img);
    else if (img && typeof img === 'object' && typeof (img as Record<string, unknown>).url === 'string') out.image.push((img as Record<string, string>).url);
    else if (Array.isArray(img)) for (const i of img) {
      if (typeof i === 'string') out.image.push(i);
      else if (i && typeof i === 'object' && typeof (i as Record<string, unknown>).url === 'string') out.image.push((i as Record<string, string>).url);
    }
    // author: string | {name} | array
    const author = obj.author;
    if (typeof author === 'string') out.author ??= author;
    else if (author && typeof author === 'object' && typeof (author as Record<string, unknown>).name === 'string') out.author ??= (author as Record<string, string>).name;
    else if (Array.isArray(author) && author[0] && typeof author[0] === 'object' && typeof (author[0] as Record<string, unknown>).name === 'string') out.author ??= (author[0] as Record<string, string>).name;
    // keywords: string (comma) | array
    if (typeof obj.keywords === 'string') out.keywords.push(...obj.keywords.split(',').map((k) => k.trim()).filter(Boolean));
    else if (Array.isArray(obj.keywords)) out.keywords.push(...(obj.keywords as unknown[]).filter((k): k is string => typeof k === 'string'));
  };
  blocks.forEach(visit);
  return out;
}

/** Build normalized OG metadata from a page's raw HTML. Pure. */
export function parseOpenGraph(html: string): OgMetadata {
  const { meta, title: htmlTitle } = parseMetaTags(html);
  const get = (k: string): string | null => meta[k]?.[0] ?? null;
  const getAll = (k: string): string[] => meta[k] ?? [];
  const jsonLd = parseJsonLd(html);
  const ld = harvestJsonLd(jsonLd);

  const images = Array.from(
    new Set(
      [
        get('og:image:secure_url'),
        get('og:image:url'),
        ...getAll('og:image'),
        get('twitter:image'),
        get('twitter:image:src'),
        ...ld.image,
      ].filter((v): v is string => !!v && v.trim().length > 0)
    )
  );

  const keywords = Array.from(
    new Set(
      [...(get('keywords')?.split(',').map((k) => k.trim()) ?? []), ...getAll('article:tag'), ...ld.keywords]
        .map((k) => k.trim())
        .filter(Boolean)
    )
  );

  return {
    title: firstString(get('og:title'), get('twitter:title'), ld.name, htmlTitle),
    description: firstString(get('og:description'), get('twitter:description'), ld.description, get('description')),
    image: images[0] ?? null,
    images,
    siteName: firstString(get('og:site_name'), ld.name && null),
    author: firstString(get('article:author'), get('author'), ld.author, get('twitter:creator')),
    keywords,
    license: firstString(get('og:license'), ld.license),
    jsonLd,
  };
}

export interface FetchedPage {
  html: string;
  finalUrl: string;
  status: number;
}

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ClassicMiniDIYBot/1.0; +https://classicminidiy.com/about)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetch an external page server-side. The production path is SSRF-guarded
 * (`safeFetch` validates every redirect hop) and refuses non-HTML responses +
 * caps the body to avoid OOM on huge/streaming bodies. A `fetchImpl` may be
 * injected for tests, which bypasses the network-safety layer (no real I/O).
 */
export async function fetchExternalPage(url: string, fetchImpl?: typeof fetch): Promise<FetchedPage> {
  if (fetchImpl) {
    const res = await fetchImpl(url, { redirect: 'follow', headers: REQUEST_HEADERS });
    const html = await res.text();
    return { html, finalUrl: res.url || url, status: res.status };
  }

  let res: Response;
  try {
    res = await safeFetch(url, { headers: REQUEST_HEADERS });
  } catch (e) {
    if (e instanceof SsrfError) {
      throw new ScrapeError('That address can’t be fetched — it points somewhere private or unreachable.', 400);
    }
    throw e;
  }

  // Let the caller map 4xx (e.g. 404) — don't read an error body.
  if (res.status >= 400) return { html: '', finalUrl: res.url || url, status: res.status };

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('xml')) {
    throw new ScrapeError('That link doesn’t point to a readable web page.', 422);
  }

  let bytes: Uint8Array;
  try {
    bytes = await readBodyCapped(res, MAX_HTML_BYTES);
  } catch {
    throw new ScrapeError('That page is too large to read.', 413);
  }
  return { html: new TextDecoder('utf-8').decode(bytes), finalUrl: res.url || url, status: res.status };
}

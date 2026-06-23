/**
 * POST /api/exchange/external-listings/parse
 *
 * "Finds" link-preview scraper, CONVERGED off TheMiniExchange's Puppeteer +
 * per-site parsers onto CMDIY's lighter external-models pipeline: SSRF-guarded
 * OG/JSON-LD fetch → Microlink render fallback → re-host image. No headless
 * browser, no per-site parser dispatch — every host flows through the same
 * pipeline; the host only drives the display badge + the price-label heuristic.
 *
 *   body: { url } → { success: true, metadata: { title, description, imageUrl,
 *           sourceSite, year, model, price, priceLabel, auctionEndTime, category } }
 *
 * Contract: matches the legacy TME parse shape exactly (FindSubmitForm depends on
 * it). UNAUTHENTICATED + per-IP rate-limited (preview must work pre-login; the
 * insert is RLS-gated in useExternalListings; notify-submit/delete are the authed
 * surfaces). NEVER throws on a blocked/empty parse — returns a minimal metadata
 * object (title = the URL) so the form's manual-entry path engages. Only SSRF /
 * private-address / bad-scheme hard-throws 400.
 *
 * Known coverage tradeoff vs the old Puppeteer scraper: bot-blocked sites
 * (Copart's JSON API, Facebook Marketplace's login wall, BaT/eBay live bid +
 * auction-end) yield partial/empty metadata → the user fills it in manually.
 */
import { fetchExternalPage, parseOpenGraph, parseJsonLd, type OgMetadata } from '../../../utils/external-models/ogParser';
import { renderExternalPage } from '../../../utils/external-models/render';
import { ScrapeError } from '../../../utils/external-models/errors';
import { safeFetch, readBodyCapped, SsrfError } from '../../../utils/external-models/ssrf';
import { getServiceClient } from '../../../utils/supabase';
import { createRateLimitMiddleware, RateLimitPresets } from '../../../utils/exchange/rateLimit';

type SourceSite = 'bat' | 'carsandbids' | 'copart' | 'craigslist' | 'facebook' | 'ebay' | 'other';

const MIN_PRICE = 50;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const rateLimit = createRateLimitMiddleware({ ...RateLimitPresets.lenient, keyPrefix: 'finds-parse' });

/** Host → SourceSite. Byte-identical to the client copy in useExternalListings so
 *  both sides agree (parse returns 'copart' for display even though the DB CHECK
 *  omits it — the composable downgrades to 'other' on insert). */
function detectFindSourceSite(url: string): SourceSite {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('bringatrailer.com')) return 'bat';
    if (h.includes('carsandbids.com')) return 'carsandbids';
    if (h.includes('copart.com')) return 'copart';
    if (h.includes('craigslist.org')) return 'craigslist';
    if (h.includes('facebook.com')) return 'facebook';
    if (h.includes('ebay.com') || h.includes('ebay.co.uk')) return 'ebay';
    return 'other';
  } catch {
    return 'other';
  }
}

/** Classic Mini year (1959–2000) + model from free text (heritage-correct terms). */
function extractYearModel(text: string): { year: number | null; model: string | null } {
  const yearMatch = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  let year: number | null = yearMatch ? Number(yearMatch[1]) : null;
  if (year !== null && (year < 1959 || year > 2000)) year = null;
  const modelMatch = text.match(/\b(cooper\s*s|1275\s*gt|cooper|clubman|moke|mini|austin|morris)\b/i);
  const model = modelMatch ? modelMatch[1].replace(/\s+/g, ' ').trim() : null;
  return { year, model };
}

/** Price (>= MIN_PRICE) from JSON-LD offers, then a $-regex over title/desc/html. */
function extractPrice(
  og: OgMetadata,
  jsonLd: unknown[],
  html: string | null,
  site: SourceSite
): { price: number | null; priceLabel: string | null } {
  let price: number | null = null;

  for (const node of jsonLd) {
    const offers = (node as any)?.offers;
    const raw = Array.isArray(offers) ? offers[0]?.price : offers?.price;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN_PRICE) {
      price = Math.round(n);
      break;
    }
  }

  const haystack = [og.title, og.description, html].filter(Boolean).join(' ');
  if (price === null && haystack) {
    const m = haystack.match(/\$\s?([\d,]{2,})/);
    if (m) {
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n >= MIN_PRICE) price = n;
    }
  }
  if (price === null) return { price: null, priceLabel: null };

  const formatted = `$${price.toLocaleString('en-US')}`;
  let priceLabel = formatted;
  if ((site === 'bat' || site === 'carsandbids') && haystack) {
    if (/sold\s+for/i.test(haystack)) priceLabel = `Sold for ${formatted}`;
    else if (/current\s+bid|bid\s+to/i.test(haystack)) priceLabel = `Current Bid ${formatted}`;
  }
  return { price, priceLabel };
}

/** Auction end (ISO) from JSON-LD offers.priceValidUntil or Event.endDate. */
function extractAuctionEnd(jsonLd: unknown[]): string | null {
  for (const node of jsonLd) {
    const n = node as any;
    const candidate =
      n?.offers?.priceValidUntil ||
      (Array.isArray(n?.offers) ? n.offers[0]?.priceValidUntil : null) ||
      (n?.['@type'] === 'Event' ? n?.endDate : null);
    if (candidate) {
      const d = new Date(candidate);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

/** Re-host a scraped image to Supabase Storage. SSRF-guarded (safeFetch) +
 *  size-capped + content-type allowlisted (no SVG → avoids stored-XSS). Returns
 *  null on ANY failure (preview still works without an image). */
async function rehostImage(imageUrl: string): Promise<string | null> {
  try {
    const res = await safeFetch(imageUrl);
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = IMAGE_TYPES[contentType];
    if (!ext) return null;
    const bytes = await readBodyCapped(res, MAX_IMAGE_BYTES);
    const path = `finds/${crypto.randomUUID()}.${ext}`;
    const db = getServiceClient();
    const { error } = await db.storage.from('listing-photos').upload(path, bytes, { contentType, upsert: false });
    if (error) return null;
    return db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

interface FindMetadata {
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceSite: SourceSite;
  year: number | null;
  model: string | null;
  price: number | null;
  priceLabel: string | null;
  auctionEndTime: string | null;
  category: 'vehicle' | 'engine' | 'parts' | null;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: string }>(event);
  const url = body?.url?.trim();
  if (!url) throw createError({ statusCode: 400, message: 'url is required' });

  await rateLimit(event);

  if (!/^https?:\/\//i.test(url)) {
    throw createError({ statusCode: 400, message: 'URL must start with http:// or https://' });
  }

  const sourceSite = detectFindSourceSite(url);
  const minimal: FindMetadata = {
    title: url,
    description: null,
    imageUrl: null,
    sourceSite,
    year: null,
    model: null,
    price: null,
    priceLabel: null,
    auctionEndTime: null,
    category: null,
  };

  const config = useRuntimeConfig();
  let og: OgMetadata | null = null;
  let jsonLd: unknown[] = [];
  let html: string | null = null;

  // 1) Direct SSRF-guarded fetch + OG/JSON-LD parse.
  try {
    const page = await fetchExternalPage(url);
    if (page.status === 404) return { success: true, metadata: minimal };
    if (page.status < 400) {
      html = page.html;
      jsonLd = parseJsonLd(page.html);
      const parsed = parseOpenGraph(page.html);
      if (parsed.title || parsed.image) og = parsed;
    }
  } catch (err) {
    // SSRF / private address / bad scheme → hard 400, NEVER fall through to render.
    if (err instanceof SsrfError || (err instanceof ScrapeError && err.statusCode === 400)) {
      throw createError({ statusCode: 400, message: 'That URL could not be fetched' });
    }
    // Other ScrapeErrors (non-HTML, oversized, 4xx/5xx) → fall through to Microlink.
  }

  // 2) Microlink render fallback (Cloudflare/JS-only). No html/JSON-LD on this path.
  if (!og) {
    try {
      const rendered = await renderExternalPage(url, undefined, config.MICROLINK_API_KEY as string | undefined);
      if (rendered.title || rendered.image) og = rendered;
    } catch {
      og = null;
    }
  }

  // 3) Still nothing → minimal metadata → form's manual-entry path engages.
  if (!og) return { success: true, metadata: minimal };

  // 4) Derive fields from whatever we got.
  const title = og.title?.trim() || url;
  const description = og.description?.trim() || null;
  const { year, model } = extractYearModel(`${title} ${description ?? ''}`);
  const { price, priceLabel } = extractPrice(og, jsonLd, html, sourceSite);
  const auctionEndTime = extractAuctionEnd(jsonLd);
  const category = year || model ? 'vehicle' : null;
  const imageUrl = og.image ? await rehostImage(og.image) : null;

  const metadata: FindMetadata = {
    title,
    description,
    imageUrl,
    sourceSite,
    year,
    model,
    price,
    priceLabel,
    auctionEndTime,
    category,
  };
  return { success: true, metadata };
});

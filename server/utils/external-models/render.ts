/**
 * Rendering-service fallback for sites whose Cloudflare bot-management blocks a
 * plain server-side fetch (MakerWorld, Cults3D, Thangs, MyMiniFactory). Used by
 * `fetchExternalMetadata` ONLY when the self-hosted direct fetch is blocked or
 * empty — so the free direct path still serves Thingiverse / Printables.
 *
 * Backed by Microlink (the approach OEA used): a headless-render API that returns
 * normalized page metadata. Defaults to the free public endpoint; set
 * `NUXT_MICROLINK_API_KEY` for the pro tier (higher limits + better Cloudflare
 * handling), sent as `x-api-key`. The user URL is fetched by Microlink's infra,
 * not ours — so there's no SSRF concern here (and the direct path already
 * rejects private/loopback addresses before we ever fall back).
 */
import type { OgMetadata } from './ogParser';
import { ScrapeError } from './errors';

interface MicrolinkResponse {
  status?: string;
  /** Upstream HTTP status of the rendered page (Microlink reports it here). */
  statusCode?: number;
  data?: {
    title?: string;
    description?: string;
    author?: string;
    publisher?: string;
    image?: { url?: string } | null;
    logo?: { url?: string } | null;
  };
}

const DEFAULT_ENDPOINT = 'https://api.microlink.io';

/**
 * Render `url` via the service and return OG-shaped metadata, or throw ScrapeError.
 *
 * `apiKey` is forwarded from runtimeConfig by the caller and is the ONLY source
 * for the credential. It used to fall back to `process.env.MICROLINK_API_KEY`,
 * which gave one credential two spellings: runtimeConfig is fed by
 * `NUXT_MICROLINK_API_KEY`, while a raw `process.env` read on Workers needs a
 * PLAIN var of the unprefixed name. That fallback could never fire in
 * production anyway — every caller forwards a defined string, and an unset
 * runtimeConfig key is `''`, not `undefined` — so a plain var set in the hope
 * of keying this call silently did nothing. One name now, and only one.
 *
 * Omitting the argument means "no key": the request goes out on the free tier
 * rather than reaching for an environment value nobody set deliberately.
 */
export async function renderExternalPage(url: string, fetchImpl?: typeof fetch, apiKey?: string): Promise<OgMetadata> {
  // Endpoint override, unlike the key, genuinely IS a raw read and therefore
  // genuinely needs a PLAIN Worker var — it has no runtimeConfig entry. It is a
  // test/staging redirect knob with a safe default, not a secret.
  const base = process.env.MICROLINK_API_URL || DEFAULT_ENDPOINT;
  const endpoint = `${base}?url=${encodeURIComponent(url)}`;
  const doFetch = fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(endpoint, {
      headers: { Accept: 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
    });
  } catch {
    throw new ScrapeError('Couldn’t reach the preview service. Try again in a moment.', 502);
  }

  if (res.status === 429) {
    throw new ScrapeError('The preview service is busy right now (rate-limited). Try again shortly.', 429);
  }

  let body: MicrolinkResponse;
  try {
    body = (await res.json()) as MicrolinkResponse;
  } catch {
    throw new ScrapeError('That site blocks automated previews and we couldn’t render it.', 422);
  }

  if (body.status !== 'success' || !body.data) {
    throw new ScrapeError('That site blocks automated previews and we couldn’t render it.', 422);
  }

  // Microlink wraps the render in `status:"success"` even when the upstream page
  // returned an error (e.g. GrabCAD behind CloudFront answers 403 with an
  // "ERROR: The request could not be satisfied" body). Treat any 4xx/5xx upstream
  // status as blocked rather than storing the error page as model metadata.
  if (typeof body.statusCode === 'number' && body.statusCode >= 400) {
    throw new ScrapeError('That site blocks automated previews and we couldn’t render it.', 422);
  }

  const d = body.data;
  const image = d.image?.url ?? d.logo?.url ?? null;
  if (!d.title && !image) {
    throw new ScrapeError('We couldn’t read any model details from that page, even with rendering.', 422);
  }

  return {
    title: d.title ?? null,
    description: d.description ?? null,
    image,
    images: [d.image?.url, d.logo?.url].filter((u): u is string => !!u),
    siteName: d.publisher ?? null,
    author: d.author ?? null,
    keywords: [],
    license: null,
    jsonLd: [],
  };
}

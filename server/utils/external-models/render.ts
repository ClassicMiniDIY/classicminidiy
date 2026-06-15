/**
 * Rendering-service fallback for sites whose Cloudflare bot-management blocks a
 * plain server-side fetch (MakerWorld, Cults3D, Thangs, MyMiniFactory). Used by
 * `fetchExternalMetadata` ONLY when the self-hosted direct fetch is blocked or
 * empty — so the free direct path still serves Thingiverse / Printables.
 *
 * Backed by Microlink (the approach OEA used): a headless-render API that returns
 * normalized page metadata. Defaults to the free public endpoint; set
 * `MICROLINK_API_KEY` for the pro tier (higher limits + better Cloudflare
 * handling), sent as `x-api-key`. The user URL is fetched by Microlink's infra,
 * not ours — so there's no SSRF concern here (and the direct path already
 * rejects private/loopback addresses before we ever fall back).
 */
import type { OgMetadata } from './ogParser';
import { ScrapeError } from './errors';

interface MicrolinkResponse {
  status?: string;
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

/** Render `url` via the service and return OG-shaped metadata, or throw ScrapeError. */
export async function renderExternalPage(url: string, fetchImpl?: typeof fetch): Promise<OgMetadata> {
  const apiKey = process.env.MICROLINK_API_KEY;
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

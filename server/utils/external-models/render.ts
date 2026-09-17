/**
 * Rendering-service fallback for sites whose Cloudflare bot-management blocks a
 * plain server-side fetch (MakerWorld, MyMiniFactory, Thangs). Used by
 * `fetchExternalMetadata` and the exchange Finds parser ONLY when the
 * self-hosted direct fetch is blocked or empty — so the free direct path still
 * serves Thingiverse. (Printables pages are challenged too since 2026-09, but
 * its GraphQL API is not; see `./printables.ts`, which runs before either path.)
 *
 * Backed by Jina Reader (`r.jina.ai`), which replaced Microlink on 2026-09-17:
 * Microlink's free tier is quota'd per egress IP (Workers share theirs) and
 * refuses antibot-protected pages outright, and its paid tier was not worth it
 * for this feature. Jina renders in a headless browser and, in the 2026-09-17
 * test, got through the Cloudflare challenge on MakerWorld and MyMiniFactory.
 * Cults3D still answers "Just a moment..." and GrabCAD is still CloudFront-403,
 * so those two are blocked on every path we have.
 *
 * We ask for `X-Target-Selector: head` so the response body is ~25 tokens: we
 * only want `data.metadata` (the page's `<meta>` set, `og:*` included) and
 * `data.httpStatus`, never the rendered content. That keeps the free 10M-token
 * allowance effectively unlimited for this use. `NUXT_JINA_API_KEY` lifts the
 * keyless 20 req/min ceiling to 200; it is sent as a Bearer token. The user URL
 * is fetched by Jina's infra, not ours — so there's no SSRF concern here (and
 * the direct path already rejects private/loopback addresses before we ever
 * fall back).
 */
import type { OgMetadata } from './ogParser';
import { ScrapeError } from './errors';

interface JinaReaderResponse {
  /** Mirrors the HTTP status; 200 on success, 4xx/5xx with `message` on failure. */
  code?: number;
  message?: string;
  readableMessage?: string;
  data?: {
    title?: string;
    description?: string;
    url?: string;
    /** Upstream HTTP status of the rendered page. */
    httpStatus?: number;
    /** Every `<meta>` on the page keyed by name/property, plus `lang`. */
    metadata?: Record<string, string | undefined>;
  } | null;
}

const DEFAULT_ENDPOINT = 'https://r.jina.ai';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Titles that mean "you got the bot wall, not the page". Cloudflare's managed
 * challenge and its block page both render with a 200 through a headless
 * browser, so the upstream status alone does not tell us.
 */
const INTERSTITIAL_TITLE = /^(just a moment|attention required|access denied|please verify you are a human)/i;

const BLOCKED = 'That site blocks automated previews and we couldn’t render it.';

/**
 * Render `url` via the service and return OG-shaped metadata, or throw ScrapeError.
 *
 * `apiKey` is forwarded from runtimeConfig by the caller and is the ONLY source
 * for the credential (runtimeConfig `JINA_API_KEY`, fed by `NUXT_JINA_API_KEY`
 * on the Worker). There is deliberately no `process.env` fallback: that would
 * give one credential two spellings, and a plain var of the unprefixed name
 * could never fire because every caller forwards a defined string (an unset
 * runtimeConfig key is `''`, not `undefined`). Omitting the argument means "no
 * key": the request goes out on the keyless tier.
 */
export async function renderExternalPage(url: string, fetchImpl?: typeof fetch, apiKey?: string): Promise<OgMetadata> {
  // Endpoint override, unlike the key, genuinely IS a raw read and therefore
  // genuinely needs a PLAIN Worker var — it has no runtimeConfig entry. It is a
  // test/staging redirect knob with a safe default, not a secret.
  const base = (process.env.JINA_READER_URL || DEFAULT_ENDPOINT).replace(/\/+$/, '');
  const endpoint = `${base}/${url}`;
  const doFetch = fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(endpoint, {
      headers: {
        Accept: 'application/json',
        // Metadata only: the `<head>` renders to a near-empty markdown body, but
        // `data.metadata` is still the full meta set for the page.
        'X-Target-Selector': 'head',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ScrapeError('Couldn’t reach the preview service. Try again in a moment.', 502);
  }

  if (res.status === 429) {
    throw new ScrapeError('The preview service is busy right now (rate-limited). Try again shortly.', 429);
  }

  let body: JinaReaderResponse;
  try {
    body = (await res.json()) as JinaReaderResponse;
  } catch {
    throw new ScrapeError(BLOCKED, 422);
  }

  if (res.status >= 400 || (typeof body.code === 'number' && body.code >= 400) || !body.data) {
    throw new ScrapeError(BLOCKED, 422);
  }

  const d = body.data;
  const meta = d.metadata ?? {};

  // The render "succeeded" but the page itself was an error (GrabCAD behind
  // CloudFront answers 403 with an "ERROR: The request could not be satisfied"
  // body) or a bot interstitial. Never store either as model metadata.
  if (d.httpStatus === 404 || d.httpStatus === 410) {
    throw new ScrapeError('That model page couldn’t be found (404). It may have been removed.', 404);
  }
  if (typeof d.httpStatus === 'number' && d.httpStatus >= 400) {
    throw new ScrapeError(BLOCKED, 422);
  }
  const title = (meta['og:title'] || meta['twitter:title'] || d.title || '').trim() || null;
  if (title && INTERSTITIAL_TITLE.test(title)) {
    throw new ScrapeError(BLOCKED, 422);
  }

  const images = [meta['og:image'], meta['og:image:secure_url'], meta['twitter:image'], meta['twitter:image:src']]
    .map((u) => (u ?? '').trim())
    .filter((u, i, all) => /^https?:\/\//i.test(u) && all.indexOf(u) === i);
  const image = images[0] ?? null;

  // A listing needs a title. An image alone is usually the site's default
  // share card on a soft-404 (MakerWorld does this), not the model.
  if (!title) {
    throw new ScrapeError('We couldn’t read any model details from that page, even with rendering.', 422);
  }

  const description = (
    meta['og:description'] ||
    meta['twitter:description'] ||
    meta.description ||
    d.description ||
    ''
  ).trim();
  const keywords = (meta.keywords ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    title,
    description: description || null,
    image,
    images,
    siteName: meta['og:site_name']?.trim() || null,
    author: (meta.author || meta['article:author'] || meta['twitter:creator'] || '').trim() || null,
    keywords,
    license: null,
    jsonLd: [],
  };
}

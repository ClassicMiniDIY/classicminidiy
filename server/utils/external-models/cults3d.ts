/**
 * First-party metadata path for Cults3D. Its pages sit behind a Cloudflare
 * managed challenge that neither a plain fetch nor the Jina render gets past
 * ("Just a moment..." with upstream 200), so the only way to list a Cults3D
 * model is its GraphQL API at `cults3d.com/graphql`. That API is free but
 * authenticated: HTTP Basic with a Cults3D username and the API key from the
 * account's settings page. Both come in through runtimeConfig
 * (`CULTS_3D_USER` / `CULTS_3D_API_KEY`, Worker secrets `NUXT_CULTS_3D_USER` /
 * `NUXT_CULTS_3D_API_KEY`). With either unset this adapter returns `null` and
 * the caller falls through to the (blocked) page path, which yields the usual
 * "site blocks previews" error rather than a crash.
 *
 * Lookup is by slug: the site's `urlPattern` captures the final path segment
 * of `/[lang]/3d-model/{category}/{slug}` as the external id, and the API's
 * `creation(slug:)` takes exactly that.
 *
 * Schema notes (introspected 2026-09-17; introspection is enabled): `description`
 * and `details` are both plain text with CRLF; `license` carries Cults' own
 * `code` (`cults_pu`, `cc_by_nc`, …), an SPDX id and `allowsCommercialUse`;
 * `illustrationImageUrl` / `illustrations[].imageUrl` default to 516px thumbor
 * URLs on `images.cults3d.com` served as `image/*`. The `version: DEFAULT`
 * originals on `fbi.cults3d.com` come back `application/octet-stream`, which
 * the submit route's image re-host skips, so we take the thumbnails. Cults'
 * Cloudflare rules 1010-block some client signatures (Python urllib was), so
 * the request carries an explicit product User-Agent.
 */
import type { PrintSettings } from '../../../data/models/model-library';
import { sourceConfig } from '../../../data/models/external-sources';
import type { EnrichedFields } from './enrichers';
import { truncateSummary } from './enrichers';
import { decodeHtmlEntities } from './ogParser';
import { ScrapeError } from './errors';
import { licenseFlags, normalizeLicenseLabel, type LicenseFlags } from './license';

const CULTS_GRAPHQL_ENDPOINT = 'https://cults3d.com/graphql';
const REQUEST_TIMEOUT_MS = 10_000;

const USER_AGENT = 'ClassicMiniDIY/1.0 (+https://classicminidiy.com)';

const CREATION_QUERY = `query CmdiyCreation($slug: String!) {
  creation(slug: $slug) {
    slug
    name
    url
    description
    details
    illustrationImageUrl
    illustrations { imageUrl }
    creator { nick url }
    license { code name spdxId allowsCommercialUse }
    tags
    category { name }
    safe
    visibility
  }
}`;

interface CultsCreation {
  slug?: string | null;
  name?: string | null;
  url?: string | null;
  /** Short blurb, plain text (CRLF). */
  description?: string | null;
  /** Long body (print notes etc.), plain text (CRLF). */
  details?: string | null;
  illustrationImageUrl?: string | null;
  illustrations?: { imageUrl?: string | null }[] | null;
  creator?: { nick?: string | null; url?: string | null } | null;
  license?: {
    code?: string | null;
    name?: string | null;
    spdxId?: string | null;
    allowsCommercialUse?: boolean | null;
  } | null;
  tags?: (string | null)[] | null;
  category?: { name?: string | null } | null;
  /** false = NSFW-flagged on Cults. */
  safe?: boolean | null;
  visibility?: string | null;
}

interface CultsGraphqlResponse {
  data?: { creation?: CultsCreation | null } | null;
  errors?: { message?: string }[];
}

export interface Cults3dCredentials {
  user?: string;
  apiKey?: string;
}

export interface Cults3dModel {
  fields: EnrichedFields;
  /** Absolute image URLs, primary first, de-duplicated. */
  images: string[];
}

/** CRLF plain text from the API → the newline-normalized text the listing stores. */
function plainText(text: string | null | undefined): string {
  return decodeHtmlEntities((text ?? '').replace(/\r\n?/g, '\n'))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Cults' licenses are either Creative Commons (derive from the SPDX id, which
 * also fixes Cults marking CC0 as non-commercial) or Cults' own: `cults_pu`
 * (private use: no remix, no commercial), `cults_cu` (commercial, remix ok),
 * `cults_cu_nd` (commercial, no derivatives). Open-hardware/GPL style licenses
 * allow remixing; commercial use follows Cults' own flag for those.
 */
function cultsLicense(license: CultsCreation['license']): { label: string | null; flags: LicenseFlags } {
  const cfg = sourceConfig('cults3d');
  const spdx = license?.spdxId?.trim() || '';
  const code = (license?.code ?? '').toLowerCase();
  if (/^CC/i.test(spdx)) {
    const label = normalizeLicenseLabel(spdx);
    return { label, flags: licenseFlags(label, 'cults3d') };
  }
  const label = license?.name?.trim() || spdx || cfg.defaultLicense;
  if (!code) return { label, flags: licenseFlags(null, 'cults3d') };
  return {
    label,
    flags: {
      remixesAllowed: !(code === 'cults_pu' || code.endsWith('_nd')),
      commercialUseAllowed:
        typeof license?.allowsCommercialUse === 'boolean' ? license.allowsCommercialUse : cfg.commercialUseAllowed,
    },
  };
}

/** Exported for tests: pure mapping from an API `creation` node to listing fields. */
export function mapCults3dCreation(creation: CultsCreation): Cults3dModel {
  const title = creation.name?.trim() || 'Untitled';
  const blurb = plainText(creation.description);
  const details = plainText(creation.details);
  const description = [blurb, details].filter(Boolean).join('\n\n');
  const summary = blurb ? truncateSummary(blurb) : description ? truncateSummary(description) : null;

  const nick = creation.creator?.nick?.trim() || null;
  const creatorUrl = creation.creator?.url?.trim() || (nick ? `https://cults3d.com/en/users/${nick}` : null);

  const { label: license, flags } = cultsLicense(creation.license);

  const images: string[] = [];
  for (const candidate of [creation.illustrationImageUrl, ...(creation.illustrations ?? []).map((i) => i?.imageUrl)]) {
    const url = (candidate ?? '').trim();
    if (/^https?:\/\//i.test(url) && !images.includes(url)) images.push(url);
  }

  const tags = (creation.tags ?? [])
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .slice(0, 10);

  const printSettings: PrintSettings = {};

  return {
    fields: {
      title,
      description,
      summary,
      authorName: nick,
      authorUrl: creatorUrl,
      license,
      ...flags,
      tags,
      printSettings,
    },
    images,
  };
}

/**
 * Fetch a public Cults3D creation by slug.
 *
 * - Returns the mapped listing on success.
 * - Throws a 404 `ScrapeError` when the API answers `creation: null`.
 * - Returns `null` when credentials are missing, on transport errors, non-2xx
 *   (including 401 for a bad key — logged, since that is an ops problem, not
 *   a user one), or a GraphQL error, so the caller falls through.
 *
 * The slug is `[\w-]+` by construction (site `urlPattern`) and the endpoint is
 * a fixed public host — nothing here is attacker-steerable, which is why this
 * bypasses `safeFetch`.
 */
export async function fetchCults3dModel(
  slug: string,
  creds: Cults3dCredentials,
  fetchImpl?: typeof fetch
): Promise<Cults3dModel | null> {
  if (!/^[\w-]+$/.test(slug)) return null;
  if (!creds.user || !creds.apiKey) return null;
  const doFetch = fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(CULTS_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        Authorization: `Basic ${btoa(`${creds.user}:${creds.apiKey}`)}`,
      },
      body: JSON.stringify({ query: CREATION_QUERY, variables: { slug } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (res.status === 401 || res.status === 403) {
    console.error(
      '[external/cults3d] API rejected the credentials (%d) — check NUXT_CULTS_3D_USER / _API_KEY',
      res.status
    );
    return null;
  }
  if (!res.ok) return null;

  let body: CultsGraphqlResponse;
  try {
    body = (await res.json()) as CultsGraphqlResponse;
  } catch {
    return null;
  }
  if (body.errors?.length) {
    console.warn('[external/cults3d] GraphQL error — falling back to page scrape:', body.errors[0]?.message);
    return null;
  }
  if (!body.data || !('creation' in body.data)) return null;
  if (body.data.creation === null) {
    throw new ScrapeError('That model page couldn’t be found (404). It may have been removed.', 404, 'cults3d');
  }
  if (!body.data.creation) return null;

  const creation = body.data.creation;
  if (creation.safe === false) {
    throw new ScrapeError(
      'That model is flagged as not-safe-for-work on Cults3D and can’t be listed here.',
      422,
      'cults3d'
    );
  }
  if (creation.visibility && creation.visibility !== 'PUBLIC') {
    throw new ScrapeError('That model isn’t public on Cults3D, so it can’t be listed here.', 422, 'cults3d');
  }

  const model = mapCults3dCreation(creation);
  if (model.fields.title === 'Untitled' && model.images.length === 0) return null;
  return model;
}

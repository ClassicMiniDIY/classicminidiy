/**
 * First-party metadata path for Printables. Since 2026-09 `printables.com`
 * answers every server-side page fetch with a Cloudflare managed challenge
 * (`cf-mitigated: challenge`, 403 "Just a moment..."), so the OG/JSON-LD parse
 * never sees the page and every Printables submission fell through to the
 * render fallback (then Microlink, whose free tier either 429'd on the shared
 * Workers egress quota or refused antibot-protected pages). Either way the user
 * saw an error for a model that is plainly public.
 *
 * `api.printables.com/graphql/` is the same endpoint the Printables front end
 * uses. It is unauthenticated for public models, is NOT behind the challenge,
 * and returns structured fields the OG path never had (license abbreviation,
 * tags, materials, layer heights, nozzle sizes, every gallery image). So for
 * Printables this is the primary path; the HTML + render chain stays as the
 * fallback in case the API shape changes under us.
 *
 * Introspection is disabled on that endpoint, so `PRINT_QUERY` is the field set
 * verified by hand on 2026-09-17. If Printables removes a field the whole query
 * 400s with `Cannot query field 'x' on type 'PrintType'`; `fetchPrintablesModel`
 * then returns `null` and the caller falls back rather than failing the submit.
 *
 * The API is NOT reachable from the Worker directly. Its anonymous throttle is
 * keyed on the client IP, Workers egress from a shared pool, and on 2026-09-17
 * every request from that pool answered 429 "Request was throttled." while the
 * same call from a residential IP succeeded. So the direct POST is tried first
 * (it is free, and works from `bun run dev`), and on any non-2xx or transport
 * failure the SAME query goes out as a GET through Jina Reader
 * (`readThroughReader`), whose egress the API does not throttle. The endpoint
 * accepts GET with `query` + `variables` in the query string.
 */
import type { PrintSettings } from '../../../data/models/model-library';
import { sourceConfig } from '../../../data/models/external-sources';
import type { EnrichedFields } from './enrichers';
import { truncateSummary } from './enrichers';
import { decodeHtmlEntities } from './ogParser';
import { ScrapeError } from './errors';
import { licenseFlags } from './license';
import { readThroughReader } from './render';

const PRINTABLES_GRAPHQL_ENDPOINT = 'https://api.printables.com/graphql/';
/** Gallery images are served from the public media CDN as `<base>/<filePath>`. */
const PRINTABLES_MEDIA_BASE = 'https://media.printables.com/';
const REQUEST_TIMEOUT_MS = 10_000;

const PRINT_QUERY = `query CmdiyPrint($id: ID!) {
  print(id: $id) {
    id
    name
    summary
    description
    user { publicUsername handle }
    license { abbreviation }
    tags { name }
    image { filePath }
    images { filePath }
    layerHeights
    nozzleDiameters
    materials { name }
  }
}`;

interface PrintablesPrint {
  id?: string | null;
  name?: string | null;
  summary?: string | null;
  /** HTML fragment (`<p>…</p>`), not plain text. */
  description?: string | null;
  user?: { publicUsername?: string | null; handle?: string | null } | null;
  license?: { abbreviation?: string | null } | null;
  tags?: { name?: string | null }[] | null;
  image?: { filePath?: string | null } | null;
  images?: { filePath?: string | null }[] | null;
  layerHeights?: (number | string | null)[] | null;
  nozzleDiameters?: (number | string | null)[] | null;
  materials?: { name?: string | null }[] | null;
}

interface PrintablesGraphqlResponse {
  data?: { print?: PrintablesPrint | null } | null;
  errors?: { message?: string }[];
}

export interface PrintablesModel {
  fields: EnrichedFields;
  /** Absolute image URLs, primary first, de-duplicated. */
  images: string[];
}

export interface PrintablesDeps {
  /** Injected for tests — stands in for the direct GraphQL POST. */
  apiImpl?: typeof fetch;
  /** Injected for tests — stands in for the Jina Reader GET proxy. */
  readerImpl?: typeof fetch;
  /** Jina Reader API key, forwarded from runtimeConfig by the route. */
  readerApiKey?: string;
}

/** Remove tags until none remain, so nested input like `<scr<script>ipt>` cannot survive one pass. */
function stripTags(input: string): string {
  let out = input;
  for (;;) {
    const next = out.replace(/<[^>]*>/g, '');
    if (next === out) return out;
    out = next;
  }
}

/** Turn the API's HTML description into the plain text the listing stores. */
function htmlToText(html: string): string {
  return decodeHtmlEntities(stripTags(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n')))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function mediaUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return PRINTABLES_MEDIA_BASE + filePath.replace(/^\/+/, '');
}

/** Exported for tests: pure mapping from an API `print` node to listing fields. */
export function mapPrintablesPrint(print: PrintablesPrint): PrintablesModel {
  const cfg = sourceConfig('printables');
  const title = print.name?.trim() || 'Untitled';
  const license = print.license?.abbreviation?.trim() || cfg.defaultLicense;
  const description = print.description ? htmlToText(print.description) : (print.summary?.trim() ?? '');
  const summary = print.summary?.trim() || (description ? truncateSummary(description) : null);

  const username = print.user?.publicUsername?.trim() || null;
  const handle = print.user?.handle?.trim() || username;

  const materials = (print.materials ?? []).map((m) => m?.name?.trim()).filter((n): n is string => !!n);
  const layerHeight = toNumber(print.layerHeights?.[0]);
  const nozzleSize = toNumber(print.nozzleDiameters?.[0]);
  const printSettings: PrintSettings = {};
  if (materials.length) {
    printSettings.recommendedMaterial = materials[0];
    if (materials.length > 1) printSettings.alternativeMaterials = materials.slice(1);
  }
  if (layerHeight !== null) printSettings.layerHeight = layerHeight;
  if (nozzleSize !== null) printSettings.nozzleSize = nozzleSize;

  const images: string[] = [];
  for (const candidate of [print.image, ...(print.images ?? [])]) {
    const url = mediaUrl(candidate?.filePath);
    if (url && !images.includes(url)) images.push(url);
  }

  return {
    fields: {
      title,
      description,
      summary,
      authorName: username,
      authorUrl: handle ? `https://www.printables.com/@${handle}` : null,
      license,
      ...licenseFlags(license, 'printables'),
      tags: (print.tags ?? [])
        .map((t) => t?.name?.trim())
        .filter((n): n is string => !!n)
        .slice(0, 10),
      printSettings,
    },
    images,
  };
}

/**
 * Interpret one GraphQL response body, whichever transport carried it.
 *
 * - `{ model }` on success.
 * - `{ notFound: true }` when the API answers `print: null` — the model is gone
 *   or was never public, and no amount of rendering will change that.
 * - `null` on a GraphQL error (field drift) or an unusable shape.
 */
function interpretResponse(
  body: PrintablesGraphqlResponse,
  via: 'direct' | 'reader'
): { model: PrintablesModel } | { notFound: true } | null {
  if (body.errors?.length) {
    console.warn(
      `[external/printables] GraphQL error (${via}) — falling back to page scrape:`,
      body.errors[0]?.message
    );
    return null;
  }
  if (!body.data || !('print' in body.data)) return null;
  if (body.data.print === null) return { notFound: true };
  if (!body.data.print) return null;

  const model = mapPrintablesPrint(body.data.print);
  // A print with neither a name nor an image is not something we can list —
  // let the page scrape have a go rather than storing a blank listing.
  if (model.fields.title === 'Untitled' && model.images.length === 0) return null;
  return { model };
}

/** Direct POST. `null` on transport error or non-2xx (logged) so the reader path gets its turn. */
async function queryDirect(externalId: string, doFetch: typeof fetch): Promise<PrintablesGraphqlResponse | null> {
  let res: Response;
  try {
    res = await doFetch(PRINTABLES_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // The endpoint is CORS-open but the front end always sends this; match it
        // so we look like the first-party client rather than an anonymous script.
        Origin: 'https://www.printables.com',
      },
      body: JSON.stringify({ query: PRINT_QUERY, variables: { id: externalId } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[external/printables] direct API fetch failed:', err instanceof Error ? err.message : err);
    return null;
  }
  if (!res.ok) {
    console.warn(`[external/printables] direct API answered HTTP ${res.status}`);
    return null;
  }
  try {
    return (await res.json()) as PrintablesGraphqlResponse;
  } catch {
    return null;
  }
}

/** The same query as a GET, proxied through Jina Reader. `null` when the proxy or the API failed. */
async function queryViaReader(
  externalId: string,
  doFetch: typeof fetch | undefined,
  apiKey: string | undefined
): Promise<PrintablesGraphqlResponse | null> {
  const params = new URLSearchParams({ query: PRINT_QUERY, variables: JSON.stringify({ id: externalId }) });
  const proxied = await readThroughReader(`${PRINTABLES_GRAPHQL_ENDPOINT}?${params}`, doFetch, apiKey);
  if (!proxied) return null;
  if (proxied.httpStatus >= 400) {
    console.warn(`[external/printables] API via reader answered HTTP ${proxied.httpStatus}`);
    return null;
  }
  try {
    return JSON.parse(proxied.text) as PrintablesGraphqlResponse;
  } catch {
    return null;
  }
}

/**
 * Fetch a public Printables model by its numeric id.
 *
 * - Returns the mapped listing on success.
 * - Throws a 404 `ScrapeError` when the API answers `print: null`.
 * - Returns `null` when both transports failed (transport error, non-2xx,
 *   GraphQL error, bad JSON) so `fetchExternalMetadata` falls through to the
 *   HTML/render chain.
 *
 * The reader fallback runs in production (no injected `apiImpl`) or when a
 * test supplies `readerImpl`; a test that injects only `apiImpl` never reaches
 * the real service.
 *
 * `externalId` is digits only (it comes from the site's `urlPattern`), and the
 * endpoint is a fixed public host — nothing here is attacker-steerable, which is
 * why this bypasses `safeFetch` on both transports.
 */
export async function fetchPrintablesModel(
  externalId: string,
  deps: PrintablesDeps = {}
): Promise<PrintablesModel | null> {
  if (!/^\d+$/.test(externalId)) return null;

  const attempts: (() => Promise<PrintablesGraphqlResponse | null>)[] = [
    () => queryDirect(externalId, deps.apiImpl ?? fetch),
  ];
  if (!deps.apiImpl || deps.readerImpl) {
    attempts.push(() => queryViaReader(externalId, deps.readerImpl, deps.readerApiKey));
  }

  for (const [i, attempt] of attempts.entries()) {
    const body = await attempt();
    if (!body) continue;
    const result = interpretResponse(body, i === 0 ? 'direct' : 'reader');
    if (!result) continue;
    if ('notFound' in result) {
      throw new ScrapeError('That model page couldn’t be found (404). It may have been removed.', 404, 'printables');
    }
    return result.model;
  }
  return null;
}

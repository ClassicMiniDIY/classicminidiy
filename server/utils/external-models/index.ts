/**
 * External-model scraper entry point. Detects the source site, fetches the
 * page server-side, parses Open Graph / JSON-LD, and runs the per-site
 * enricher into a normalized `ScrapedExternalModel`. No third-party API.
 *
 * Re-exports the shared detection helpers so server code has one import.
 */

import type { PrintSettings } from '../../../data/models/model-library';
import {
  type ExternalSourceSite,
  detectSourceSite,
  extractExternalId,
  isValidExternalUrl,
  normalizeExternalUrl,
} from '../../../data/models/external-sources';
import { fetchExternalPage, parseOpenGraph } from './ogParser';
import { enrich } from './enrichers';

export { detectSourceSite, extractExternalId, isValidExternalUrl, normalizeExternalUrl };

export interface ScrapedExternalModel {
  sourceSite: ExternalSourceSite;
  /** Normalized canonical URL (dedupe key). */
  sourceUrl: string;
  externalId: string | null;
  title: string;
  description: string;
  summary: string | null;
  authorName: string | null;
  authorUrl: string | null;
  license: string | null;
  remixesAllowed: boolean | null;
  commercialUseAllowed: boolean | null;
  tags: string[];
  printSettings: PrintSettings;
  images: { url: string; isPrimary: boolean }[];
}

export class ScrapeError extends Error {
  constructor(
    message: string,
    public statusCode = 422,
    public site?: ExternalSourceSite
  ) {
    super(message);
    this.name = 'ScrapeError';
  }
}

export interface ScrapeDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Scrape an external 3D-model page into normalized listing fields. Throws a
 * `ScrapeError` (with a user-facing message + HTTP-ish statusCode) on bad URLs,
 * 404s, or blocked pages.
 */
export async function fetchExternalMetadata(rawUrl: string, deps: ScrapeDeps = {}): Promise<ScrapedExternalModel> {
  if (!isValidExternalUrl(rawUrl)) {
    throw new ScrapeError('That doesn’t look like a valid web address. Paste the full link to the model page.', 400);
  }

  const sourceUrl = normalizeExternalUrl(rawUrl);
  const site = detectSourceSite(sourceUrl) ?? 'other';

  let page;
  try {
    page = await fetchExternalPage(sourceUrl, deps.fetchImpl);
  } catch {
    throw new ScrapeError('Couldn’t reach that page. Check the link and try again.', 502, site);
  }

  if (page.status === 404) {
    throw new ScrapeError('That model page couldn’t be found (404). It may have been removed.', 404, site);
  }
  if (page.status >= 400) {
    throw new ScrapeError(
      `The source site returned an error (${page.status}). It may block automated previews — try a different model.`,
      502,
      site
    );
  }

  const og = parseOpenGraph(page.html);
  const externalId = extractExternalId(sourceUrl, site);
  const fields = enrich(og, { url: sourceUrl, site, externalId });

  if (!fields.title || fields.title === 'Untitled') {
    if (!og.title && !og.image) {
      throw new ScrapeError(
        'We couldn’t read any model details from that page. It may require a login or block previews.',
        422,
        site
      );
    }
  }

  const images = og.images.map((url, i) => ({ url, isPrimary: i === 0 }));

  return {
    sourceSite: site,
    sourceUrl,
    externalId,
    title: fields.title,
    description: fields.description,
    summary: fields.summary,
    authorName: fields.authorName,
    authorUrl: fields.authorUrl,
    license: fields.license,
    remixesAllowed: fields.remixesAllowed,
    commercialUseAllowed: fields.commercialUseAllowed,
    tags: fields.tags,
    printSettings: fields.printSettings,
    images,
  };
}

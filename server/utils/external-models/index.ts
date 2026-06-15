/**
 * External-model scraper entry point. Detects the source site, fetches the page
 * server-side (self-hosted OG/JSON-LD parse), and runs the per-site enricher
 * into a normalized `ScrapedExternalModel`. When the direct fetch is blocked or
 * empty — e.g. Cloudflare bot-managed sites like MakerWorld — it falls back to a
 * rendering service (`renderExternalPage`). Direct path stays the default, so
 * non-blocked sites (Thingiverse / Printables) never hit the third-party.
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
import { fetchExternalPage, parseOpenGraph, type OgMetadata } from './ogParser';
import { renderExternalPage } from './render';
import { enrich } from './enrichers';
import { ScrapeError } from './errors';

export { detectSourceSite, extractExternalId, isValidExternalUrl, normalizeExternalUrl };
// ScrapeError is NOT re-exported here — import it from './errors' to avoid a
// duplicate Nitro auto-import (both modules live under server/utils).

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

export interface ScrapeDeps {
  /** Injected for tests — exercises the direct fetch path in isolation. */
  fetchImpl?: typeof fetch;
  /** Injected for tests — stands in for the render-service fetch. */
  renderImpl?: typeof fetch;
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

  // 1) Self-hosted direct fetch + OG/JSON-LD parse. `og` stays null when the
  //    page is blocked (4xx), JS-only (200 with no usable metadata), or the
  //    fetch errored — those fall through to the render service below.
  let og: OgMetadata | null = null;
  let directStatus = 0;
  try {
    const page = await fetchExternalPage(sourceUrl, deps.fetchImpl);
    directStatus = page.status;
    if (page.status < 400) {
      const parsed = parseOpenGraph(page.html);
      if (parsed.title || parsed.image) og = parsed;
    }
  } catch (e) {
    // SSRF (private address) and too-large are terminal — never send those on.
    if (e instanceof ScrapeError && (e.statusCode === 400 || e.statusCode === 413)) throw e;
  }

  // 2) Render-service fallback for blocked / JS-only / empty pages. Runs in
  //    production (no injected fetchImpl) or when a test supplies `renderImpl`.
  if (!og && (!deps.fetchImpl || deps.renderImpl)) {
    og = await renderExternalPage(sourceUrl, deps.renderImpl); // throws ScrapeError if it also fails
  }

  if (!og) {
    if (directStatus === 404) {
      throw new ScrapeError('That model page couldn’t be found (404). It may have been removed.', 404, site);
    }
    throw new ScrapeError(
      'We couldn’t read any model details from that page. It may require a login or block previews.',
      422,
      site
    );
  }

  const externalId = extractExternalId(sourceUrl, site);
  const fields = enrich(og, { url: sourceUrl, site, externalId });
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

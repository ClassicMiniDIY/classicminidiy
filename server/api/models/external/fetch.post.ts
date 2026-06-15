/**
 * POST /api/models/external/fetch — scrape PREVIEW (no DB write).
 *
 * Auth-required (keeps the scraper from being an open proxy). Takes a source
 * URL, scrapes Open Graph / JSON-LD server-side, and returns normalized listing
 * fields for the submit form to show before the user commits. Also flags if the
 * URL is already in our DB so the form can link to the existing listing.
 */
import { requireUserAuth } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { fetchExternalMetadata, normalizeExternalUrl } from '../../../utils/external-models';
import { ScrapeError } from '../../../utils/external-models/errors';
import type { ExternalModelPreview } from '../../../../data/models/external-models';

export default defineEventHandler(async (event): Promise<ExternalModelPreview> => {
  await requireUserAuth(event);

  const body = await readBody(event);
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) throw createError({ statusCode: 400, message: 'A model URL is required' });

  const microlinkApiKey = useRuntimeConfig(event).MICROLINK_API_KEY as string;
  let scraped;
  try {
    scraped = await fetchExternalMetadata(url, { microlinkApiKey });
  } catch (err) {
    if (err instanceof ScrapeError) {
      throw createError({ statusCode: err.statusCode, message: err.message });
    }
    console.error('[external/fetch] scrape failed:', err);
    throw createError({ statusCode: 502, message: 'Could not read that page. Try again.' });
  }

  // Dedupe hint: is this source URL already listed?
  const service = getServiceClient();
  const { data: existing } = await service
    .from('external_models')
    .select('slug')
    .eq('source_url', normalizeExternalUrl(url))
    .maybeSingle();

  return {
    sourceSite: scraped.sourceSite,
    sourceUrl: scraped.sourceUrl,
    externalId: scraped.externalId,
    title: scraped.title,
    description: scraped.description,
    summary: scraped.summary,
    authorName: scraped.authorName,
    authorUrl: scraped.authorUrl,
    license: scraped.license,
    remixesAllowed: scraped.remixesAllowed,
    commercialUseAllowed: scraped.commercialUseAllowed,
    tags: scraped.tags,
    printSettings: scraped.printSettings,
    images: scraped.images,
    alreadyListed: existing ? { slug: existing.slug } : null,
  };
});

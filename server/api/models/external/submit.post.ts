/**
 * POST /api/models/external/submit — create a pending external listing.
 *
 * Auth-required. RE-SCRAPES server-side (never trusts client-supplied
 * metadata), dedupes on the normalized source URL, inserts the listing under
 * the caller's RLS identity (so `submitted_by = auth.uid()` and the guard
 * trigger pins status='pending'), then downloads the scraped photos into the
 * shared `model-images` bucket (service role) and records them.
 *
 * External listings have no files/pricing/seller — this is the entire create
 * path. Moderation (approve/reject) happens later via `moderate_external_model`.
 */
import { randomUUID } from 'node:crypto';
import { requireUserClient } from '../../../utils/userAuth';
import { getServiceClient } from '../../../utils/supabase';
import { slugifyModelTitle } from '../../../utils/models';
import { fetchExternalMetadata } from '../../../utils/external-models';
import { ScrapeError } from '../../../utils/external-models/errors';
import { safeFetch, readBodyCapped, SsrfError } from '../../../utils/external-models/ssrf';

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // bucket limit
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function cleanTags(input: unknown, fallback: string[]): string[] {
  const src = Array.isArray(input) ? input : fallback;
  return src
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 10);
}

export default defineEventHandler(async (event) => {
  const { user, supabase } = await requireUserClient(event);
  const body = await readBody(event);

  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) throw createError({ statusCode: 400, message: 'A model URL is required' });

  const categorySlug = typeof body?.categorySlug === 'string' ? body.categorySlug.trim() : '';
  if (!categorySlug) throw createError({ statusCode: 400, message: 'Category is required' });

  // Re-scrape: the source of truth for source_site / id / author / license / images.
  const microlinkApiKey = useRuntimeConfig(event).MICROLINK_API_KEY as string;
  let scraped;
  try {
    scraped = await fetchExternalMetadata(url, { microlinkApiKey });
  } catch (err) {
    if (err instanceof ScrapeError) throw createError({ statusCode: err.statusCode, message: err.message });
    throw createError({ statusCode: 502, message: 'Could not read that page. Try again.' });
  }

  const service = getServiceClient();

  // Dedupe on the normalized URL.
  const { data: existing } = await service
    .from('external_models')
    .select('id, slug, status')
    .eq('source_url', scraped.sourceUrl)
    .maybeSingle();
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'This model is already listed.',
      data: { slug: existing.slug },
    });
  }

  // Title: user override wins, else scraped.
  const title = (typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : scraped.title).slice(0, 200);
  const description =
    typeof body?.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 20000)
      : scraped.description?.slice(0, 20000) || null;
  const summary = scraped.summary?.slice(0, 280) ?? null;

  // Globally-unique external slug (own namespace at /models/external/[slug]).
  const base = slugifyModelTitle(title);
  let slug = base;
  const { data: clashes } = await service.from('external_models').select('slug').like('slug', `${base}%`);
  const taken = new Set((clashes ?? []).map((r) => r.slug));
  if (taken.has(slug)) slug = `${base}-${randomUUID().slice(0, 6)}`;

  // Insert under the caller's RLS identity (guard trigger forces status=pending).
  const { data: row, error: insertError } = await supabase
    .from('external_models')
    .insert({
      submitted_by: user.id,
      source_site: scraped.sourceSite,
      source_url: scraped.sourceUrl,
      source_external_id: scraped.externalId,
      source_author_name: scraped.authorName,
      source_author_url: scraped.authorUrl,
      slug,
      title,
      summary,
      description,
      category_slug: categorySlug,
      tags: cleanTags(body?.tags, scraped.tags),
      source_license: scraped.license,
      remixes_allowed: scraped.remixesAllowed,
      commercial_use_allowed: scraped.commercialUseAllowed,
      print_settings: scraped.printSettings as never,
      metadata_fetched_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single();

  if (insertError || !row) {
    console.error('[external/submit] insert failed:', insertError?.message);
    throw createError({ statusCode: 400, message: insertError?.message || 'Could not save this listing' });
  }

  // Download a copy of each scraped photo into the shared model-images bucket
  // (service role; path `external/{id}/...`). Best-effort — individual failures
  // are skipped, the listing still stands without images.
  let savedImages = 0;
  for (let i = 0; i < Math.min(scraped.images.length, MAX_IMAGES); i++) {
    const img = scraped.images[i];
    try {
      let res: Response;
      try {
        res = await safeFetch(img.url); // SSRF-guarded (image URLs are attacker-controllable too)
      } catch (e) {
        if (e instanceof SsrfError) continue; // skip private/unreachable image hosts
        throw e;
      }
      if (!res.ok) continue;
      const contentLength = res.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) continue; // avoid OOM up front
      const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = MIME_EXT[contentType];
      if (!ext) continue; // only jpg/png/webp per bucket policy
      let buffer: Uint8Array;
      try {
        buffer = await readBodyCapped(res, MAX_IMAGE_BYTES); // caps streaming/oversized bodies
      } catch {
        continue; // exceeded the cap
      }
      if (buffer.byteLength === 0) continue;

      const storagePath = `external/${row.id}/${randomUUID()}.${ext}`;
      const { error: upErr } = await service.storage
        .from('model-images')
        .upload(storagePath, buffer, { contentType, upsert: false });
      if (upErr) {
        console.error('[external/submit] image upload failed:', upErr.message);
        continue;
      }
      const { error: rowErr } = await service.from('external_model_images').insert({
        external_model_id: row.id,
        storage_path: storagePath,
        is_primary: savedImages === 0,
        sort_order: i,
      });
      if (!rowErr) savedImages++;
    } catch (e) {
      console.error('[external/submit] image fetch failed:', e);
    }
  }

  return { id: row.id, slug: row.slug, status: 'pending', savedImages };
});

/**
 * Server side of /admin/reference. Reads go through the service-role admin
 * functions in classicminidiy-supabase (admin_reference_*); writes are
 * FORWARDED to the `publish-reference-data` Edge Function, which runs every
 * publish rule and is the only writer. The mechanism and the rules live in that
 * private repo; this repo never validates or writes reference data itself.
 */
import type { H3Event } from 'h3';
import { requireAdminAuth } from './adminAuth';
import { invalidateReferenceDatasets } from './referenceData';
import { REFERENCE_KEYS, type ReferenceKey } from '~~/shared/referenceDataKeys';

const DATASET_KEY_RE = /^[a-z][a-z0-9_]{1,62}$/;

export function assertDatasetKey(key: unknown): string {
  if (typeof key !== 'string' || !DATASET_KEY_RE.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid dataset key' });
  }
  return key;
}

/**
 * POST the admin's request to publish-reference-data with the admin's OWN
 * access token (the function checks is_admin on the caller; the service key
 * would make every admin action anonymous). Header-only: the cookie path of
 * requireAdminAuth is refused here, so a cross-site form post cannot publish.
 *
 * The body is passed through as parsed JSON and re-serialised by $fetch.
 * Payloads are JSON STRINGS inside it, so their exact text survives the round
 * trip; publish() re-checks every sha256 anyway.
 */
export async function forwardToPublishFunction(event: H3Event, mode: 'validate' | 'publish') {
  const { accessToken, tokenSource } = await requireAdminAuth(event);
  if (tokenSource !== 'header') {
    throw createError({ statusCode: 401, statusMessage: 'Authorization header required' });
  }
  const body = await readBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Body must be a JSON object' });
  }
  // The route decides the mode, never the body: a "validate" request cannot publish.
  // `bootstrap` is not reachable from the editor at all.
  const request = { ...body, mode };

  const config = useRuntimeConfig();
  const url = `${String(config.public.supabaseUrl).replace(/\/$/, '')}/functions/v1/publish-reference-data`;
  const res = await $fetch.raw(url, {
    method: 'POST',
    body: request,
    headers: { Authorization: `Bearer ${accessToken}`, apikey: String(config.public.supabaseKey) },
    ignoreResponseError: true,
  });

  if (mode === 'publish' && res.status === 200) {
    const written = (Array.isArray(request.items) ? request.items : [])
      .map((i: { dataset?: unknown }) => i?.dataset)
      .filter((k: unknown): k is ReferenceKey => typeof k === 'string' && (REFERENCE_KEYS as string[]).includes(k));
    await invalidateReferenceDatasets(written);
  }
  setResponseStatus(event, res.status);
  return res._data;
}

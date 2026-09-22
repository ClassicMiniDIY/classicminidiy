import { ECU_MAPS_REPO, type EcuMapsManifest } from '../../../data/models/github';

/**
 * The /maps support table, read from maps.json on the ECU maps repo's main branch.
 * That file is the single source of truth — the table used to be hardcoded here and
 * drifted from the repo README. Contract: MiniECUMaps docs/plans/2026-09-22-maps-manifest.md.
 *
 * Cached by hand per warm instance, like server/api/exchange-rates.get.ts: there is no
 * CDN cache in front of Worker responses, so without this every /maps SSR would hit
 * raw.githubusercontent.com unauthenticated. Only a valid manifest is stored, and a
 * failed refresh serves the last good copy instead of the error state.
 */
const SUPPORTED_SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 30 * 60 * 1000;

let cached: { manifest: EcuMapsManifest; expiresAt: number } | null = null;
let inFlight: Promise<EcuMapsManifest> | null = null;

async function loadManifest(): Promise<EcuMapsManifest> {
  let raw: unknown;
  try {
    // raw.githubusercontent.com serves text/plain, so force JSON parsing.
    raw = await $fetch(ECU_MAPS_REPO.manifestUrl, { responseType: 'json', timeout: 8000 });
    if (typeof raw === 'string') raw = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Failed to fetch ECU maps manifest: ${error.message || 'Unknown error'}`);
  }

  const manifest = raw as any;
  if (
    manifest?.schemaVersion !== SUPPORTED_SCHEMA_VERSION ||
    !Array.isArray(manifest.features) ||
    !Array.isArray(manifest.platforms)
  ) {
    throw new Error(`Unsupported ECU maps manifest (schemaVersion ${manifest?.schemaVersion ?? 'missing'})`);
  }

  // Return only what the page renders — files[] and diagrams[] stay in the repo.
  return {
    updated: String(manifest.updated ?? ''),
    features: manifest.features.map((f: any) => ({ id: String(f.id), label: String(f.label ?? f.id) })),
    platforms: manifest.platforms.map((p: any) => ({
      id: String(p.id),
      name: String(p.name ?? p.id),
      features: { ...(p.features ?? {}) },
    })),
  };
}

function setCacheHeaders(event: Parameters<typeof setResponseHeaders>[0]) {
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    'CDN-Cache-Control': 'public, max-age=1800',
  });
}

export default defineEventHandler(async (event): Promise<EcuMapsManifest> => {
  if (cached && cached.expiresAt > Date.now()) {
    setCacheHeaders(event);
    return cached.manifest;
  }

  // Collapse concurrent requests on a cold instance onto one GitHub fetch.
  if (!inFlight) {
    inFlight = loadManifest()
      .then((manifest) => {
        cached = { manifest, expiresAt: Date.now() + CACHE_TTL_MS };
        return manifest;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  try {
    const manifest = await inFlight;
    setCacheHeaders(event);
    return manifest;
  } catch (error: any) {
    console.error('Error getting ECU maps manifest:', error);
    if (cached) {
      // Stale beats an empty table. Short max-age so the next request retries.
      setResponseHeaders(event, { 'Cache-Control': 'public, max-age=60' });
      return cached.manifest;
    }
    // Headers are set only on success, so the 502 goes out with Nitro's no-cache.
    throw createError({ statusCode: 502, statusMessage: error.message });
  }
});

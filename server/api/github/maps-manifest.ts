import { ECU_MAPS_REPO, type EcuMapsManifest } from '../../../data/models/github';

/**
 * The /maps support table, read from maps.json on the ECU maps repo's main branch.
 * That file is the single source of truth — the table used to be hardcoded here and
 * drifted from the repo README. Contract: MiniECUMaps docs/plans/2026-09-22-maps-manifest.md.
 */
const SUPPORTED_SCHEMA_VERSION = 1;

export default defineEventHandler(async (event): Promise<EcuMapsManifest> => {
  setResponseHeaders(event, {
    'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    'CDN-Cache-Control': 'public, max-age=1800',
  });

  let raw: unknown;
  try {
    // raw.githubusercontent.com serves text/plain, so force JSON parsing.
    raw = await $fetch(ECU_MAPS_REPO.manifestUrl, { responseType: 'json', timeout: 8000 });
    if (typeof raw === 'string') raw = JSON.parse(raw);
  } catch (error: any) {
    console.error('Error getting ECU maps manifest:', error);
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch ECU maps manifest: ${error.message || 'Unknown error'}`,
    });
  }

  const manifest = raw as any;
  if (
    manifest?.schemaVersion !== SUPPORTED_SCHEMA_VERSION ||
    !Array.isArray(manifest.features) ||
    !Array.isArray(manifest.platforms)
  ) {
    throw createError({
      statusCode: 502,
      statusMessage: `Unsupported ECU maps manifest (schemaVersion ${manifest?.schemaVersion ?? 'missing'})`,
    });
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
});

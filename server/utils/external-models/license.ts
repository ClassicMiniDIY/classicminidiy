/**
 * Shared license helpers for the first-party API adapters (Printables, Cults3D).
 * The OG/render paths never see a license and fall back to the site registry in
 * `enrichers.ts#baseFields`; the API paths get the real one and must honour it.
 */
import type { ExternalSourceSite } from '../../../data/models/external-sources';
import { sourceConfig } from '../../../data/models/external-sources';

export interface LicenseFlags {
  remixesAllowed: boolean | null;
  commercialUseAllowed: boolean | null;
}

/**
 * Normalize a site's license label to the CC abbreviation the listing stores:
 * "Creative Commons — Attribution — Noncommercial" → `CC-BY-NC`, "CC BY-SA 4.0"
 * → `CC-BY-SA`, "CC0 1.0" → `CC0`. Anything that is not a CC license (Cults3D
 * "Private use", Printables "Standard Digital File License") is returned as
 * typed, trimmed, so the human label survives into `source_license`.
 */
export function normalizeLicenseLabel(label: string | null | undefined): string | null {
  const raw = (label ?? '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^CC0\b|^CREATIVE COMMONS ZERO|PUBLIC DOMAIN/.test(upper)) return 'CC0';
  const isCc = /^CC\b|^CREATIVE COMMONS/.test(upper);
  if (!isCc) return raw;
  const parts: string[] = ['CC', 'BY'];
  const has = (re: RegExp) => re.test(upper);
  if (has(/\bNC\b|NON[\s-]?COMMERCIAL/)) parts.push('NC');
  if (has(/\bSA\b|SHARE[\s-]?ALIKE/)) parts.push('SA');
  if (has(/\bND\b|NO[\s-]?DERIV/)) parts.push('ND');
  return parts.join('-');
}

/**
 * Derive the two listing flags from a license abbreviation: `ND` forbids
 * remixes, `NC` forbids commercial use, the permissive CC variants allow both.
 * Anything that is not a CC abbreviation keeps the site registry defaults.
 */
export function licenseFlags(abbreviation: string | null, site: ExternalSourceSite): LicenseFlags {
  const cfg = sourceConfig(site);
  const fallback: LicenseFlags = {
    remixesAllowed: cfg.defaultLicense ? true : null,
    commercialUseAllowed: cfg.commercialUseAllowed,
  };
  if (!abbreviation) return fallback;
  const code = abbreviation.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  if (code === 'CC0' || code === 'CC0-1-0') return { remixesAllowed: true, commercialUseAllowed: true };
  if (!code.startsWith('CC-BY')) return fallback;
  const parts = new Set(code.split('-'));
  return { remixesAllowed: !parts.has('ND'), commercialUseAllowed: !parts.has('NC') };
}

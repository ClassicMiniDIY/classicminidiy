/**
 * Per-site enrichers for the external-model scraper. Each takes already-parsed
 * Open Graph metadata + context and refines it into final listing fields
 * (title cleanup, author, license defaults). They DO NOT fetch — fetching is
 * centralized in `index.ts#fetchExternalMetadata` — so they're pure and
 * unit-testable against fixture OG data. Title/author cleanup regexes are
 * ported from the OpenECUAlliance implementation.
 */

import type { PrintSettings } from '../../../data/models/model-library';
import type { ExternalSourceSite } from '../../../data/models/external-sources';
import { sourceConfig } from '../../../data/models/external-sources';
import type { OgMetadata } from './ogParser';

export interface EnrichContext {
  url: string;
  site: ExternalSourceSite;
  externalId: string | null;
}

export interface EnrichedFields {
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
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** JSON-LD sometimes exposes `material`; otherwise print settings stay empty. */
function printSettingsFromJsonLd(jsonLd: unknown[]): PrintSettings {
  for (const node of jsonLd) {
    if (node && typeof node === 'object') {
      const material = (node as Record<string, unknown>).material;
      if (typeof material === 'string' && material.trim()) {
        return { recommendedMaterial: material.trim() };
      }
    }
  }
  return {};
}

/** Shared defaults: license/commercial flags come from the site registry. */
function baseFields(base: OgMetadata, ctx: EnrichContext): EnrichedFields {
  const cfg = sourceConfig(ctx.site);
  const description = base.description ?? '';
  return {
    title: base.title ?? 'Untitled',
    description,
    summary: description ? truncate(description, 280) : null,
    authorName: base.author ?? null,
    authorUrl: null,
    license: base.license ?? cfg.defaultLicense,
    remixesAllowed: cfg.defaultLicense ? true : null,
    commercialUseAllowed: cfg.commercialUseAllowed,
    tags: base.keywords.slice(0, 10),
    printSettings: printSettingsFromJsonLd(base.jsonLd),
  };
}

type Enricher = (base: OgMetadata, ctx: EnrichContext) => EnrichedFields;

const makerworld: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  f.title = f.title
    .replace(/\s*-\s*Free 3D Print Model\s*-\s*MakerWorld$/i, '')
    .replace(/\s*-\s*MakerWorld$/i, '')
    .trim();
  // Author: "designed by X" in the description, else OG author.
  const m = base.description?.match(/designed by\s+([^.]+)/i);
  if (m) f.authorName = m[1].trim();
  f.description =
    (base.description ?? '').replace(/^Download this free 3D print file designed by [^.]+\.\s*/i, '').trim() || f.title;
  f.summary = f.description ? truncate(f.description, 280) : null;
  if (f.authorName) f.authorUrl = `https://makerworld.com/en/@${f.authorName.replace(/\s+/g, '')}`;
  return f;
};

const printables: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  const t = f.title.match(/^(.+?)\s+by\s+(.+?)\s*\|/i);
  if (t) {
    f.title = t[1].trim();
    f.authorName = t[2].trim();
  } else {
    f.title = f.title.replace(/\s*\|\s*Download free STL model\s*\|\s*Printables\.com$/i, '').trim();
  }
  if (f.authorName) f.authorUrl = `https://www.printables.com/@${f.authorName}`;
  return f;
};

const thingiverse: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  const t = f.title.match(/^(.+?)\s+by\s+(.+?)(?:\s*-\s*Thingiverse)?$/i);
  if (t) {
    f.title = t[1].trim();
    f.authorName = t[2].trim();
  } else {
    f.title = f.title.replace(/\s*-\s*Thingiverse$/i, '').trim();
  }
  if (f.authorName) f.authorUrl = `https://www.thingiverse.com/${f.authorName}`;
  return f;
};

const cults3d: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  f.title = f.title.replace(/\s*[・|]\s*Cults.*$/i, '').trim();
  if (f.authorName) f.authorUrl = `https://cults3d.com/en/users/${f.authorName}`;
  return f;
};

const thangs: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  f.title = f.title.replace(/\s*[-|]\s*Thangs$/i, '').trim();
  return f;
};

const myminifactory: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  f.title = f.title.replace(/\s*[-|]\s*MyMiniFactory.*$/i, '').trim();
  return f;
};

const grabcad: Enricher = (base, ctx) => {
  const f = baseFields(base, ctx);
  // Strip GrabCAD title suffixes (rendered metadata only — static pages are an
  // unrendered shell, so `requiresRender` routes GrabCAD through the render
  // service): "… | The GrabCAD Community Library", "… | CAD Models | GrabCAD",
  // and the bare "… | GrabCAD" / "… - GrabCAD".
  f.title = f.title
    .replace(/\s*[|\-–]\s*The GrabCAD Community Library\s*$/i, '')
    .replace(/\s*[|\-–]\s*CAD Models\s*[|\-–]\s*GrabCAD\s*$/i, '')
    .replace(/\s*[|\-–]\s*GrabCAD\s*$/i, '')
    .trim();
  return f;
};

/** Generic OG-only fallback for `source_site: 'other'`. */
const generic: Enricher = (base, ctx) => baseFields(base, ctx);

export const ENRICHERS: Record<ExternalSourceSite, Enricher> = {
  makerworld,
  printables,
  thingiverse,
  cults3d,
  thangs,
  myminifactory,
  grabcad,
  other: generic,
};

export function enrich(base: OgMetadata, ctx: EnrichContext): EnrichedFields {
  return (ENRICHERS[ctx.site] ?? generic)(base, ctx);
}

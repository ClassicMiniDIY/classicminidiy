/**
 * Source-site registry for the External 3D Model Listings feature
 * ("Around the Web"). Shared by the client (badge + branded outbound button)
 * AND the server scraper (detection + id extraction). This is the single
 * source of truth for which sites we support, their brand colors, and the URL
 * shapes we recognize.
 *
 * Font Awesome 6 (this project's only icon set) has no per-site logos, so brand
 * identity is conveyed by `brandColor` + `label`. Optionally drop a small SVG at
 * `public/brands/{id}.svg` and reference it via `logo`.
 *
 * Data contract: `classicminidiy-supabase/docs/plans/2026-06-15-external-model-listings.md`.
 */

export type ExternalSourceSite =
  | 'thingiverse'
  | 'printables'
  | 'makerworld'
  | 'cults3d'
  | 'thangs'
  | 'myminifactory'
  | 'grabcad'
  | 'other';

export interface ExternalSourceConfig {
  id: ExternalSourceSite;
  /** Human label shown on the badge + button ("View on {label}"). */
  label: string;
  /** Brand background color for the outbound button + badge tint (hex). */
  brandColor: string;
  /** Readable text color on top of `brandColor` (hex). */
  textColor: string;
  /** Hostnames (sans scheme) used for detection. */
  hostnames: string[];
  /** Canonical model-URL pattern; first capture group is the external id. */
  urlPattern: RegExp | null;
  /** Default SPDX-ish license string when the page doesn't expose one. */
  defaultLicense: string | null;
  /** Whether the default license permits commercial use. */
  commercialUseAllowed: boolean | null;
  /**
   * Skip the self-hosted direct fetch and go straight to the render service.
   * For client-rendered SPAs (e.g. GrabCAD's AngularJS pages) the static HTML
   * carries no usable OG/JSON-LD — only an unrendered template shell — so the
   * direct parse would otherwise "succeed" with generic junk and never fall
   * back. See `server/utils/external-models/index.ts`.
   */
  requiresRender?: boolean;
  /** Optional brand logo at `/public/brands/{id}.svg`. */
  logo?: string;
}

// NOTE: brand hexes for thingiverse/printables/makerworld/cults3d are ported
// from the OpenECUAlliance implementation. thangs/myminifactory/other are
// reasonable defaults — verify against current brand guidelines before launch.
export const EXTERNAL_SOURCES: Record<ExternalSourceSite, ExternalSourceConfig> = {
  thingiverse: {
    id: 'thingiverse',
    label: 'Thingiverse',
    brandColor: '#248BFB',
    textColor: '#FFFFFF',
    hostnames: ['thingiverse.com', 'www.thingiverse.com'],
    urlPattern: /thingiverse\.com\/thing:(\d+)/i,
    defaultLicense: 'CC-BY-SA',
    commercialUseAllowed: true,
  },
  printables: {
    id: 'printables',
    label: 'Printables',
    brandColor: '#FA6831',
    textColor: '#FFFFFF',
    hostnames: ['printables.com', 'www.printables.com'],
    urlPattern: /printables\.com\/(?:[a-z]{2}\/)?model\/(\d+)/i,
    defaultLicense: 'CC-BY-NC-SA',
    commercialUseAllowed: false,
  },
  makerworld: {
    id: 'makerworld',
    label: 'MakerWorld',
    brandColor: '#00AE42',
    textColor: '#FFFFFF',
    hostnames: ['makerworld.com', 'www.makerworld.com'],
    urlPattern: /makerworld\.com\/(?:[a-z]{2}\/)?models?\/(\d+)/i,
    defaultLicense: 'CC-BY-NC-SA',
    commercialUseAllowed: false,
  },
  cults3d: {
    id: 'cults3d',
    label: 'Cults3D',
    brandColor: '#1A1A1A',
    textColor: '#FFFFFF',
    hostnames: ['cults3d.com', 'www.cults3d.com'],
    // Cults3D model URLs are /[lang]/3d-model/{category}/{slug}; capture the final slug.
    urlPattern: /cults3d\.com\/(?:[a-z]{2}\/)?3d-model\/(?:[\w-]+\/)?([\w-]+)/i,
    defaultLicense: 'CC-BY-NC',
    commercialUseAllowed: false,
  },
  thangs: {
    id: 'thangs',
    label: 'Thangs',
    brandColor: '#7C3AED',
    textColor: '#FFFFFF',
    hostnames: ['thangs.com', 'www.thangs.com'],
    urlPattern: /thangs\.com\/.*?-(\d+)(?:[/?#]|$)/i,
    defaultLicense: null,
    commercialUseAllowed: null,
  },
  myminifactory: {
    id: 'myminifactory',
    label: 'MyMiniFactory',
    brandColor: '#E4002B',
    textColor: '#FFFFFF',
    hostnames: ['myminifactory.com', 'www.myminifactory.com'],
    urlPattern: /myminifactory\.com\/object\/[\w-]*?(\d+)(?:[/?#]|$)/i,
    defaultLicense: null,
    commercialUseAllowed: null,
  },
  grabcad: {
    id: 'grabcad',
    label: 'GrabCAD',
    // GrabCAD (a Stratasys brand) teal. Verify against current brand guidelines.
    brandColor: '#00B2A9',
    textColor: '#FFFFFF',
    hostnames: ['grabcad.com', 'www.grabcad.com'],
    // Model pages are /library/{slug}; capture the slug. Profile pages
    // (/{user}/models) intentionally don't match → no external id.
    urlPattern: /grabcad\.com\/library\/([\w-]+)/i,
    // GrabCAD models carry the GrabCAD Terms, not a standard CC license; leave
    // unknown rather than asserting a permissive default.
    defaultLicense: null,
    commercialUseAllowed: null,
    // AngularJS SPA — static HTML has no real OG/JSON-LD. Force the render path.
    requiresRender: true,
  },
  other: {
    id: 'other',
    label: 'External',
    brandColor: '#475569',
    textColor: '#FFFFFF',
    hostnames: [],
    urlPattern: null,
    defaultLicense: null,
    commercialUseAllowed: null,
  },
};

/** Ordered list of the real (non-`other`) sources for UI hints. */
export const SUPPORTED_SOURCE_SITES: ExternalSourceSite[] = [
  'thingiverse',
  'printables',
  'makerworld',
  'cults3d',
  'thangs',
  'myminifactory',
  'grabcad',
];

export function sourceConfig(site: ExternalSourceSite | string | null | undefined): ExternalSourceConfig {
  if (site && site in EXTERNAL_SOURCES) return EXTERNAL_SOURCES[site as ExternalSourceSite];
  return EXTERNAL_SOURCES.other;
}

/** Lowercased registrable hostname, or null for a non-URL. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Map a URL to a known source site by hostname. Returns `'other'` for any
 * valid http(s) URL we don't have a dedicated parser for, and `null` for a
 * value that isn't a usable URL at all.
 */
export function detectSourceSite(url: string): ExternalSourceSite | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const site of SUPPORTED_SOURCE_SITES) {
    if (EXTERNAL_SOURCES[site].hostnames.some((h) => host === h || host.endsWith(`.${h}`))) {
      return site;
    }
  }
  return 'other';
}

/** True for any parseable http(s) URL (supported site or not). */
export function isValidExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Extract the source-platform id from a URL, if the site exposes one. */
export function extractExternalId(url: string, site?: ExternalSourceSite | null): string | null {
  const resolved = site ?? detectSourceSite(url);
  if (!resolved) return null;
  const pattern = EXTERNAL_SOURCES[resolved].urlPattern;
  if (!pattern) return null;
  return url.match(pattern)?.[1] ?? null;
}

/**
 * Canonicalize a URL for dedupe + storage: strip tracking params + hash,
 * lowercase the host, drop a trailing slash. Returns the input unchanged if it
 * can't be parsed.
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
];

export function normalizeExternalUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    let out = u.toString();
    // Drop a single trailing slash on the path (not on bare-origin URLs).
    if (out.endsWith('/') && new URL(out).pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return url;
  }
}

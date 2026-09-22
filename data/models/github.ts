export interface IGithubReleaseParsedResponse {
  latestRelease: string | null;
  releases: ReleaseItem[];
}

export interface GithubRawResponseRelease {
  data: ReleaseItem[];
}
export interface ReleaseItem {
  url: string | null;
  assets_url: string | null;
  upload_url: string | null;
  html_url: string | null;
  id: number | null;
  author: any;
  node_id: string | null;
  tag_name: string | null;
  target_commitish: string | null;
  name: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string | null;
  published_at: string | null;
  assets: any;
  tarball_url: string | null;
  zipball_url: string | null;
  body?: string | null | undefined;
}

/**
 * The public ECU maps repo (local checkout: ~/Development/BadWolfTurboMap).
 * It moved from SomethingNew71 to ClassicMiniDIY and from `master` to `main` —
 * GitHub redirects the old URLs today, but only until a repo takes the old name.
 */
const ECU_MAPS_OWNER = 'ClassicMiniDIY';
const ECU_MAPS_NAME = 'MiniECUMaps';
const ECU_MAPS_BRANCH = 'main';

export const ECU_MAPS_REPO = {
  owner: ECU_MAPS_OWNER,
  repo: ECU_MAPS_NAME,
  url: `https://github.com/${ECU_MAPS_OWNER}/${ECU_MAPS_NAME}`,
  zipUrl: `https://github.com/${ECU_MAPS_OWNER}/${ECU_MAPS_NAME}/archive/refs/heads/${ECU_MAPS_BRANCH}.zip`,
  manifestUrl: `https://raw.githubusercontent.com/${ECU_MAPS_OWNER}/${ECU_MAPS_NAME}/${ECU_MAPS_BRANCH}/maps.json`,
} as const;

/**
 * Success-only cache headers for the /api/github/* routes. Set them after the upstream
 * call succeeds, never before: Nitro adds no-cache to an error response only when no
 * cache-control header exists, so headers set up front make a 502/504 cacheable too.
 */
export const GITHUB_ROUTE_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=1800, s-maxage=1800',
  'CDN-Cache-Control': 'public, max-age=1800',
} as const;

/** Trimmed commit shape returned by /api/github/commits. */
export interface EcuMapsCommit {
  sha: string;
  /** Subject line only. */
  message: string;
  /** ISO timestamp, for sorting. */
  committedAt: string | null;
  /** 'LLL dd' display date, or 'Missing'. */
  date: string;
}

/**
 * maps.json in the ECU maps repo — contract in that repo's
 * docs/plans/2026-09-22-maps-manifest.md. Only the fields the site reads are typed.
 * Statuses are 'included' | 'started' | 'wip' | 'not-included' | 'na' today, but typed as
 * string: the manifest is external data and MapsStatusIcon renders unknown values.
 */
export interface EcuMapsManifest {
  updated: string;
  features: { id: string; label: string }[];
  platforms: { id: string; name: string; features: Record<string, string> }[];
}

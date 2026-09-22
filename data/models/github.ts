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
export const ECU_MAPS_REPO = {
  owner: 'ClassicMiniDIY',
  repo: 'MiniECUMaps',
  branch: 'main',
  url: 'https://github.com/ClassicMiniDIY/MiniECUMaps',
  zipUrl: 'https://github.com/ClassicMiniDIY/MiniECUMaps/archive/refs/heads/main.zip',
  manifestUrl: 'https://raw.githubusercontent.com/ClassicMiniDIY/MiniECUMaps/main/maps.json',
} as const;

/** Trimmed commit shape returned by /api/github/commits. */
export interface EcuMapsCommit {
  sha: string;
  message: string;
  /** ISO timestamp, for sorting. */
  committedAt: string | null;
  /** 'LLL dd' display date, or 'Missing'. */
  date: string;
}

/**
 * maps.json in the ECU maps repo — contract in that repo's
 * docs/plans/2026-09-22-maps-manifest.md. Only the fields the site reads are typed.
 */
export type EcuMapsFeatureStatus = 'included' | 'started' | 'wip' | 'not-included' | 'na';

export interface EcuMapsManifest {
  updated: string;
  features: { id: string; label: string }[];
  platforms: { id: string; name: string; features: Record<string, EcuMapsFeatureStatus | string> }[];
}

/**
 * Knowledgebase pages that carry a "Discuss this on the community" link.
 * Design: docs/plans/2026-10-05-community-discuss-links.md.
 *
 * This list is a security boundary. GET /api/community/discuss creates a forum
 * topic only for a key in this list, and takes the title and the page URL from
 * here, never from the request. Add a page by adding an entry; the component
 * shows the link on exactly these paths.
 *
 * Titles are English (the forum language), at least 15 characters
 * (Discourse `min_topic_title_length`), and unique on the forum
 * (`allow_duplicate_topic_titles` is off).
 */

export interface CommunityDiscussPage {
  /** Site path, no trailing slash, lowercase. */
  path: string;
  /** Forum topic title. */
  title: string;
}

export const COMMUNITY_DISCUSS_PAGES = {
  'technical-torque': { path: '/technical/torque', title: 'Classic Mini torque specifications' },
  'technical-clearance': { path: '/technical/clearance', title: 'Classic Mini common clearances' },
  'technical-compression': { path: '/technical/compression', title: 'Compression ratio calculator' },
  'technical-gearing': { path: '/technical/gearing', title: 'Gearbox and gearing calculator' },
  'technical-needles': { path: '/technical/needles', title: 'SU carburettor needles chart' },
  'technical-alignment': { path: '/technical/alignment', title: 'Wheel alignment calculator' },
  'technical-chassis-decoder': { path: '/technical/chassis-decoder', title: 'VIN and chassis plate decoder' },
  'technical-engine-decoder': { path: '/technical/engine-decoder', title: 'Engine plate decoder' },
  'technical-parts': { path: '/technical/parts', title: 'Parts equivalency list' },
  'archive-electrical': { path: '/archive/electrical', title: 'Classic Mini wiring diagrams' },
  'archive-engines': { path: '/archive/engines', title: 'A-series engine sizes and specifications' },
  'archive-weights': { path: '/archive/weights', title: 'Classic Mini weights and measurements' },
  'archive-suppliers': { path: '/archive/suppliers', title: 'Classic Mini parts suppliers' },
  'archive-colors': { path: '/archive/colors', title: 'Classic Mini paint codes and colours' },
  'archive-wheels': { path: '/archive/wheels', title: 'Classic Mini wheels archive' },
  'archive-registry': { path: '/archive/registry', title: 'The Classic Mini registry' },
  'archive-documents': { path: '/archive/documents', title: 'Manuals, catalogues and documents archive' },
  'archive-variants': { path: '/archive/variants', title: 'Classic Mini model variants' },
  'archive-parts': { path: '/archive/parts', title: 'Classic Mini part numbers database' },
} as const satisfies Record<string, CommunityDiscussPage>;

export type CommunityDiscussKey = keyof typeof COMMUNITY_DISCUSS_PAGES;

/** The page entry for a key from a request, or null. Own keys only. */
export function communityDiscussPage(key: unknown): CommunityDiscussPage | null {
  if (typeof key !== 'string' || !Object.hasOwn(COMMUNITY_DISCUSS_PAGES, key)) return null;
  return COMMUNITY_DISCUSS_PAGES[key as CommunityDiscussKey];
}

/** The key for a route path (trailing slash and case ignored), or null. */
export function communityDiscussKeyForPath(path: string): CommunityDiscussKey | null {
  const normalized = path.toLowerCase().replace(/\/+$/, '');
  for (const [key, page] of Object.entries(COMMUNITY_DISCUSS_PAGES)) {
    if (page.path === normalized) return key as CommunityDiscussKey;
  }
  return null;
}

/**
 * The forum topic's `external_id`: `[\w-]+`, at most 50 characters, unique on
 * the forum. Never change it for an existing key, or the page gets a second topic.
 */
export function communityDiscussExternalId(key: CommunityDiscussKey): string {
  return `cmdiy-${key}`;
}

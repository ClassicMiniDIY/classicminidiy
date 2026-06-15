/**
 * DTOs for the External 3D Model Listings feature ("Around the Web").
 *
 * External listings are community-submitted LINKS to models hosted on other
 * sites. They render in the same browse grid as first-party models (carrying a
 * source-site badge) but are stored in a separate `external_models` table and
 * never mix with first-party analytics. See the first-party shapes in
 * `model-library.ts` and the data contract in
 * `classicminidiy-supabase/docs/plans/2026-06-15-external-model-listings.md`.
 */

import type { ModelCard, PrintSettings } from './model-library';
import type { ExternalSourceSite } from './external-sources';

/** Card shape for an external listing in the browse grid. */
export interface ExternalModelCard {
  kind: 'external';
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  categorySlug: string;
  sourceSite: ExternalSourceSite;
  sourceUrl: string;
  sourceAuthorName: string | null;
  likeCount: number;
  clickCount: number;
  isFeatured: boolean;
  primaryImage: string | null;
  createdAt: string;
  publishedAt: string | null;
}

/**
 * Unified browse-card type. The grid switches rendering on `kind`. First-party
 * cards are tagged `kind: 'first_party'` (added to `ModelCard`); external cards
 * are `kind: 'external'`.
 */
export type BrowseCard = ModelCard | ExternalModelCard;

export function isExternalCard(card: BrowseCard): card is ExternalModelCard {
  return card.kind === 'external';
}

/** Full detail payload for /models/external/[slug]. */
export interface ExternalModelDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  categorySlug: string;
  tags: string[];
  sourceSite: ExternalSourceSite;
  sourceUrl: string;
  sourceExternalId: string | null;
  sourceAuthorName: string | null;
  sourceAuthorUrl: string | null;
  /** License string AS REPORTED BY THE SOURCE — display-only, never our license. */
  sourceLicense: string | null;
  remixesAllowed: boolean | null;
  commercialUseAllowed: boolean | null;
  printSettings: PrintSettings | null;
  likeCount: number;
  clickCount: number;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
}

/** Status a submitter sees for their own external submission in the dashboard. */
export interface ExternalModelSubmission {
  id: string;
  slug: string;
  title: string;
  sourceSite: ExternalSourceSite;
  sourceUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  rejectionReason: string | null;
  primaryImage: string | null;
  createdAt: string;
}

/** Shape returned by the scrape-preview endpoint, shown before submit. */
export interface ExternalModelPreview {
  sourceSite: ExternalSourceSite;
  sourceUrl: string;
  externalId: string | null;
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
  images: { url: string; isPrimary: boolean }[];
  /** True when this source_url is already in our DB (dedupe hint for the form). */
  alreadyListed?: { slug: string } | null;
}

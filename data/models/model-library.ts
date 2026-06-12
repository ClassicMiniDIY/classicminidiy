/**
 * Shared types + helpers for the 3D Model Library browse/detail surfaces
 * (keystone `2026-06-11-3d-model-library.md`). The JSONB shapes (print settings,
 * hardware BOM, assembly) are ported from OpenECUAlliance `app/types/model.ts`
 * per keystone §4 so the display components and the upload wizard agree.
 */

// --- Version JSONB shapes (frozen per published version) --------------------

export interface PrintSettings {
  recommendedMaterial?: string;
  alternativeMaterials?: string[];
  notRecommendedMaterials?: string[];
  layerHeight?: number;
  infillPercent?: number;
  infillPattern?: string;
  wallCount?: number;
  supportsRequired?: boolean;
  supportType?: 'normal' | 'tree' | 'organic' | 'none';
  orientation?: string;
  bedAdhesion?: 'none' | 'brim' | 'raft' | 'skirt';
  estimatedTimeHours?: number;
  estimatedFilamentGrams?: number;
  nozzleSize?: number;
  bedTempCelsius?: number;
  hotendTempCelsius?: number;
  notes?: string;
}

export interface HardwareItem {
  item: string;
  quantity: number;
  optional?: boolean;
  notes?: string;
  purchaseUrl?: string;
}

export interface AssemblyInstructions {
  difficulty?: 'easy' | 'moderate' | 'advanced';
  estimatedTimeMinutes?: number;
  toolsRequired?: string[];
  steps?: string[];
  warnings?: string[];
}

// --- API DTOs ---------------------------------------------------------------

export type PricingMode = 'free' | 'tips' | 'pwyw' | 'fixed';

export interface ModelAuthor {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** License with the derived flags the badge renders. */
export interface ModelLicenseInfo {
  code: string;
  name: string;
  url: string | null;
  isPaid: boolean;
  allowsCommercialUse: boolean;
  allowsDerivatives: boolean;
  requiresAttribution: boolean;
  requiresShareAlike: boolean;
  allowsFileRedistribution: boolean;
}

export interface ModelImageInfo {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

export interface ModelFileInfo {
  id: string;
  fileName: string;
  fileExt: string;
  kind: string;
  sizeBytes: number;
  isRenderable: boolean;
}

/** Card shape for the browse grid. */
export interface ModelCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  categorySlug: string;
  pricingMode: PricingMode;
  priceCents: number | null;
  minPriceCents: number | null;
  currency: string;
  licenseCode: string;
  likeCount: number;
  commentCount: number;
  downloadCount: number;
  safetyCritical: boolean;
  isFeatured: boolean;
  primaryImage: string | null;
  author: ModelAuthor | null;
  createdAt: string;
}

/** Full detail payload for /models/[slug]. */
export interface ModelDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  categorySlug: string;
  tags: string[];
  pricingMode: PricingMode;
  priceCents: number | null;
  suggestedPriceCents: number | null;
  minPriceCents: number | null;
  currency: string;
  safetyCritical: boolean;
  sourceUrl: string | null;
  likeCount: number;
  commentCount: number;
  downloadCount: number;
  versionCount: number;
  createdAt: string;
  author: ModelAuthor | null;
  license: ModelLicenseInfo;
  version: {
    id: string;
    versionNumber: number;
    label: string;
    changelog: string | null;
    publishedAt: string | null;
    printSettings: PrintSettings | null;
    hardwareBom: HardwareItem[];
    assembly: AssemblyInstructions | null;
  } | null;
  files: ModelFileInfo[];
  images: ModelImageInfo[];
}

// --- Shared display helpers -------------------------------------------------

export const MODEL_VIEWER_MAX_BYTES = 50 * 1024 * 1024; // 50 MB (keystone PR 6)
export const VIEWER_EXTS = new Set(['stl', '3mf', 'obj']);

/**
 * Allowed upload extensions (lowercase) — client-side mirror of the server
 * `MODEL_FILE_EXTS` / DB `file_ext` constraint (keystone §4). Used by the upload
 * wizard for pre-flight validation; the server + DB stay the hard gate.
 */
export const MODEL_FILE_EXTS = [
  'stl',
  '3mf',
  'obj',
  'step',
  'stp',
  'iges',
  'igs',
  'f3d',
  'f3z',
  'scad',
  'dxf',
  'pdf',
] as const;

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Human price label for a card/detail given pricing mode + cents. */
export function priceLabel(model: {
  pricingMode: PricingMode;
  priceCents: number | null;
  minPriceCents: number | null;
  currency: string;
}): string {
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: (model.currency || 'usd').toUpperCase() }).format(
      cents / 100
    );
  switch (model.pricingMode) {
    case 'free':
      return 'Free';
    case 'tips':
      return 'Free · tips welcome';
    case 'pwyw':
      return model.minPriceCents ? `Pay what you want · from ${fmt(model.minPriceCents)}` : 'Pay what you want';
    case 'fixed':
      return model.priceCents != null ? fmt(model.priceCents) : 'Paid';
    default:
      return '';
  }
}

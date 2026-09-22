import type { ModelVariant, ModelVariantCard } from '~~/data/models/variants';

export interface ModelVariantFacets {
  marques: { value: string; count: number }[];
  families: { value: string; count: number }[];
  bodies: { value: string; count: number }[];
  markets: { value: string; count: number }[];
  marks: { value: number; count: number }[];
  engines: { value: number; count: number }[];
  total: number;
}

export interface ModelVariantListResponse {
  variants: ModelVariantCard[];
  facets: ModelVariantFacets;
  total: number;
}

export interface ModelVariantDetailResponse {
  variant: ModelVariant;
  related: ModelVariantCard[];
}

/**
 * Read side of the Model Variants archive for the pages. Thin on purpose: the
 * server route owns filtering and the move from the bundled seed to Supabase
 * (design doc §7, Phase 1) happens behind `/api/archive/variants` without the
 * pages noticing.
 */
export const useModelVariants = () => {
  const listVariants = () =>
    useFetch<ModelVariantListResponse>('/api/archive/variants', {
      key: 'archive-variants-list',
      default: () => ({
        variants: [],
        facets: { marques: [], families: [], bodies: [], markets: [], marks: [], engines: [], total: 0 },
        total: 0,
      }),
    });

  const getVariant = (slug: string) =>
    useFetch<ModelVariantDetailResponse>(`/api/archive/variants/${encodeURIComponent(slug)}`, {
      key: `archive-variant-${slug}`,
    });

  return { listVariants, getVariant };
};

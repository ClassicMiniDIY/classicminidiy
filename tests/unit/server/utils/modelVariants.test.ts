import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/utils/supabase', () => ({ getServiceClient: vi.fn() }));

import seedRows from '../../../../docs/plans/data/2026-09-22-model-variants-seed.json';
import {
  filterModelVariants,
  mapModelVariantRow,
  modelVariantFacets,
  relatedModelVariants,
  toModelVariantCard,
} from '../../../../server/utils/modelVariants';
import {
  countSourcedSpecs,
  matchesEveryWord,
  SPEC_ROW_COUNT,
  variantSearchWords,
  type ModelVariant,
  type ModelVariantSeedRow,
} from '../../../../data/models/variants';

/** The seed as the database serves it: what the migration inserted, through the real row mapper. */
const rows: ModelVariant[] = (seedRows as unknown as ModelVariantSeedRow[]).map((r) =>
  mapModelVariantRow({
    ...r,
    id: `id-${r.slug}`,
    status: 'approved',
    updated_at: '2026-09-22T00:00:00Z',
    model_variant_colors: r.colors.map((name, i) => ({ color_name: name, color_id: null, sort_order: i })),
    model_variant_photos: [],
  })
);
const list = (filters = {}) => filterModelVariants(rows, filters);

describe('modelVariants read side', () => {
  it('maps a PostgREST row, keeping only approved photos, primary first', () => {
    const v = mapModelVariantRow({
      ...(seedRows as any)[0],
      id: 'x',
      compression_ratio: '9.75',
      model_variant_colors: [
        { color_name: 'B', color_id: null, sort_order: 1 },
        { color_name: 'A', color_id: 'c1', sort_order: 0 },
      ],
      model_variant_photos: [
        { url: 'u2', kind: 'owner', is_primary: false, sort_order: 0, status: 'approved' },
        { url: 'u1', kind: 'brochure', is_primary: true, sort_order: 5, status: 'approved' },
        { url: 'u3', kind: 'owner', is_primary: false, sort_order: 1, status: 'pending' },
      ],
    });
    expect(v.compression_ratio).toBe(9.75);
    expect(v.colors).toEqual([
      { name: 'A', color_id: 'c1' },
      { name: 'B', color_id: null },
    ]);
    expect(v.photos.map((p) => p.url)).toEqual(['u1', 'u2']);
    expect(toModelVariantCard(v).photo_url).toBe('u1');
  });

  it('matches every query word by prefix, never by substring', () => {
    const hay = ['austin', 'morris', 'mini', 'cooper', 's', '1275', 'mk1'];
    expect(matchesEveryWord(hay, 'cooper s')).toBe(true);
    expect(matchesEveryWord(hay, 'coop 12')).toBe(true);
    expect(matchesEveryWord(hay, 'per')).toBe(false);
    expect(matchesEveryWord(hay, 'cooper clubman')).toBe(false);
    expect(matchesEveryWord(hay, '')).toBe(true);
  });

  it('narrows with each filter and sorts mark → year → name', () => {
    const coopers = list({ query: 'cooper s' });
    expect(coopers.length).toBeGreaterThan(0);
    expect(coopers.every((v) => /cooper/i.test(v.name))).toBe(true);
    expect(list({ mark: 1 }).every((v) => v.mark === 1)).toBe(true);
    expect(list({ market: 'italy' }).every((v) => v.marque === 'innocenti')).toBe(true);

    const sorted = list();
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i - 1]!.mark ?? 99).toBeLessThanOrEqual(sorted[i]!.mark ?? 99);
    }
    const firstNull = sorted.findIndex((v) => v.mark === null);
    expect(sorted.slice(firstNull).every((v) => v.mark === null)).toBe(true);
  });

  it('filters by a colours-archive id', () => {
    const withLink = rows.map((v, i) => (i === 0 ? { ...v, colors: [{ name: 'Tartan Red', color_id: 'red-id' }] } : v));
    expect(filterModelVariants(withLink, { colorId: 'red-id' }).map((v) => v.slug)).toEqual([rows[0]!.slug]);
  });

  it('treats a missing end year as open-ended', () => {
    const openEnded = rows.find((v) => v.year_start && v.year_end === null)!;
    expect(list({ year: openEnded.year_start! + 1 }).some((v) => v.slug === openEnded.slug)).toBe(true);
  });

  it('ranks identically on the server and over cards (index page parity)', () => {
    const cards = rows.map(toModelVariantCard);
    for (const q of ['italy', 'spain', 'twin', 'le', 'cooper s', 'mk3 van', 'clubman 1100', 'sprite', 'x']) {
      const server = list({ query: q })
        .map((v) => v.slug)
        .sort();
      const client = cards
        .filter((c) => matchesEveryWord(variantSearchWords(c), q))
        .map((c) => c.slug)
        .sort();
      expect(client, q).toEqual(server);
    }
  });

  it('relates by family first, then by mark, never itself', () => {
    const [first] = list({ query: 'cooper s 1275', mark: 1 });
    const related = relatedModelVariants(rows, first!, 6);
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(6);
    expect(related.some((r) => r.slug === first!.slug)).toBe(false);
    expect(related[0]!.family).toBe(first!.family);
  });

  it('builds cards with the sourced-spec count', () => {
    const v = rows[0]!;
    expect(toModelVariantCard(v).spec_count).toBe(countSourcedSpecs(v));
    expect(toModelVariantCard(v).spec_count).toBeLessThanOrEqual(SPEC_ROW_COUNT);
  });

  it('reports facets that add up to the archive', () => {
    const f = modelVariantFacets(rows);
    const sum = (r: { count: number }[]) => r.reduce((n, x) => n + x.count, 0);
    expect(sum(f.marques)).toBe(f.total);
    expect(sum(f.bodies)).toBe(f.total);
  });
});

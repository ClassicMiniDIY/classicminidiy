import { describe, expect, it } from 'vitest';
import {
  allModelVariants,
  getModelVariant,
  listModelVariants,
  matchesEveryWord,
  modelVariantFacets,
  relatedModelVariants,
  toCard,
} from '../../../../server/utils/modelVariants';
import { countSourcedSpecs, SPEC_ROW_COUNT } from '../../../../data/models/variants';

describe('modelVariants read side', () => {
  it('serves the whole seed and finds a row by slug', () => {
    const all = allModelVariants();
    expect(all.length).toBeGreaterThan(100);
    const first = all[0]!;
    expect(getModelVariant(first.slug)?.name).toBe(first.name);
    expect(getModelVariant('no-such-variant')).toBeNull();
  });

  it('matches every query word by prefix, never by substring', () => {
    const hay = ['austin', 'morris', 'mini', 'cooper', 's', '1275', 'mk1'];
    expect(matchesEveryWord(hay, 'cooper s')).toBe(true);
    expect(matchesEveryWord(hay, 'coop 12')).toBe(true);
    // "per" is inside "cooper" but is not a word prefix.
    expect(matchesEveryWord(hay, 'per')).toBe(false);
    // One unmatched word fails the whole query (AND semantics).
    expect(matchesEveryWord(hay, 'cooper clubman')).toBe(false);
    expect(matchesEveryWord(hay, '')).toBe(true);
  });

  it('narrows with each filter and sorts mark → year → name', () => {
    const coopers = listModelVariants({ query: 'cooper s' });
    expect(coopers.length).toBeGreaterThan(0);
    expect(coopers.every((v) => /cooper/i.test(v.name))).toBe(true);

    const mk1 = listModelVariants({ mark: 1 });
    expect(mk1.every((v) => v.mark === 1)).toBe(true);

    const italy = listModelVariants({ market: 'italy' });
    expect(italy.every((v) => v.marque === 'innocenti')).toBe(true);

    const in1964 = listModelVariants({ year: 1964 });
    expect(in1964.every((v) => (v.year_start ?? 0) <= 1964 && (v.year_end ?? v.year_start ?? 0) >= 1964)).toBe(true);

    const sorted = listModelVariants();
    for (let i = 1; i < sorted.length; i += 1) {
      const a = sorted[i - 1]!;
      const b = sorted[i]!;
      expect(a.mark ?? 99).toBeLessThanOrEqual(b.mark ?? 99);
    }
    // Overseas cars (no mark) sort after every UK mark.
    const firstNull = sorted.findIndex((v) => v.mark === null);
    expect(sorted.slice(firstNull).every((v) => v.mark === null)).toBe(true);
  });

  it('relates by family first, then by mark, never itself', () => {
    const [first] = listModelVariants({ query: 'cooper s 1275', mark: 1 });
    expect(first).toBeDefined();
    const related = relatedModelVariants(first!, 6);
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(6);
    expect(related.some((r) => r.slug === first!.slug)).toBe(false);
    expect(related[0]!.family).toBe(first!.family);
  });

  it('builds cards with the sourced-spec count and hosted photos only', () => {
    const v = allModelVariants()[0]!;
    const card = toCard(v);
    expect(card.spec_count).toBe(countSourcedSpecs(v));
    expect(card.spec_count).toBeLessThanOrEqual(SPEC_ROW_COUNT);
    // Wayback-only images are not hosted, so they do not count as photos yet.
    expect(card.photo_count).toBe(v.images.filter((i) => i.url).length);
  });

  it('reports facets that add up to the archive', () => {
    const f = modelVariantFacets();
    const sum = (rows: { count: number }[]) => rows.reduce((n, r) => n + r.count, 0);
    expect(sum(f.marques)).toBe(f.total);
    expect(sum(f.bodies)).toBe(f.total);
    expect(f.marks.map((m) => m.value)).toEqual([...f.marks.map((m) => m.value)].sort((a, b) => a - b));
  });
});

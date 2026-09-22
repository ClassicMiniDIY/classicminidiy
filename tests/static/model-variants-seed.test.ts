/**
 * Integrity of the Model Variants seed, `data/modelVariants.json`.
 *
 * The seed is the one-off artefact recovered from the Wayback copy of
 * austinminiwebsearch.com (design doc `docs/plans/2026-09-22-model-variants-archive.md`
 * §8). It is read by the pages, the sitemap and the `model-variants` MCP tool
 * through `server/utils/modelVariants.ts`, and it becomes the Phase 1 seed
 * migration in `classicminidiy-supabase`. These checks are the contract that
 * migration will assume: unique URL slugs, closed vocabularies, sane years,
 * source units, and a citation on every row.
 */
import { describe, expect, it } from 'vitest';
import rows from '../../data/modelVariants.json';
import {
  KNOWN_ENGINE_CC,
  VARIANT_BODIES,
  VARIANT_FAMILIES,
  VARIANT_FUEL_SYSTEMS,
  VARIANT_MARKETS,
  VARIANT_MARQUES,
  type ModelVariant,
} from '../../data/models/variants';

const seed = rows as unknown as ModelVariant[];

describe('data/modelVariants.json', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = seed.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('uses only the closed vocabularies', () => {
    for (const v of seed) {
      expect(VARIANT_MARQUES).toContain(v.marque);
      expect(VARIANT_FAMILIES).toContain(v.family);
      expect(VARIANT_BODIES).toContain(v.body_style);
      expect(VARIANT_MARKETS).toContain(v.market);
      if (v.fuel_system !== null) expect(VARIANT_FUEL_SYSTEMS).toContain(v.fuel_system);
      if (v.mark !== null) expect(v.mark).toBeGreaterThanOrEqual(1);
      if (v.mark !== null) expect(v.mark).toBeLessThanOrEqual(7);
    }
  });

  it('keeps years inside the production era and ordered', () => {
    for (const v of seed) {
      if (v.year_start !== null) {
        expect(v.year_start).toBeGreaterThanOrEqual(1959);
        expect(v.year_start).toBeLessThanOrEqual(2000);
      }
      if (v.year_end !== null) {
        expect(v.year_start).not.toBeNull();
        expect(v.year_end).toBeGreaterThanOrEqual(v.year_start!);
        expect(v.year_end).toBeLessThanOrEqual(2000);
      }
    }
  });

  it('stores source units, with metric never persisted', () => {
    for (const v of seed) {
      for (const key of ['power_ps', 'power_kw', 'torque_nm', 'kerb_weight_lb', 'top_speed_kmh']) {
        expect(v).not.toHaveProperty(key);
      }
      if (v.power_bhp !== null) expect(v.power_bhp).toBeGreaterThan(0);
      if (v.torque_lbft !== null) expect(v.torque_lbft).toBeGreaterThan(0);
      if (v.kerb_weight_kg !== null) expect(v.kerb_weight_kg).toBeGreaterThan(300);
      if (v.top_speed_mph !== null) expect(v.top_speed_mph).toBeLessThan(140);
      if (v.compression_ratio !== null) expect(v.compression_ratio).toBeGreaterThan(6);
      if (v.engine_cc !== null && !(KNOWN_ENGINE_CC as readonly number[]).includes(v.engine_cc)) {
        // Unusual capacities are allowed but must be flagged for the reviewer.
        expect(v.engine_note ?? v.notes).toBeTruthy();
      }
    }
  });

  it('cites a source and a legacy submitter on every row', () => {
    for (const v of seed) {
      expect(v.sources.length).toBeGreaterThan(0);
      expect(v.sources[0]!.url).toMatch(/^https:\/\/web\.archive\.org\//);
      expect(v.legacy_submitted_by).toBe('austinminiwebsearch.com');
      expect(v.production_total === null || v.production_total >= 1).toBe(true);
      // Photo references either carry a Wayback capture or are marked lost.
      for (const im of v.images) {
        if (im.archived) expect(im.wayback_url).toMatch(/^https:\/\/web\.archive\.org\/web\/\d+\//);
        else expect(im.wayback_url).toBeUndefined();
      }
    }
  });
});

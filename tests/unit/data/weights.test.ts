// @vitest-environment node
import { describe, it, expect } from 'vitest';
import weights from '~/data/weights.json';

const sections = Object.entries(weights as Record<string, any>);

describe('data/weights.json', () => {
  // The archive page renders `table.title` directly as a panel heading, and the
  // vehicle-weights MCP tool lets a caller filter by title. Two sections sharing
  // one title therefore means the page shows duplicate headings and the filter
  // returns unrelated rows. EngineBay and Engine were both "Electrics" until
  // 2026-08, so /archive/weights had three identical "Electrics" panels and a
  // title filter for it returned 196 items instead of 15.
  it('gives every section a unique title', () => {
    const titles = sections.map(([, s]) => s.title);
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(duplicates).toEqual([]);
  });

  it('gives every section a non-empty title and an items array', () => {
    for (const [key, section] of sections) {
      expect(typeof section.title, `${key}.title`).toBe('string');
      expect(section.title.length, `${key}.title`).toBeGreaterThan(0);
      expect(Array.isArray(section.items), `${key}.items`).toBe(true);
    }
  });

  it('keeps the sections whose titles were corrected', () => {
    const byKey = Object.fromEntries(sections);
    expect(byKey.Electrics.title).toBe('Electrics');
    expect(byKey.EngineBay.title).toBe('Engine Bay');
    expect(byKey.Engine.title).toBe('Engine');
  });

  it('has every item as a name plus a numeric-or-null weight', () => {
    for (const [key, section] of sections) {
      for (const item of section.items) {
        expect(typeof item.item, `${key} item name`).toBe('string');
        expect(item.weight === null || typeof item.weight === 'number', `${key}: ${item.item}`).toBe(true);
      }
    }
  });
});

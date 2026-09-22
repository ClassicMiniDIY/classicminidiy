import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/utils/supabase', () => ({ getServiceClient: vi.fn() }));

import {
  applyVariantEdit,
  insertApprovedVariant,
  parseColourList,
  parseVariantNumber,
  parseVariantSource,
  slugifyVariant,
} from '../../../../server/utils/variantApprovals';

/** A db that fails the test if touched: every case below must be rejected before any write. */
const untouchable = new Proxy(
  {},
  {
    get() {
      throw new Error('the database must not be touched for a rejected payload');
    },
  }
);
const SOURCE = { type: 'brochure', title: 'Factory sales brochure 2224/B' };

describe('variantApprovals', () => {
  it('parses numbers, treating blank as a clear and junk as an error', () => {
    expect(parseVariantNumber('76')).toEqual({ ok: true, value: 76 });
    expect(parseVariantNumber('9,75')).toEqual({ ok: true, value: 9.75 });
    expect(parseVariantNumber('')).toEqual({ ok: true, value: null });
    expect(parseVariantNumber('76 bhp')).toEqual({ ok: false });
  });

  it('requires a typed citation and rejects non-http links', () => {
    expect(parseVariantSource(SOURCE)?.type).toBe('brochure');
    expect(parseVariantSource({ type: 'brochure', title: 'x' })).toBeNull();
    expect(parseVariantSource({ type: 'rumour', title: 'my mate said' })).toBeNull();
    expect(parseVariantSource({ ...SOURCE, url: 'javascript:alert(1)' })).toBeNull();
    expect(parseVariantSource({ ...SOURCE, url: 'https://example.com/a' })?.url).toBe('https://example.com/a');
  });

  it('splits, trims and de-duplicates colour names case-insensitively', () => {
    expect(parseColourList('Tartan Red, almond green,\nTARTAN RED ; ')).toEqual(['Tartan Red', 'almond green']);
    expect(parseColourList(42)).toEqual([]);
  });

  it('slugs a name with its mark once', () => {
    expect(slugifyVariant('Mini Cooper S 1275', 1)).toBe('mini-cooper-s-1275-mk1');
    expect(slugifyVariant('Mini 1000 Mk2', 2)).toBe('mini-1000-mk2');
    expect(slugifyVariant('Innocenti Mini Cooper 1300', null)).toBe('innocenti-mini-cooper-1300');
  });

  it('refuses edits to columns outside the allowlist', async () => {
    for (const field of ['status', 'slug', 'submitted_by', 'marque', 'mark', 'legacy_submitted_by', 'sources']) {
      const error = await applyVariantEdit(
        untouchable,
        'v1',
        { changes: { [field]: { from: 'a', to: 'b' } }, source: SOURCE },
        'u1',
        's1'
      );
      expect(error, field).toMatch(/not user-editable/);
    }
  });

  it('refuses a spec edit without a source, or with a non-number in a numeric column', async () => {
    expect(await applyVariantEdit(untouchable, 'v1', { changes: { power_bhp: { to: '75' } } }, 'u1', 's1')).toMatch(
      /source/
    );
    expect(
      await applyVariantEdit(untouchable, 'v1', { changes: { power_bhp: { to: 'lots' } }, source: SOURCE }, 'u1', 's1')
    ).toMatch(/must be a number/);
  });

  it('refuses numbers the table CHECK constraints would reject, before touching the database', async () => {
    const edit = (field: string, to: string) =>
      applyVariantEdit(untouchable, 'v1', { changes: { [field]: { to } }, source: SOURCE }, 'u1', 's1');
    expect(await edit('year_end', '1958')).toMatch(/at least 1959/);
    expect(await edit('engine_cc', '2500')).toMatch(/at most 2000/);
    expect(await edit('compression_ratio', '20')).toMatch(/at most 15/);
    expect(await edit('power_rpm', '5500.5')).toMatch(/whole number/);
    expect(await edit('kerb_weight_kg', '0')).toMatch(/greater than zero/);
  });

  it('refuses a photo addition whose URLs are not this submission’s own uploads', async () => {
    const error = await applyVariantEdit(
      untouchable,
      'v1',
      { uploadedFiles: [{ url: 'https://evil.example/x.jpg' }] },
      'u1',
      's1'
    );
    expect(error).toBe('No changes provided');
  });

  it('refuses a new variant without its classification, start year or source', async () => {
    expect(await insertApprovedVariant(untouchable, { variant: { name: 'X' }, source: SOURCE }, 'u1', 's1')).toMatch(
      /marque, family and body style/
    );
    const variant = { name: 'X', marque: 'mini', family: 'saloon', body_style: 'saloon' };
    expect(await insertApprovedVariant(untouchable, { variant }, 'u1', 's1')).toMatch(/source/);
    expect(
      await insertApprovedVariant(untouchable, { variant: { ...variant, marque: 'ford' }, source: SOURCE }, 'u1', 's1')
    ).toMatch(/marque, family and body style/);
  });
});

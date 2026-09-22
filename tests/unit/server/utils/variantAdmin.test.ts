import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/utils/supabase', () => ({ getServiceClient: vi.fn() }));
vi.mock('../../../../server/utils/modelVariants', async (orig) => ({
  ...(await orig<typeof import('../../../../server/utils/modelVariants')>()),
  invalidateModelVariants: vi.fn(),
}));

import {
  ADMIN_VARIANT_COLUMNS,
  auditVariantAction,
  literalIlike,
  validateAdminVariantChanges,
} from '../../../../server/utils/variantAdmin';
import { invalidateModelVariants } from '../../../../server/utils/modelVariants';

describe('validateAdminVariantChanges', () => {
  it('never allows moderation, identity or provenance columns', () => {
    for (const column of [
      'status',
      'slug',
      'sources',
      'submitted_by',
      'legacy_submitted_by',
      'reviewed_by',
      'specs_source',
      'id',
    ]) {
      expect(ADMIN_VARIANT_COLUMNS.has(column), column).toBe(false);
      const result = validateAdminVariantChanges({ [column]: 'x' });
      expect(result.ok, column).toBe(false);
    }
  });

  it('allows a reclassification with valid enum values only', () => {
    expect(validateAdminVariantChanges({ marque: 'innocenti', family: 'cooper', market: 'italy', mark: '' })).toEqual({
      ok: true,
      updates: { marque: 'innocenti', family: 'cooper', market: 'italy', mark: null },
    });
    expect(validateAdminVariantChanges({ marque: 'ford' })).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges({ mark: '9' })).toMatchObject({ ok: false });
  });

  it('range-checks numbers and parses booleans, lists and optional enums', () => {
    expect(validateAdminVariantChanges({ engine_cc: '2500' })).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges({ is_limited_edition: 'yes' })).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges({ fuel_system: 'diesel' })).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges({ power_standard: 'JIS' })).toMatchObject({ ok: false });
    expect(
      validateAdminVariantChanges({
        engine_cc: '998',
        is_limited_edition: true,
        fuel_system: '',
        power_standard: 'DIN',
        distinguishing: 'Sold as A\n\n  Sold as B ',
      })
    ).toEqual({
      ok: true,
      updates: {
        engine_cc: 998,
        is_limited_edition: true,
        fuel_system: null,
        power_standard: 'DIN',
        distinguishing: ['Sold as A', 'Sold as B'],
      },
    });
  });

  it('refuses to clear a name or first year, and an empty change set', () => {
    expect(validateAdminVariantChanges({ name: '' })).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges({ year_start: '' })).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges({})).toMatchObject({ ok: false });
    expect(validateAdminVariantChanges(null)).toMatchObject({ ok: false });
  });
});

describe('auditVariantAction', () => {
  it('writes the audit row, expires the cache, and reports a failed audit write', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'nope' } });
    const db = { from: vi.fn(() => ({ insert })) };
    expect(await auditVariantAction(db, 'admin-1', 'variant_edited', 'variant', 'v1', { fields: ['name'] })).toBeNull();
    expect(insert).toHaveBeenCalledWith({
      admin_id: 'admin-1',
      action: 'variant_edited',
      target_type: 'variant',
      target_id: 'v1',
      details: { fields: ['name'] },
    });
    expect(invalidateModelVariants).toHaveBeenCalled();
    expect(await auditVariantAction(db, 'admin-1', 'x', 'variant', null, {})).toMatch(/audit record failed: nope/);
  });
});

describe('literalIlike', () => {
  it('escapes PostgREST wildcards so a name matches literally', () => {
    expect(literalIlike(' 100%_Red ')).toBe('100\\%\\_Red');
  });
});

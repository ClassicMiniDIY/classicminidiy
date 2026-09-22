import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));
vi.mock('../../../../server/utils/supabase', () => ({ getServiceClient: vi.fn() }));
vi.mock('../../../../server/utils/modelVariants', async (orig) => ({
  ...(await orig<typeof import('../../../../server/utils/modelVariants')>()),
  loadModelVariants: mockLoad,
  invalidateModelVariants: vi.fn(),
}));

import seed from '../../../../docs/plans/data/2026-09-22-model-variants-seed.json';
import { mapModelVariantRow } from '../../../../server/utils/modelVariants';
import { resolveRegistryVariant } from '../../../../server/utils/variantApprovals';

const rows = (seed as any[]).map((r) =>
  mapModelVariantRow({
    ...r,
    id: `id-${r.slug}`,
    model_variant_colors: [],
    model_variant_photos: [],
    updated_at: '2026-09-23',
  })
);

describe('resolveRegistryVariant', () => {
  // Braces matter: vitest runs a function RETURNED from beforeEach as teardown,
  // and mockResolvedValue returns the mock itself.
  beforeEach(() => {
    mockLoad.mockResolvedValue(rows);
  });

  it("uses the owner's pick when it names an approved variant", async () => {
    expect(await resolveRegistryVariant({ variantSlug: 'mini-30-mk5', year: 1970, model: 'x' })).toEqual({
      variant_id: 'id-mini-30-mk5',
      variant_match: 'owner',
    });
  });

  it('falls back to a confident match, and ignores an unknown pick', async () => {
    expect(
      await resolveRegistryVariant({ variantSlug: 'no-such', year: 1989, model: 'Mini Thirty', engineSize: 998 })
    ).toEqual({ variant_id: 'id-mini-30-mk5', variant_match: 'auto' });
  });

  it('leaves an ambiguous car unlinked', async () => {
    expect(await resolveRegistryVariant({ year: 1984, model: 'Mini', trim: 'Mayfair' })).toEqual({});
  });

  it('never fails the approval when the archive is unreachable', async () => {
    mockLoad.mockRejectedValue(new Error('down'));
    expect(await resolveRegistryVariant({ year: 1989, model: 'Mini Thirty' })).toEqual({});
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, rpc, audit } = vi.hoisted(() => {
  const rpc = vi.fn();
  const audit = vi.fn(async () => null);
  const photo = { id: '11111111-1111-4111-8111-111111111111', variant_id: 'v1', url: 'u', status: 'approved' };
  const chain: any = {};
  for (const m of ['select', 'eq', 'update']) chain[m] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: photo, error: null }));
  const db = { from: vi.fn(() => chain), rpc };
  return { db, rpc, audit };
});
vi.mock('../../../../../server/utils/supabase', () => ({ getServiceClient: () => db }));
vi.mock('../../../../../server/utils/adminAuth', () => ({
  requireAdminAuth: vi.fn(async () => ({ user: { id: 'a1' } })),
}));
vi.mock('../../../../../server/utils/variantAdmin', async (orig) => ({
  ...(await orig<typeof import('../../../../../server/utils/variantAdmin')>()),
  auditVariantAction: audit,
}));

import handler from '../../../../../server/api/admin/variants/photos/[photoId].post';

const PHOTO = '11111111-1111-4111-8111-111111111111';

describe('POST /api/admin/variants/photos/:photoId primary', () => {
  beforeEach(() => {
    rpc.mockReset();
    audit.mockClear();
    (global as any).getRouterParam.mockReturnValue(PHOTO);
    (global as any).readBody.mockResolvedValue({ action: 'primary' });
  });

  it('swaps through the one-transaction RPC and audits', async () => {
    rpc.mockResolvedValue({ data: 'v1', error: null });
    await expect(handler({} as any)).resolves.toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith('set_variant_primary_photo', { p_photo_id: PHOTO });
    expect(audit).toHaveBeenCalledWith(db, 'a1', 'variant_photo_primary', 'variant_photo', PHOTO, expect.any(Object));
  });

  it('maps a hidden photo to 400 and writes no audit row', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Show the photo before making it primary' } });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(audit).not.toHaveBeenCalled();
  });

  it('maps any other database error to 500', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'serialization failure' } });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 500 });
  });
});

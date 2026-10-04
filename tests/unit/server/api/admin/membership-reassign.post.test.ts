/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/admin/membership/reassign — "Move to caller" for a TXN_CLAIMED
// case. Admin auth first; the ids are validated here; the RPC gets the
// authenticated admin's id (never one from the body) and the owner the admin
// saw; each SQLSTATE the function raises maps to its own HTTP status.
// ---------------------------------------------------------------------------

const rpc = vi.fn();
const client = { rpc };
const requireAdminAuth = vi.fn();
const readBody = vi.fn();

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});
vi.stubGlobal('readBody', readBody);

vi.mock('~/server/utils/supabase', () => ({ getServiceClient: vi.fn(() => client) }));
vi.mock('~/server/utils/adminAuth', () => ({ requireAdminAuth: (...a: unknown[]) => requireAdminAuth(...a) }));

const handler = (await import('~~/server/api/admin/membership/reassign.post')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

const SUB = '00000000-0000-0000-0000-000000000001';
const CALLER = '11111111-1111-1111-1111-111111111111';
const OWNER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';

const valid = () => ({ subscriptionId: SUB, toUserId: CALLER, expectedOwnerId: OWNER });

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({
    data: [{ subscription_id: SUB, user_id: CALLER, previous_user_id: OWNER, moved: true }],
    error: null,
  });
  requireAdminAuth.mockReset().mockResolvedValue({ user: { id: ADMIN }, tokenSource: 'header' });
  readBody.mockReset().mockResolvedValue(valid());
});

describe('POST /api/admin/membership/reassign', () => {
  it('checks admin auth before reading the body or calling the RPC', async () => {
    requireAdminAuth.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(readBody).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses the cookie token path (401) before reading the body', async () => {
    requireAdminAuth.mockResolvedValue({ user: { id: ADMIN }, tokenSource: 'cookie' });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Authorization header required',
    });
    expect(readBody).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty body', null],
    ['a missing subscriptionId', { toUserId: CALLER, expectedOwnerId: OWNER }],
    ['a missing toUserId', { subscriptionId: SUB, expectedOwnerId: OWNER }],
    ['a missing expectedOwnerId', { subscriptionId: SUB, toUserId: CALLER }],
    ['a non-UUID subscriptionId', { ...valid(), subscriptionId: 'sub=unknown' }],
    ['a non-string toUserId', { ...valid(), toUserId: 42 }],
    ['the owner as the target', { ...valid(), toUserId: OWNER }],
  ])('400s on %s, without calling the RPC', async (_label, body) => {
    readBody.mockResolvedValue(body);
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls admin_reassign_subscription with the authenticated admin and the expected owner', async () => {
    readBody.mockResolvedValue({ ...valid(), adminId: 'someone-else' });
    const res = await handler(evt());
    expect(rpc).toHaveBeenCalledWith('admin_reassign_subscription', {
      p_subscription_id: SUB,
      p_new_user_id: CALLER,
      p_admin_id: ADMIN,
      p_expected_owner: OWNER,
    });
    expect(res).toEqual({ success: true, subscriptionId: SUB, userId: CALLER, moved: true });
  });

  it('reports moved: false when the row already belonged to the caller', async () => {
    rpc.mockResolvedValue({
      data: [{ subscription_id: SUB, user_id: CALLER, previous_user_id: CALLER, moved: false }],
      error: null,
    });
    await expect(handler(evt())).resolves.toEqual({ success: true, subscriptionId: SUB, userId: CALLER, moved: false });
  });

  it('maps 23505 to 409 naming the platform from the HINT', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'raised', hint: 'ghost' } });
    await expect(handler(evt())).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'That account already has a ghost membership',
    });
  });

  it('maps 23505 with an unknown HINT to 409 without echoing it', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'raised', hint: '<b>x</b>' } });
    const err: any = await handler(evt()).catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(err.statusMessage).toBe('That account already has a membership on this platform');
  });

  it.each([
    ['42501', 403],
    ['P0002', 404],
    ['55000', 409],
    ['23503', 400],
    ['22004', 400],
  ])('maps SQLSTATE %s to %i', async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: 'raised' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: status });
  });

  it('500s on any other RPC error, without echoing the database message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'internal detail' } });
    const err: any = await handler(evt()).catch((e) => e);
    expect(err.statusCode).toBe(500);
    expect(err.statusMessage).not.toContain('internal detail');
    spy.mockRestore();
  });
});

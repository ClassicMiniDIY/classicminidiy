/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// GET /api/admin/membership/claimed — open TXN_CLAIMED cases. Admin auth
// first; the RPC is asked for 90 days; at most 100 rows go back, with
// `truncated` when the RPC returned its 101st.
// ---------------------------------------------------------------------------

const rpc = vi.fn();
const client = { rpc };
const requireAdminAuth = vi.fn();

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('createError', (opts: any) => {
  const e: any = new Error(opts.statusMessage || opts.message);
  e.statusCode = opts.statusCode;
  e.statusMessage = opts.statusMessage;
  return e;
});

vi.mock('~/server/utils/supabase', () => ({ getServiceClient: vi.fn(() => client) }));
vi.mock('~/server/utils/adminAuth', () => ({ requireAdminAuth: (...a: unknown[]) => requireAdminAuth(...a) }));

const handler = (await import('~~/server/api/admin/membership/claimed.get')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

function row(i: number) {
  return {
    subscription_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    platform: 'apple',
    caller_user_id: '11111111-1111-1111-1111-111111111111',
    caller_email: 'caller@example.com',
    owner_user_id: '22222222-2222-2222-2222-222222222222',
    owner_email: 'owner@example.com',
    status: 'active',
    expires_at: '2099-01-01T00:00:00Z',
    plan: 'plus',
    attempts: 3,
    first_attempt_at: '2026-10-01T00:00:00Z',
    last_attempt_at: '2026-10-02T00:00:00Z',
    caller_entitled_now: false,
    last_reassigned_at: null,
    last_reassigned_by: null,
  };
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
  requireAdminAuth.mockReset().mockResolvedValue({ user: { id: 'admin-1' } });
});

describe('GET /api/admin/membership/claimed', () => {
  it('checks admin auth before calling the RPC', async () => {
    requireAdminAuth.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('asks admin_list_claimed_transactions for 90 days', async () => {
    await handler(evt());
    expect(rpc).toHaveBeenCalledWith('admin_list_claimed_transactions', { p_days: 90 });
  });

  it('returns the rows in the RPC order', async () => {
    rpc.mockResolvedValue({ data: [row(2), row(1)], error: null });
    const res = await handler(evt());
    expect(res.truncated).toBe(false);
    expect(res.results.map((r: any) => r.subscription_id)).toEqual([row(2).subscription_id, row(1).subscription_id]);
  });

  it('treats a null result as no cases', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(handler(evt())).resolves.toEqual({ results: [], truncated: false });
  });

  it('shows 100 and flags truncated when the RPC returns its 101st row', async () => {
    rpc.mockResolvedValue({ data: Array.from({ length: 101 }, (_, i) => row(i)), error: null });
    const res = await handler(evt());
    expect(res.results).toHaveLength(100);
    expect(res.results[99].subscription_id).toBe(row(99).subscription_id);
    expect(res.truncated).toBe(true);
  });

  it('is not truncated at exactly 100', async () => {
    rpc.mockResolvedValue({ data: Array.from({ length: 100 }, (_, i) => row(i)), error: null });
    const res = await handler(evt());
    expect(res.results).toHaveLength(100);
    expect(res.truncated).toBe(false);
  });

  it('500s on an RPC error with a generic message, and logs the database one', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
    const err: any = await handler(evt()).catch((e) => e);
    expect(err.statusCode).toBe(500);
    expect(err.statusMessage).toBe('Could not load claimed transactions');
    expect(spy).toHaveBeenCalledWith(expect.any(String), 'function not found');
    spy.mockRestore();
  });
});

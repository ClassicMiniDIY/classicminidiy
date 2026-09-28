/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/admin/membership/find {q} — support lookup (membership clarity §8).
// Admin auth first; q is validated here as well as in the RPC; at most 25
// rows go back, with `truncated` when the RPC returned its 26th.
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

const handler = (await import('~~/server/api/admin/membership/find.post')).default as (e: any) => Promise<any>;
const evt = (): any => ({ node: { req: {} } });

function row(i: number) {
  return {
    user_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
    email: `member${i}@example.com`,
    display_name: null,
    matched_on: ['account_email'],
    subscriptions: [],
    pending_claims: [],
    discord: null,
  };
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [], error: null });
  requireAdminAuth.mockReset().mockResolvedValue({ user: { id: 'admin-1' } });
  readBody.mockReset().mockResolvedValue({});
});

describe('POST /api/admin/membership/find', () => {
  it('checks admin auth before anything else', async () => {
    requireAdminAuth.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    readBody.mockResolvedValue({ q: 'teresa@example.com' });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['two characters', 'te'],
    ['two characters padded with spaces', '  te  '],
    ['an array', ['tere', 'sa']],
    ['over 200 characters', 'x'.repeat(201)],
  ])('400s when q is %s, without calling the RPC', async (_label, q) => {
    readBody.mockResolvedValue(q === undefined ? {} : { q });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the trimmed query to admin_find_member', async () => {
    readBody.mockResolvedValue({ q: '  Teresa@Example.com ' });
    await handler(evt());
    expect(rpc).toHaveBeenCalledWith('admin_find_member', { p_query: 'Teresa@Example.com' });
  });

  it('accepts exactly three characters', async () => {
    readBody.mockResolvedValue({ q: 'ter' });
    await expect(handler(evt())).resolves.toEqual({ results: [], truncated: false });
  });

  it('returns rows in the RPC order, with jsonb nulls made into arrays', async () => {
    readBody.mockResolvedValue({ q: 'teresa' });
    const detached = { ...row(2), user_id: null, email: null, subscriptions: null, pending_claims: null };
    rpc.mockResolvedValue({ data: [row(1), detached], error: null });
    const res = await handler(evt());
    expect(res.truncated).toBe(false);
    expect(res.results.map((r: any) => r.user_id)).toEqual([row(1).user_id, null]);
    expect(res.results[1]).toMatchObject({ email: null, subscriptions: [], pending_claims: [] });
  });

  it('shows 25 and flags truncated when the RPC returns its 26th row', async () => {
    readBody.mockResolvedValue({ q: 'example.com' });
    rpc.mockResolvedValue({ data: Array.from({ length: 26 }, (_, i) => row(i)), error: null });
    const res = await handler(evt());
    expect(res.results).toHaveLength(25);
    expect(res.results[24].user_id).toBe(row(24).user_id);
    expect(res.truncated).toBe(true);
  });

  it('is not truncated at exactly 25', async () => {
    readBody.mockResolvedValue({ q: 'example.com' });
    rpc.mockResolvedValue({ data: Array.from({ length: 25 }, (_, i) => row(i)), error: null });
    const res = await handler(evt());
    expect(res.results).toHaveLength(25);
    expect(res.truncated).toBe(false);
  });

  it("maps the RPC's 22023 short-query refusal to 400", async () => {
    readBody.mockResolvedValue({ q: 'abc' });
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'query too short' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('500s on any other RPC error', async () => {
    readBody.mockResolvedValue({ q: 'abc' });
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
    await expect(handler(evt())).rejects.toMatchObject({ statusCode: 500 });
  });
});

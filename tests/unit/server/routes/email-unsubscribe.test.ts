/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /email/unsubscribe also marks the newsletter row (Ghost retirement Phase 2):
// its suppression upsert is ignoreDuplicates, so with a bounce row already present
// it writes nothing and the database trigger never fires.
const upsert = vi.fn();
const rpc = vi.fn();
vi.mock('~~/server/utils/supabase', () => ({ getServiceClient: () => ({ from: () => ({ upsert }), rpc }) }));
vi.mock('~~/server/utils/marketingUnsub', async (orig) => ({
  ...(await orig<any>()),
  unsubConfigured: () => true,
  verifyUnsubToken: () => 'reader@gmail.com',
}));

vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal('setResponseStatus', vi.fn());
vi.stubGlobal('getQuery', () => ({ e: 'E', t: 'T' }));

const handler = (await import('~~/server/routes/email/unsubscribe.post')).default as (e: any) => Promise<string>;

describe('POST /email/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it('writes the suppression AND marks the newsletter row unsubscribed', async () => {
    const html = await handler({});
    expect(upsert).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('mailing_list_unsubscribe', { p_email: 'reader@gmail.com' });
    expect(html).toContain("You're unsubscribed");
  });

  it('a failed list update still answers success (the suppression already stops sends) and logs', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await handler({})).toContain("You're unsubscribed");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

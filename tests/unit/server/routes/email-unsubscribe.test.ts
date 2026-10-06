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

describe('GET /email/unsubscribe?from=news (old Ghost newsletter links)', () => {
  it('explains that the old newsletter stopped, without a token', async () => {
    vi.stubGlobal('getQuery', () => ({ from: 'news', uuid: 'ghost-member', key: 'k' }));
    const get = (await import('~~/server/routes/email/unsubscribe.get')).default as (e: any) => string;
    const html = get({});
    expect(html).toContain('The old blog newsletter has moved');
    expect(html).toContain('https://community.classicminidiy.com/c/news/16');
    expect(html).not.toContain("This link isn't valid");
  });

  it('a real signed link still wins over from=news', async () => {
    vi.stubGlobal('getQuery', () => ({ from: 'news', e: 'E', t: 'T' }));
    const get = (await import('~~/server/routes/email/unsubscribe.get')).default as (e: any) => string;
    expect(get({})).toContain('Unsubscribe from marketing emails?');
  });

  // Last on purpose: it replaces the module mock for the rest of the file.
  it('shows even when unsubscribe is not configured, with a 200', async () => {
    vi.resetModules();
    vi.doMock('~~/server/utils/marketingUnsub', async (orig) => ({
      ...(await orig<any>()),
      unsubConfigured: () => false,
    }));
    vi.stubGlobal('getQuery', () => ({ from: 'news' }));
    const setStatus = vi.fn();
    vi.stubGlobal('setResponseStatus', setStatus);
    const get = (await import('~~/server/routes/email/unsubscribe.get')).default as (e: any) => string;
    expect(get({})).toContain('The old blog newsletter has moved');
    expect(setStatus).not.toHaveBeenCalled();
    vi.doUnmock('~~/server/utils/marketingUnsub');
  });
});

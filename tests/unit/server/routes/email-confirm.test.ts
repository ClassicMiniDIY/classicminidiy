/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// /email/confirm (Ghost retirement Phase 2): GET never writes, POST subscribes.
const rpc = vi.fn();
vi.mock('~~/server/utils/supabase', () => ({ getServiceClient: () => ({ rpc }) }));
const verifyConfirmToken = vi.fn();
vi.mock('~~/server/utils/mailingListConfirm', () => ({ verifyConfirmToken }));

const setResponseStatus = vi.fn();
const getQuery = vi.fn(() => ({ e: 'E', x: '1', t: 'T' }));
vi.stubGlobal('defineEventHandler', (h: Function) => h);
vi.stubGlobal('setHeader', vi.fn());
vi.stubGlobal('setResponseStatus', setResponseStatus);
vi.stubGlobal('getQuery', getQuery);
vi.stubGlobal('useRuntimeConfig', () => ({ MARKETING_UNSUB_SECRET: 'set' }));

const getHandler = (await import('~~/server/routes/email/confirm.get')).default as (e: any) => string;
const postHandler = (await import('~~/server/routes/email/confirm.post')).default as (e: any) => Promise<string>;

describe('/email/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyConfirmToken.mockReturnValue({
      ok: true,
      email: 'reader@gmail.com',
      issuedAt: new Date('2026-10-01T00:00:00Z'),
    });
    rpc.mockResolvedValue({ data: [{ status: 'subscribed', cleared_unsubscribe: false }], error: null });
  });

  it('GET shows a POST form with the same token and writes nothing', () => {
    const html = getHandler({});
    expect(html).toContain('method="POST" action="/email/confirm?e=E&x=1&t=T"');
    expect(html).not.toContain('reader@gmail.com'); // masked
    expect(rpc).not.toHaveBeenCalled();
  });

  it('POST confirms through mailing_list_confirm with the link issue time', async () => {
    const html = await postHandler({});
    expect(rpc).toHaveBeenCalledWith('mailing_list_confirm', {
      p_email: 'reader@gmail.com',
      p_issued_at: '2026-10-01T00:00:00.000Z',
    });
    expect(html).toContain("You're subscribed");
  });

  it('POST: a link older than the latest unsubscribe is refused, not a false success', async () => {
    rpc.mockResolvedValue({ data: [{ status: 'stale', cleared_unsubscribe: false }], error: null });
    const html = await postHandler({});
    expect(html).toContain('older than your unsubscribe');
    expect(html).not.toContain("You're subscribed");
    expect(setResponseStatus).toHaveBeenCalledWith({}, 409);
  });

  it('an invalid or expired token never reaches the database', async () => {
    verifyConfirmToken.mockReturnValue({ ok: false, reason: 'expired' });
    expect(await postHandler({})).toContain('expired');
    expect(setResponseStatus).toHaveBeenCalledWith({}, 410);
    verifyConfirmToken.mockReturnValue({ ok: false, reason: 'invalid' });
    getHandler({});
    expect(setResponseStatus).toHaveBeenCalledWith({}, 400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a database error is a 500 page, not a false success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await postHandler({})).toContain('Something went wrong');
    expect(setResponseStatus).toHaveBeenCalledWith({}, 500);
    errSpy.mockRestore();
  });
});

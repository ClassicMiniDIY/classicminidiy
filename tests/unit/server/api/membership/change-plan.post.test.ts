/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// POST /api/membership/change-plan: the web proxy in front of the
// change-membership-plan edge function (classicminidiy-supabase
// docs/plans/2026-10-06-membership-change-level.md).

const fetchMock = vi.fn();
vi.stubGlobal('$fetch', fetchMock);

const { default: handler } = await import('~/server/api/membership/change-plan.post');
const g = globalThis as any;

beforeEach(() => {
  fetchMock.mockReset();
  g.getHeader.mockReturnValue('Bearer tok');
  g.readBody.mockResolvedValue({ plan: 'plus' });
});

describe('POST /api/membership/change-plan', () => {
  it('401 without a bearer token, and never calls the edge function', async () => {
    g.getHeader.mockReturnValue(undefined);
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'gold', 3])('400 for plan %s', async (plan) => {
    g.readBody.mockResolvedValue({ plan });
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the token and plan to the edge function', async () => {
    fetchMock.mockResolvedValue({ changed: true, plan: 'plus' });
    await expect(handler({} as any)).resolves.toEqual({ changed: true, plan: 'plus' });
    expect(fetchMock).toHaveBeenCalledWith('https://test.supabase.co/functions/v1/change-membership-plan', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', apikey: 'test-anon-key', 'content-type': 'application/json' },
      body: { plan: 'plus' },
    });
  });

  it('status: forwards the action and normalizes the answer', async () => {
    g.readBody.mockResolvedValue({ action: 'status' });
    fetchMock.mockResolvedValue({
      plan: 'plus',
      interval: 'year',
      monthlyCents: 667,
      onCurrentPrice: false,
      blocked: null,
      extra: 1,
    });
    await expect(handler({} as any)).resolves.toEqual({
      plan: 'plus',
      interval: 'year',
      monthlyCents: 667,
      onCurrentPrice: false,
      blocked: null,
    });
    expect(fetchMock.mock.calls[0][1].body).toEqual({ action: 'status' });
  });

  it('passes the edge code and a Stripe invoice URL through', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('402'), {
        statusCode: 402,
        data: { code: 'PAYMENT_REQUIRED', invoiceUrl: 'https://invoice.stripe.com/i/acct/x' },
      })
    );
    await expect(handler({} as any)).rejects.toMatchObject({
      statusCode: 402,
      data: { code: 'PAYMENT_REQUIRED', invoiceUrl: 'https://invoice.stripe.com/i/acct/x' },
    });
  });

  it('drops an invoice URL that is not a Stripe invoice page', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('402'), {
        statusCode: 402,
        data: { code: 'PAYMENT_REQUIRED', invoiceUrl: 'https://evil.example/pay' },
      })
    );
    await expect(handler({} as any)).rejects.toMatchObject({ data: { code: 'PAYMENT_REQUIRED', invoiceUrl: null } });
  });

  it('an edge error without a status is a 502', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 502, data: { code: null } });
  });
});

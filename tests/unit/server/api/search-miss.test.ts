/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// POST /api/search/miss — the only place a search miss is recorded now.
//
// The search call itself no longer records (it ran on a 180ms debounce, so
// every pause while typing made a Most Wanted candidate). This route is hit
// on a COMMIT and must: clamp the text like the RPC does, skip the RPC for
// input the RPC would drop anyway, and never surface a telemetry failure to
// the person searching.
// ---------------------------------------------------------------------------

const { mockRpc, mockReadBody, mockSetResponseStatus } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockReadBody: vi.fn(),
  mockSetResponseStatus: vi.fn(),
}));

vi.stubGlobal('defineEventHandler', (handler: Function) => handler);
vi.stubGlobal('readBody', mockReadBody);
vi.stubGlobal('setResponseStatus', mockSetResponseStatus);
vi.mock('~~/server/utils/supabase', () => ({
  getServiceClient: () => ({ rpc: mockRpc }),
}));

const handler = (await import('~~/server/api/search/miss.post')).default as (event: unknown) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockRpc.mockResolvedValue({ error: null });
});

describe('POST /api/search/miss', () => {
  it('records a committed query through record_search_miss and answers 204', async () => {
    mockReadBody.mockResolvedValue({ q: '  spot   light bracket ' });
    const result = await handler({});
    expect(mockRpc).toHaveBeenCalledWith('record_search_miss', { p_query: 'spot light bracket' });
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, 204);
    expect(result).toBeNull();
  });

  it('skips the RPC for text under the RPC floor of three characters', async () => {
    mockReadBody.mockResolvedValue({ q: 'ab' });
    await handler({});
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, 204);
  });

  it('clamps a pathological paste to 120 characters before it reaches the RPC', async () => {
    mockReadBody.mockResolvedValue({ q: 'x'.repeat(500) });
    await handler({});
    expect(mockRpc).toHaveBeenCalledWith('record_search_miss', { p_query: 'x'.repeat(120) });
  });

  it('tolerates a missing or unparseable body', async () => {
    mockReadBody.mockRejectedValue(new Error('invalid json'));
    await handler({});
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, 204);
  });

  it('never fails the request when the RPC fails', async () => {
    mockReadBody.mockResolvedValue({ q: 'rear light bulb' });
    mockRpc.mockResolvedValue({ error: { message: 'boom' } });
    await expect(handler({})).resolves.toBeNull();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, 204);
  });
});

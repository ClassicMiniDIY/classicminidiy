/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFetch, mockUseRuntimeConfig } = vi.hoisted(() => {
  const mockFetch = vi.fn(async () => ({}));
  const mockUseRuntimeConfig = vi.fn();
  (globalThis as any).$fetch = mockFetch;
  (globalThis as any).useRuntimeConfig = mockUseRuntimeConfig;
  return { mockFetch, mockUseRuntimeConfig };
});

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: () => ({ rpc: mockRpc }),
}));

import { recordMcpGated, recordMcpUsage } from '~/server/utils/mcpUsage';

function makeEvent(mcpAuth?: Record<string, unknown>) {
  return {
    context: mcpAuth ? { mcpAuth } : {},
    waitUntil: vi.fn(),
  } as any;
}

const DEV_AUTH = { tier: 'developer', keyId: 'key-1', userId: 'user-1', keyPrefix: 'cmdiy_Ab12Cd' };

describe('server/utils/mcpUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRuntimeConfig.mockReturnValue({ public: { posthogPublicKey: 'phc_test' } });
    mockRpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('developer tier: exact Supabase increment + always-captured PostHog event', () => {
    const event = makeEvent(DEV_AUTH);
    recordMcpUsage(event, 'wheel-search');

    expect(mockRpc).toHaveBeenCalledWith('increment_mcp_usage', {
      p_key_id: 'key-1',
      p_user_id: 'user-1',
      p_tool: 'wheel-search',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = (mockFetch.mock.calls[0] as any[])[1].body;
    expect(body.event).toBe('mcp_tool_called');
    expect(body.distinct_id).toBe('user-1');
    expect(body.properties).toMatchObject({ tool: 'wheel-search', tier: 'developer', sample_rate: 1 });
    // Both sinks are backgrounded, never awaited on the hot path.
    expect(event.waitUntil).toHaveBeenCalledTimes(2);
  });

  it('internal tier: no Supabase row to count, PostHog only', () => {
    const event = makeEvent({ tier: 'internal' });
    recordMcpUsage(event, 'torque-specs');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as any[])[1].body.distinct_id).toBe('internal');
  });

  it('free tier: Supabase count is exact, PostHog is sampled at 10%', () => {
    const auth = { ...DEV_AUTH, tier: 'free' };

    vi.spyOn(Math, 'random').mockReturnValue(0.5); // outside the sample
    recordMcpUsage(makeEvent(auth), 'clearances');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();

    vi.spyOn(Math, 'random').mockReturnValue(0.05); // inside the sample
    recordMcpUsage(makeEvent(auth), 'clearances');
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as any[])[1].body.properties.sample_rate).toBe(0.1);
  });

  it('never throws when the capture transport or the RPC fail', () => {
    mockFetch.mockRejectedValue(new Error('posthog down'));
    mockRpc.mockRejectedValue(new Error('supabase down'));

    expect(() => recordMcpUsage(makeEvent(DEV_AUTH), 'torque-specs')).not.toThrow();
    expect(() => recordMcpGated(makeEvent({ tier: 'free' }), 'wheel-search')).not.toThrow();
  });

  it('does nothing PostHog-side without a configured key', () => {
    mockUseRuntimeConfig.mockReturnValue({ public: { posthogPublicKey: '' } });
    recordMcpUsage(makeEvent(DEV_AUTH), 'torque-specs');
    expect(mockFetch).not.toHaveBeenCalled();
    // The exact Supabase count still lands.
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('gated calls are always captured with their own event name', () => {
    const event = makeEvent({ tier: 'free', userId: 'user-2', keyPrefix: 'cmdiy_Zz99Yy' });
    recordMcpGated(event, 'chassis-decoder');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = (mockFetch.mock.calls[0] as any[])[1].body;
    expect(body.event).toBe('mcp_tool_gated');
    expect(body.distinct_id).toBe('user-2');
    expect(body.properties).toMatchObject({ tool: 'chassis-decoder', tier: 'free' });
    // Gated attempts never move a usage count a subscriber could see.
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

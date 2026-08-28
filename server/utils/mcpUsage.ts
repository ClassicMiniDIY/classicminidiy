import type { H3Event } from 'h3';
import { getMcpAuth } from './mcpTiers';
import { getServiceClient } from './supabase';

/**
 * Async usage capture for MCP tool calls — never on the hot path, never a
 * reason a tool call fails. Design doc:
 * docs/plans/2026-08-28-developer-api-subscription.md
 *
 * Two sinks per successful call:
 *  - Supabase `increment_mcp_usage` (service role) -> mcp_usage_daily, the
 *    exact per-key/tool counts behind the dashboard usage chart. Skipped for
 *    the internal (env-key) tier, which has no api_keys row.
 *  - PostHog `mcp_tool_called` for product dashboards — hand-rolled capture
 *    like server/middleware/bot-analytics.ts (posthog-node stays uninstalled).
 *    FREE-tier events are SAMPLED at ~10% (the one bill that scales per-call);
 *    a sample_rate property lets dashboards re-weight. Supabase counts stay
 *    exact for every tier.
 *
 * Gated calls (a free key invoking a paid tool) get their own always-captured
 * `mcp_tool_gated` event: rare, and the clearest upgrade-funnel signal there is.
 *
 * Known v1 caveat: the usage wrapper sits inside the toolkit's cache wrapper,
 * so KV cache HITS on the two cached tools are not recorded (documented in
 * server/mcp/README.md; rate limiting is per-request and unaffected).
 */

const POSTHOG_INGEST_HOST = process.env.POSTHOG_INGEST_HOST || 'https://us.i.posthog.com';

const FREE_TIER_SAMPLE_RATE = 0.1;

function background(event: H3Event, promise: Promise<unknown>): void {
  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(promise);
}

function captureToPostHog(event: H3Event, name: string, distinctId: string, properties: Record<string, unknown>): void {
  const key = useRuntimeConfig(event).public.posthogPublicKey as string;
  if (!key) return;

  const send = $fetch(`${POSTHOG_INGEST_HOST}/capture/`, {
    method: 'POST',
    body: {
      api_key: key,
      event: name,
      distinct_id: distinctId,
      properties: {
        ...properties,
        // Person-less: these are volume/product metrics, not person timelines.
        $process_person_profile: false,
      },
    },
    timeout: 2000,
  }).catch(() => {
    // best-effort: usage capture must never affect serving
  });
  background(event, send);
}

/** Record one successful tool call. Fire-and-forget; all failures swallowed. */
export function recordMcpUsage(event: H3Event, toolName: string): void {
  const auth = getMcpAuth(event);
  const tier = auth?.tier ?? 'free';

  // Exact per-key counts for the dashboard. Internal env keys have no row.
  if (auth?.keyId && auth.userId) {
    const increment = getServiceClient()
      .rpc('increment_mcp_usage', {
        p_key_id: auth.keyId,
        p_user_id: auth.userId,
        p_tool: toolName,
      })
      .then(
        ({ error }) => {
          if (error) console.error(`[MCP Usage] increment_mcp_usage failed: ${error.message}`);
        },
        () => {}
      );
    background(event, increment);
  }

  const sampled = tier !== 'free' || Math.random() < FREE_TIER_SAMPLE_RATE;
  if (!sampled) return;

  captureToPostHog(event, 'mcp_tool_called', auth?.userId ?? 'internal', {
    tool: toolName,
    tier,
    key_prefix: auth?.keyPrefix,
    sample_rate: tier === 'free' ? FREE_TIER_SAMPLE_RATE : 1,
  });
}

/** Record a free-tier call against a paid-only tool. Always captured. */
export function recordMcpGated(event: H3Event, toolName: string): void {
  const auth = getMcpAuth(event);
  captureToPostHog(event, 'mcp_tool_gated', auth?.userId ?? 'anonymous', {
    tool: toolName,
    tier: auth?.tier ?? 'free',
    key_prefix: auth?.keyPrefix,
    sample_rate: 1,
  });
}

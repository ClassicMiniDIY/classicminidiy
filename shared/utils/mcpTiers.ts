/**
 * The client-safe half of the MCP tier contract (Developer API).
 * Design doc: docs/plans/2026-08-28-developer-api-subscription.md
 *
 * Everything here is a plain constant or type, importable from BOTH the app
 * bundle (/developers pricing table, /dashboard/api-keys) and server code.
 * The server-only half — key minting, hashing, the auth cache, the H3 context
 * accessors — lives in server/utils/mcpTiers.ts, which re-exports this module
 * so server consumers keep a single import path. Keep server-only imports out
 * of THIS file: it ships in the public client bundle.
 */

/**
 * MCP access tiers.
 *
 *   free      — any account-minted key without an active 'developer'
 *               subscription: FREE_TOOLS only, low rate limit.
 *   developer — key whose owner has an active 'developer' subscription:
 *               all tools, higher rate limit.
 *   internal  — the env-var keys (MCP_API_KEY / MCP_API_KEYS): all tools,
 *               highest limit. This is the ops/CI path — the transport test
 *               and the deploy smoke authenticate with it — and it must keep
 *               working with no database involved.
 */
export type McpTier = 'free' | 'developer' | 'internal';

/**
 * The `subscriptions.product_id` value that defines the paid tier. Load-bearing
 * on both the read path (the auth gate's `user_has_subscription` call) and the
 * display path; the edge functions that WRITE the rows carry their own copy in
 * the private repo's `_shared/subscriptions.ts` — keep the two in sync.
 */
export const DEVELOPER_PRODUCT_ID = 'developer';

/** The public MCP endpoint, as shown in setup snippets and pricing copy. */
export const MCP_ENDPOINT = 'https://classicminidiy.com/mcp';

/**
 * Tools a FREE key may call — the calculators and reference tables. The paid
 * tier adds PAID_ONLY_TOOLS (identification + archive). Names are tool
 * filenames in server/mcp/tools/; unit tests assert the two sets exactly
 * partition the real tool files AND that the transport script's paid-tool
 * checks cover every PAID_ONLY_TOOLS entry, so neither list can drift.
 */
export const FREE_TOOLS: ReadonlySet<string> = new Set([
  'compression-calculator',
  'gearbox-calculator',
  'needle-compare',
  'torque-specs',
  'clearances',
  'parts-equivalency',
  'vehicle-weights',
]);

/** The identification + archive tools the paid tier adds. */
export const PAID_ONLY_TOOLS: readonly string[] = ['chassis-decoder', 'engine-decoder', 'wheel-search', 'color-lookup'];

/** Self-serve keys are recognisable without a DB hit: 'cmdiy_' + 40 base62. */
export const MCP_KEY_PREFIX = 'cmdiy_';
export const MCP_KEY_RANDOM_LENGTH = 40;
/** First 12 chars ('cmdiy_' + 6) stored for display in the dashboard. */
export const MCP_KEY_DISPLAY_PREFIX_LENGTH = 12;
/** Active (non-revoked) keys allowed per account. */
export const MCP_MAX_ACTIVE_KEYS = 5;

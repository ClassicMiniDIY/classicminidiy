import { isProtectedMcpPath } from '../utils/mcpRoutes';
import { consumeRateLimit } from '../utils/rateLimit';
import { getMcpAuth, type McpTier } from '../utils/mcpTiers';
import { clientIp } from '../utils/clientIp';

/**
 * Per-IP rate limiting for two classes of abuse-prone traffic:
 *
 *   1. The public, UNAUTHENTICATED LangGraph AI proxy (`/api/langgraph/**`).
 *      The chat is intentionally open to every site visitor (no login), so this
 *      throttle is the only thing between an anonymous scripted caller and
 *      unbounded LLM runs billed to our LangSmith key.
 *
 *   2. Mutating requests to the rest of the JSON API (POST/PUT/PATCH/DELETE on
 *      `/api/**`). These are the content-submission surfaces — registry/wheel/
 *      color/model submissions, comments, gear & alignment configs, uploads.
 *      A spam account that scripts these could flood the moderation queue or
 *      drop scam links across the site. The limit is generous enough that a
 *      real person clicking through forms never approaches it, while an abuse
 *      loop blows past in seconds. This complements (does not replace) the
 *      Turnstile challenge on login and the Vercel BotID guards on high-value
 *      POSTs — see docs/runbooks/2026-06-15-botid-endpoint-protection.md.
 *
 * Limits are tunable without a code change via env:
 *   LANGGRAPH_RATELIMIT_MAX / LANGGRAPH_RATELIMIT_WINDOW_MS  (chat)
 *   WRITE_RATELIMIT_MAX      / WRITE_RATELIMIT_WINDOW_MS      (mutations)
 *
 * Note: the counter is per warm serverless instance (see utils/rateLimit.ts),
 * so this dampens abuse rather than enforcing a precise global quota.
 */
const LANGGRAPH_WINDOW_MS = Number(process.env.LANGGRAPH_RATELIMIT_WINDOW_MS) || 60_000;
const LANGGRAPH_MAX = Number(process.env.LANGGRAPH_RATELIMIT_MAX) || 40;

const WRITE_WINDOW_MS = Number(process.env.WRITE_RATELIMIT_WINDOW_MS) || 60_000;
const WRITE_MAX = Number(process.env.WRITE_RATELIMIT_MAX) || 30;

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The MCP JSON-RPC endpoint. It sits at /mcp, NOT under /api/, so neither policy
 * below ever covered it — an authenticated caller had unlimited request volume.
 *
 * Keyed per API KEY rather than per IP, because MCP clients are servers: a
 * single key is legitimately used from many addresses, and many keys can share
 * one address. Per-IP keying would throttle unrelated tenants together and let
 * one key spread its load across addresses to escape the limit. The default is
 * generous compared with the chat proxy since callers here hold a credential we
 * issued.
 *
 * The max is TIER-AWARE since the Developer API (mcp-auth stashes the resolved
 * tier on event.context.mcpAuth before this file runs): free keys get a taste,
 * paying developers 12x that, and the env-var ops keys the most headroom. The
 * rate limit is the entire enforcement story — there is deliberately no
 * monthly quota (docs/plans/2026-08-28-developer-api-subscription.md).
 */
const MCP_WINDOW_MS = Number(process.env.MCP_RATELIMIT_WINDOW_MS) || 60_000;
const MCP_MAX = Number(process.env.MCP_RATELIMIT_MAX) || 240;
const MCP_FREE_MAX = Number(process.env.MCP_RATELIMIT_FREE_MAX) || 20;
const MCP_INTERNAL_MAX = Number(process.env.MCP_RATELIMIT_INTERNAL_MAX) || 600;

/** Requests/window for a resolved tier. A MISSING tier (the middleware
 *  ordering ever changing, or an unauthenticated request reaching here) gets
 *  the free max — fail conservative, never generous. */
function mcpMaxForTier(tier: McpTier | undefined): number {
  switch (tier) {
    case 'internal':
      return MCP_INTERNAL_MAX;
    case 'developer':
      return MCP_MAX;
    default:
      return MCP_FREE_MAX;
  }
}

/**
 * FNV-1a over the bearer token. This is a bucket label, not a security control:
 * it exists so a credential never lands verbatim in a rate-limit key, which is
 * held in shared storage and can surface in diagnostics. Synchronous on purpose
 * — crypto.subtle is async and applyLimit is not.
 */
function keyFingerprint(token: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * Paths exempt from the mutation throttle. `/api/admin/**` is excluded so a
 * moderator working through the review queue (bulk approve/reject) is never
 * throttled mid-session — admin access is already gated by requireAdminAuth.
 * `/api/langgraph` is handled by its own (stricter, unauthenticated) policy
 * above and must not be double-counted here.
 */
const WRITE_EXEMPT_PREFIXES = ['/api/langgraph', '/api/admin'];

// clientIp() moved to server/utils/clientIp.ts — mcp-auth's lookup throttle
// keys on the same identity, and two copies would drift. The header-precedence
// rationale (cf-connecting-ip first, platform-set only) lives there.

function applyLimit(event: any, key: string, max: number, windowMs: number, message: string) {
  const result = consumeRateLimit(key, { max, windowMs });

  setHeader(event, 'X-RateLimit-Limit', String(max));
  setHeader(event, 'X-RateLimit-Remaining', String(result.remaining));
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (result.limited) {
    setHeader(event, 'Retry-After', String(result.retryAfter));
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message,
    });
  }
}

export default defineEventHandler((event) => {
  const { pathname } = getRequestURL(event);

  // Policy 0: the MCP endpoint.
  //
  // server/middleware/mcp-auth.ts runs BEFORE this file (Nitro orders global
  // middleware by filename, and 'mcp-auth' sorts before 'rate-limit'), so an
  // unauthenticated request is already rejected and never reaches the counter.
  // Everything counted here therefore presented a valid key, which is what makes
  // per-key bucketing meaningful. The IP fallback only covers the case where
  // that ordering ever changes.
  //
  // The path test is shared with mcp-auth (server/utils/mcpRoutes.ts) so the
  // throttled set and the authenticated set cannot drift apart. An exact
  // '/mcp' comparison here would leave '/mcp/' uncounted.
  if (isProtectedMcpPath(pathname)) {
    const authHeader = getHeader(event, 'authorization')?.trim();
    const token = authHeader && authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : '';
    const bucket = token ? `key:${keyFingerprint(token)}` : `ip:${clientIp(event)}`;
    applyLimit(
      event,
      `mcp:${bucket}`,
      mcpMaxForTier(getMcpAuth(event)?.tier),
      MCP_WINDOW_MS,
      'Too many MCP requests for this API key. Please slow down and try again in a minute.'
    );
    return;
  }

  // Policy 1: the public AI chat proxy.
  if (pathname.startsWith('/api/langgraph')) {
    applyLimit(
      event,
      `langgraph:${clientIp(event)}`,
      LANGGRAPH_MAX,
      LANGGRAPH_WINDOW_MS,
      'Too many AI chat requests from your network. Please wait a moment and try again.'
    );
    return;
  }

  // Policy 2: mutating requests to the rest of the API.
  if (
    pathname.startsWith('/api/') &&
    WRITE_METHODS.has(event.method) &&
    // Match on a path-segment boundary so a prefix of '/api/admin' exempts
    // '/api/admin' and '/api/admin/...' but NOT '/api/admin-foo'.
    !WRITE_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  ) {
    applyLimit(
      event,
      `write:${clientIp(event)}`,
      WRITE_MAX,
      WRITE_WINDOW_MS,
      'Too many requests from your network. Please slow down and try again in a minute.'
    );
  }
});

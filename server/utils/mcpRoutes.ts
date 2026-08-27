/**
 * Which /mcp paths require the API key.
 *
 * Shared by server/middleware/mcp-auth.ts and server/middleware/rate-limit.ts so
 * the two cannot drift: a path the auth gate protects must also be the path the
 * throttle counts, and vice versa.
 *
 * The gate was briefly an exact `pathname === '/mcp'` match, which Nitro's router
 * undermines: it folds '/mcp/' onto the '/mcp' handler while getRequestURL still
 * reports the trailing slash, so a single appended '/' reached the JSON-RPC
 * handler with no key and no rate limit. Matching the FAMILY and carving out the
 * two public routes by name is the safe direction — an unrecognised /mcp/* path
 * is protected by default rather than exposed by default.
 */

/** Routes @nuxtjs/mcp-toolkit registers to be publicly linkable. */
export const MCP_PUBLIC_PATHS = new Set(['/mcp/deeplink', '/mcp/badge.svg']);

/** Strip trailing slashes so '/mcp', '/mcp/' and '/mcp//' compare equal. */
export function normalizeMcpPath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/**
 * True when the path is the MCP endpoint (or any not-explicitly-public route
 * beneath it) and must therefore present a valid key.
 *
 * '/mcp-other' and similar prefix neighbours are NOT matched — they are
 * unrelated paths that merely share the first four characters.
 */
export function isProtectedMcpPath(pathname: string): boolean {
  const path = normalizeMcpPath(pathname);
  if (MCP_PUBLIC_PATHS.has(path)) return false;
  return path === '/mcp' || path.startsWith('/mcp/');
}

/**
 * GET /discord/claim?token=<jwt>
 *
 * Discord claim proxy page (keystone §12). The members-only Discord claim email
 * links here; this server route 302-forwards to the `discord-claim` Edge
 * Function, which validates the JWT and continues the redirect chain (→ Discord
 * OAuth on success, → /?discord_error=<code> on failure). Using a server route
 * preserves clean 302 semantics with no client flash and keeps the proxy hop off
 * client JS.
 *
 * A missing token is forwarded as an empty token so the Edge Function remains the
 * single source of truth for the error copy (it redirects to
 * /?discord_error=missing_token).
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');

  if (!supabaseUrl) {
    // Fall back to the home page's generic Discord error rather than 500.
    return sendRedirect(event, '/?discord_error=generic', 302);
  }

  const token = getQuery(event).token;
  const tokenParam = typeof token === 'string' ? token : '';

  // Transient redirect page — keep it out of search indexes.
  setHeader(event, 'X-Robots-Tag', 'noindex');

  const target = `${supabaseUrl}/functions/v1/discord-claim?token=${encodeURIComponent(tokenParam)}`;
  return sendRedirect(event, target, 302);
});

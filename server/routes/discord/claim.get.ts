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
 * A bare hit with no token is NOT an email link — it's the mobile apps'
 * hardcoded "Claim Discord Access" URL (iOS AppConstants.URLs.discordClaim,
 * Android SustainingMemberCopy.DISCORD_CLAIM_URL) or a bookmark. Those go to
 * the self-serve connect page, which mints a fresh claim token for the
 * signed-in member (discord-claim-reissue) and re-enters this proxy with it.
 * Forwarding an empty token instead would dead-end every app user at
 * /?discord_error=missing_token.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const supabaseUrl = (config.public.supabaseUrl as string)?.replace(/\/$/, '');

  const token = getQuery(event).token;
  const tokenParam = typeof token === 'string' ? token : '';

  if (!tokenParam) {
    return sendRedirect(event, '/discord/connect', 302);
  }

  if (!supabaseUrl) {
    // Fall back to the home page's generic Discord error rather than 500.
    return sendRedirect(event, '/?discord_error=generic', 302);
  }

  // Transient redirect page — keep it out of search indexes.
  setHeader(event, 'X-Robots-Tag', 'noindex');

  const target = `${supabaseUrl}/functions/v1/discord-claim?token=${encodeURIComponent(tokenParam)}`;
  return sendRedirect(event, target, 302);
});

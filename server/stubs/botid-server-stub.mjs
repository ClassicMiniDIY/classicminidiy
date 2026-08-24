// Stub for `botid/server`, aliased in nuxt.config.ts (nitro.alias) on Cloudflare builds only.
//
// Vercel BotID is a Vercel-platform feature: `checkBotId()` reads a signed
// classification that Vercel's edge attaches to the request. Off Vercel there is
// nothing to read, so the real module cannot work on workerd.
//
// On Cloudflare the equivalent protection is a WAF rule at the zone edge plus the
// existing in-app rate limiter (server/middleware/rate-limit.ts), NOT this stub.
// This returns "not a bot" so the handlers fall through to their normal path.
//
// SPIKE NOTE: returning isBot:false is fail-OPEN. That is acceptable for a
// throwaway workers.dev spike with no DNS and no real traffic. Before any
// production Cloudflare cutover the WAF rule must exist, or these routes lose
// their bot protection silently. Tracked as amendment A/E in the migration plan.
//
// Kept in server/stubs (NOT server/utils) so Nitro doesn't auto-import the name.
export async function checkBotId() {
  return { isBot: false, isHuman: true, isVerifiedBot: false, verifiedBotName: undefined };
}

export function initBotId() {}

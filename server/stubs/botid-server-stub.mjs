// Stub for `botid/server`, aliased in nuxt.config.ts (nitro.alias) on Cloudflare builds only.
//
// Vercel BotID is a Vercel-platform feature: `checkBotId()` reads a signed
// classification that Vercel's edge attaches to the request. Off Vercel there is
// nothing to read, so the real module cannot work on workerd.
//
// On Cloudflare the protection for these routes is a zone rate-limit rule at the
// edge plus the in-app limiter (server/middleware/rate-limit.ts), NOT this stub.
// This returns "not a bot" so the handlers fall through to their normal path.
//
// CONTRACT: because this classifies nothing, checkBotId() carries no weight on
// Cloudflare. A route may not depend on it. Every caller needs a zone
// rate-limit rule and in-app limiter coverage, and adding a new checkBotId()
// call means adding the matching zone rule in the same change. The rule
// inventory is maintained in Cloudflare rather than in this repo.
//
// Kept in server/stubs (NOT server/utils) so Nitro doesn't auto-import the name.
export async function checkBotId() {
  return { isBot: false, isHuman: true, isVerifiedBot: false, verifiedBotName: undefined };
}

export function initBotId() {}

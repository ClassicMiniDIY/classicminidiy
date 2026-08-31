import { initBotId } from 'botid/client/core';

/**
 * Vercel BotID — invisible bot protection for high-value POST endpoints.
 *
 * initBotId() patches fetch() so calls to these paths carry a challenge header;
 * the matching server handlers call checkBotId() and 403 classified bots. This
 * complements (does not replace) the per-IP rate limit + Turnstile already in place.
 *
 * IMPORTANT:
 *  - Only active in PRODUCTION. Local dev + `curl` always classify as human, so this
 *    can't be validated locally — test the chat + a checkout in a Vercel Preview deploy.
 *  - Only protect routes the BROWSER calls via fetch/$fetch. A non-browser caller
 *    (server-to-server, mobile app) hitting a protected route is blocked. The paths
 *    below are all browser-only (web chat widget + web model marketplace); the admin
 *    LangGraph routes call the SDK directly and bypass /api/langgraph, so they're safe.
 *  - Each protected path here MUST have checkBotId() in its handler, and vice-versa.
 */
export default defineNuxtPlugin({
  enforce: 'pre',
  setup() {
    initBotId({
      protect: [
        // NOTE: /api/langgraph/* was removed 2026-08-31. BotID is aliased to a
        // fail-open stub on Cloudflare (server/stubs/botid-server-stub.mjs),
        // whose own contract says "a route may not depend on it" — so listing
        // the chat here bought no protection while making every chat POST carry
        // a challenge header, and it advertised a guarantee the platform does
        // not provide. The chat's real controls are the enabled zone
        // rate-limit rule on POST /api/langgraph/* (asserted from outside by
        // scripts/verify-cf-ratelimit.py) and the in-app limiter. Do not
        // re-add it without moving off the stub first.
        //
        // Stripe Connect seller onboarding (web model marketplace).
        //
        // NOTE: /api/models/checkout was deliberately removed from BotID. It
        // false-positive-blocked ~100% of real buyers (403 'Bot detected') while
        // the identical setup passed here and on langgraph; checkout is gated by
        // auth + the edge function + Stripe + rate limiting instead. seller/onboard
        // (low-traffic, also auth'd) keeps BotID for now — revisit if it shows the
        // same false positives.
        { path: '/api/models/seller/onboard', method: 'POST' },
      ],
    });
  },
});

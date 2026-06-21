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
        // Unauthenticated, expensive AI chat proxy — thread creation + run streaming
        // (POST). GET reads (thread state/history) are intentionally not protected.
        { path: '/api/langgraph/*', method: 'POST' },
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

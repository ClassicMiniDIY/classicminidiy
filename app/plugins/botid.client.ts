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
        // Stripe Connect money paths (web model marketplace). BOTH are STATIC
        // paths on purpose: BotID matches the outgoing request path to attach the
        // x-is-human challenge, and a dynamic mid-path segment
        // (the old /api/models/*/checkout) did not register the challenge — so
        // checkBotId() 403'd every real buyer. checkout takes modelId in the body.
        { path: '/api/models/checkout', method: 'POST' },
        { path: '/api/models/seller/onboard', method: 'POST' },
      ],
    });
  },
});

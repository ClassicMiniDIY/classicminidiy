import { matchBot } from '../utils/aiBots';

/**
 * GEO measurement: record which AI / search crawlers fetch which pages.
 *
 * Search Console shows Googlebot but NOT ChatGPT/Perplexity/Claude crawlers, so a
 * server-side capture is the only way to SEE answer-engine crawl activity. This
 * fires a person-less PostHog `bot_crawl` event for known bots and NEVER blocks the
 * response (blocking is robots' / the Vercel WAF's job — Phase 3).
 *
 * Best-effort + bounded:
 *  - only known bots (a small fraction of traffic) trigger any work;
 *  - asset/internal paths are skipped — we only care which CONTENT urls bots fetch;
 *  - the capture is backgrounded via event.waitUntil where supported, else
 *    fire-and-forget; failures are swallowed.
 *
 * Limitation: on Vercel, PRERENDERED pages are served statically by the CDN, so this
 * middleware only sees crawls of SSR routes (archive detail, models, etc.). For a
 * complete crawl log, use the Vercel WAF AI-bots managed ruleset set to "Log" (Phase 3).
 */

// Server-side ingestion host (the client uses a `/t` proxy that isn't usable here).
const POSTHOG_INGEST_HOST = process.env.POSTHOG_INGEST_HOST || 'https://us.i.posthog.com';

const SKIP_PREFIXES = ['/_nuxt', '/__', '/t/', '/api/', '/.well-known', '/_ipx'];
const SKIP_EXT = /\.(?:js|css|mjs|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|eot)$/i;

export default defineEventHandler((event) => {
  const ua = getHeader(event, 'user-agent');
  const match = matchBot(ua);
  if (!match) return; // not a tracked bot — do nothing, never block

  const { pathname } = getRequestURL(event);
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p)) || SKIP_EXT.test(pathname)) return;

  const key = useRuntimeConfig(event).public.posthogPublicKey as string;
  if (!key) return;

  // Person-less server capture; backgrounded so it never delays the crawler.
  const send = $fetch(`${POSTHOG_INGEST_HOST}/capture/`, {
    method: 'POST',
    body: {
      api_key: key,
      event: 'bot_crawl',
      distinct_id: `crawler:${match.bot}`,
      properties: {
        bot: match.bot,
        bot_category: match.category,
        path: pathname,
        $process_person_profile: false,
      },
    },
    timeout: 2000,
  }).catch(() => {
    // best-effort: bot analytics must never affect serving
  });

  // Prefer the platform's background-task primitive (Vercel) so the capture
  // survives the response; harmless no-op where unavailable.
  (event as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(send);
});

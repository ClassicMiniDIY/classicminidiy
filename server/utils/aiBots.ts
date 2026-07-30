/**
 * Single source of truth for AI crawler user-agent policy.
 *
 * Three surfaces consume this file and must never disagree:
 *   1. **robots.txt** — `robots.groups` in nuxt.config.ts (advisory).
 *   2. **Vercel WAF** — the "Block AI Training Crawlers" custom rule (enforcing).
 *      Its regex is NOT read from here at runtime; it lives in the Vercel console,
 *      so `WAF_DENY_REGEX` below is the canonical string to paste in, and
 *      `tests/unit/server/utils/aiBots.test.ts` pins it. Runbook:
 *      `docs/runbooks/2026-07-30-ai-crawler-firewall.md`.
 *   3. **Analytics** — `matchBot()` in server/middleware/bot-analytics.ts.
 *
 * Policy (decided 2026-06-14): ALLOW the live answer/search bots that drive
 * citations + referral traffic; DISALLOW the bulk training crawlers.
 * Why this is coherent: ChatGPT cites via OAI-SearchBot / ChatGPT-User (not GPTBot);
 * Claude via Claude-User / Claude-SearchBot (not ClaudeBot); Google AI Overviews use
 * the normal Googlebot index, so blocking Google-Extended opts out of Gemini
 * *training* without removing the site from AI Overviews.
 */

/** Live answer/search fetchers — ALLOWED (they drive citations + referral traffic). */
export const AI_ANSWER_BOTS = [
  'OAI-SearchBot', // ChatGPT search index
  'ChatGPT-User', // ChatGPT live "browse the web"
  'PerplexityBot', // Perplexity index
  'Perplexity-User', // Perplexity live fetch
  'Claude-User', // Claude live fetch
  'Claude-SearchBot', // Claude search
] as const;

/**
 * Training-PERMISSION tokens. These are not crawlers and never hit the edge — they
 * exist only so a site can opt out of a vendor's model training via robots.txt.
 * Blocking them at the WAF would be a no-op, so they are deliberately absent from
 * `EDGE_DENY_BOTS`. (Blocking Google-Extended opts out of Gemini training WITHOUT
 * removing the site from AI Overviews, which uses the normal Googlebot index.)
 */
export const AI_TRAINING_PERMISSION_TOKENS = ['Google-Extended', 'Applebot-Extended'] as const;

/**
 * Bulk training / dataset crawlers that send a real, distinguishable user-agent.
 * These are Disallowed in robots.txt AND hard-denied at the edge by the Vercel WAF
 * rule — robots is advisory and these are precisely the crawlers most likely to
 * ignore it.
 */
export const EDGE_DENY_BOTS = [
  'GPTBot', // OpenAI model-training crawler (distinct from OAI-SearchBot)
  'ClaudeBot', // Anthropic training crawler (distinct from Claude-User/-SearchBot)
  'anthropic-ai', // legacy Anthropic crawler token
  'CCBot', // Common Crawl — feeds most public training corpora
  'Bytespider', // ByteDance/TikTok training crawler; ignores robots in the wild
  'Meta-ExternalAgent', // Meta training/dataset crawler
  'Diffbot', // commercial web-data extraction / knowledge-graph crawler
  'Omgilibot', // Omgili / webz.io — resells scraped web data as LLM training sets
  'ImagesiftBot', // ImageSift (Hive AI) — bulk image dataset crawler
] as const;

/**
 * Everything DISALLOWED in robots.txt: the edge-denied crawlers plus the
 * permission-only tokens. Kept as one list because robots.txt makes no distinction —
 * only the WAF does.
 *
 * NOTE: Diffbot / Omgilibot / ImagesiftBot were denied at the edge from day one but
 * were missing here until 2026-07-30, so robots.txt never told them to stay away and
 * `matchBot()` couldn't classify them in `bot_crawl` analytics. Keep the two lists
 * reconciled — that gap is exactly what this file exists to prevent.
 */
export const AI_TRAINING_BOTS = [...EDGE_DENY_BOTS, ...AI_TRAINING_PERMISSION_TOKENS] as const;

/**
 * The canonical regex body for the Vercel WAF "Block AI Training Crawlers" custom
 * rule (condition: `User-Agent` matches regex). The console holds a COPY — changing
 * this list does not change production until someone updates the rule, which is what
 * the runbook and `tests/unit/server/utils/aiBots.test.ts` are there to force.
 */
export const WAF_DENY_REGEX = `(${EDGE_DENY_BOTS.join('|')})`;

/** Standard search engines — left under the default `*` rules; listed for analytics. */
export const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'Amazonbot'] as const;

/** Private / non-indexable areas answer bots shouldn't waste crawl budget on. */
export const PRIVATE_DISALLOW = [
  '/admin',
  '/dashboard',
  '/profile',
  '/auth',
  '/login',
  // Private marketplace surfaces (public /exchange listing/finds/wanted pages
  // stay crawlable; these are user-specific and noindex'd).
  '/exchange/messages',
  '/exchange/watchlist',
  '/onboarding',
  '/assets/',
  '/data/',
  '/server/',
  '/store/',
  '/plugins/',
];

// Ordered most-specific-first so e.g. "Applebot-Extended" (training) matches before
// "Applebot" (search), and so a bot is attributed to a single category.
const BOT_GROUPS: { tokens: readonly string[]; category: 'answer' | 'training' | 'search' }[] = [
  { tokens: AI_ANSWER_BOTS, category: 'answer' },
  { tokens: AI_TRAINING_BOTS, category: 'training' },
  { tokens: SEARCH_BOTS, category: 'search' },
];

/**
 * Identify a known bot from a User-Agent string for analytics (bot-crawl tracking).
 * Returns the matched token + its policy category, or null for non-bot/unknown UAs.
 * Substring match against the verbatim UA tokens (case-sensitive — they're exact).
 */
export function matchBot(userAgent: string | undefined | null): { bot: string; category: string } | null {
  if (!userAgent) return null;
  for (const group of BOT_GROUPS) {
    for (const token of group.tokens) {
      if (userAgent.includes(token)) return { bot: token, category: group.category };
    }
  }
  return null;
}

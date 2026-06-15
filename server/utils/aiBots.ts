/**
 * Single source of truth for AI crawler user-agent policy.
 *
 * Imported by the robots config (nuxt.config.ts) and — in later GEO phases — by
 * the bot-analytics middleware and the Vercel WAF runbook, so robots, edge rules,
 * and analytics never drift.
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
 * Bulk training / dataset crawlers — DISALLOWED in robots. The ones that send a
 * distinguishable user-agent are additionally hard-blocked at the edge (Vercel WAF,
 * Phase 3). Google-Extended / Applebot-Extended are training-PERMISSION tokens, not
 * crawlers — robots-only (no separate UA hits the edge).
 */
export const AI_TRAINING_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Meta-ExternalAgent',
] as const;

/** Standard search engines — left under the default `*` rules; listed for analytics. */
export const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'Amazonbot'] as const;

/** Private / non-indexable areas answer bots shouldn't waste crawl budget on. */
export const PRIVATE_DISALLOW = [
  '/admin',
  '/dashboard',
  '/profile',
  '/auth',
  '/login',
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

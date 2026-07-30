import { describe, it, expect } from 'vitest';
import {
  matchBot,
  AI_ANSWER_BOTS,
  AI_TRAINING_BOTS,
  AI_TRAINING_PERMISSION_TOKENS,
  EDGE_DENY_BOTS,
  WAF_DENY_REGEX,
} from '~/server/utils/aiBots';

describe('matchBot', () => {
  it('identifies answer/search/training bots with their category', () => {
    expect(matchBot('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toEqual({
      bot: 'PerplexityBot',
      category: 'answer',
    });
    expect(matchBot('Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)')).toEqual({
      bot: 'GPTBot',
      category: 'training',
    });
    expect(matchBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({
      bot: 'Googlebot',
      category: 'search',
    });
    expect(matchBot('OAI-SearchBot/1.0')?.category).toBe('answer');
  });

  it('matches the more specific Applebot-Extended (training) before Applebot (search)', () => {
    expect(matchBot('Applebot-Extended/1.0')).toEqual({ bot: 'Applebot-Extended', category: 'training' });
    expect(matchBot('Mozilla/5.0 (Applebot/0.1)')).toEqual({ bot: 'Applebot', category: 'search' });
  });

  it('returns null for normal browsers and empty input', () => {
    expect(matchBot('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605')).toBeNull();
    expect(matchBot('')).toBeNull();
    expect(matchBot(undefined)).toBeNull();
    expect(matchBot(null)).toBeNull();
  });

  it('keeps the policy lists coherent (answer vs training are disjoint)', () => {
    const overlap = AI_ANSWER_BOTS.filter((b) => (AI_TRAINING_BOTS as readonly string[]).includes(b));
    expect(overlap).toEqual([]);
  });

  it('classifies the edge-denied scrapers that robots.txt previously missed', () => {
    // Diffbot / Omgilibot / ImagesiftBot were in the WAF rule but not in this file
    // until 2026-07-30, so robots.txt never disallowed them and bot_crawl analytics
    // couldn't see them. Guard against that drift reappearing.
    for (const bot of ['Diffbot', 'Omgilibot', 'ImagesiftBot']) {
      expect(matchBot(`Mozilla/5.0 (compatible; ${bot}/1.0)`)).toEqual({ bot, category: 'training' });
      expect(AI_TRAINING_BOTS as readonly string[]).toContain(bot);
    }
  });
});

describe('Vercel WAF rule contract', () => {
  // The WAF regex lives in the Vercel console, NOT in this repo — nothing at runtime
  // reads WAF_DENY_REGEX. This block is the tripwire: editing EDGE_DENY_BOTS fails
  // here, and the only way to make it pass is to consciously update the expected
  // string, which is the moment you're reminded to publish the console rule too.
  // Runbook: docs/runbooks/2026-07-30-ai-crawler-firewall.md
  const LIVE_RULE_REGEX =
    '(GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|Meta-ExternalAgent|Diffbot|Omgilibot|ImagesiftBot)';

  it('matches the regex published on rule_block_ai_training_crawlers_nbb6RE', () => {
    expect(WAF_DENY_REGEX).toBe(LIVE_RULE_REGEX);
  });

  it('never denies a permission-only token at the edge (they send no crawler UA)', () => {
    for (const token of AI_TRAINING_PERMISSION_TOKENS) {
      expect(EDGE_DENY_BOTS as readonly string[]).not.toContain(token);
      expect(WAF_DENY_REGEX).not.toContain(token);
    }
  });

  it('never denies an answer or search bot at the edge', () => {
    const denied = new RegExp(WAF_DENY_REGEX);
    for (const bot of [...AI_ANSWER_BOTS, 'Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'Amazonbot']) {
      expect(denied.test(`Mozilla/5.0 (compatible; ${bot}/1.0)`), `${bot} must not be denied`).toBe(false);
    }
  });

  it('denies every edge-deny bot it claims to', () => {
    const denied = new RegExp(WAF_DENY_REGEX);
    for (const bot of EDGE_DENY_BOTS) {
      expect(denied.test(`Mozilla/5.0 (compatible; ${bot}/1.0)`), `${bot} must be denied`).toBe(true);
    }
  });
});

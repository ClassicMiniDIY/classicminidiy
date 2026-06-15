import { describe, it, expect } from 'vitest';
import { matchBot, AI_ANSWER_BOTS, AI_TRAINING_BOTS } from '~/server/utils/aiBots';

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
});

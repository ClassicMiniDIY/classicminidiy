import { describe, it, expect } from 'vitest';
import { classifyAiReferrer } from '~/app/utils/geo/aiReferrer';

describe('classifyAiReferrer', () => {
  it('classifies the major AI answer engines', () => {
    expect(classifyAiReferrer('https://chatgpt.com/')?.source).toBe('chatgpt');
    expect(classifyAiReferrer('https://chat.openai.com/c/abc')?.source).toBe('chatgpt');
    expect(classifyAiReferrer('https://www.perplexity.ai/search')?.source).toBe('perplexity');
    expect(classifyAiReferrer('https://gemini.google.com/app')?.source).toBe('gemini');
    expect(classifyAiReferrer('https://claude.ai/chat/x')?.source).toBe('claude');
    expect(classifyAiReferrer('https://copilot.microsoft.com/')?.source).toBe('copilot');
  });

  it('strips www and matches subdomains', () => {
    expect(classifyAiReferrer('https://www.perplexity.ai/')?.host).toBe('perplexity.ai');
    expect(classifyAiReferrer('https://foo.perplexity.ai/')?.source).toBe('perplexity');
  });

  it('returns null for non-AI referrers (incl. plain Google — use Search Console)', () => {
    expect(classifyAiReferrer('https://www.google.com/search?q=mini')).toBeNull();
    expect(classifyAiReferrer('https://example.com/')).toBeNull();
  });

  it('returns null for empty / malformed input', () => {
    expect(classifyAiReferrer('')).toBeNull();
    expect(classifyAiReferrer(null)).toBeNull();
    expect(classifyAiReferrer(undefined)).toBeNull();
    expect(classifyAiReferrer('not a url')).toBeNull();
  });
});

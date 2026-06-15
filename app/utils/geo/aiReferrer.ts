/**
 * Classify a referrer URL as coming from an AI answer engine, for GEO measurement.
 *
 * Real users arriving from ChatGPT/Perplexity/Gemini/Claude/Copilot send those
 * hosts as `document.referrer`. The PostHog plugin registers the result as an
 * `ai_source` super-property so every event in the session is filterable by it.
 *
 * Google AI Overviews are deliberately NOT detectable here — those clicks come
 * from google.com with no distinct referrer marker, so AI-Overview impact is read
 * from Search Console instead, not this classifier.
 *
 * Pure + deterministic → unit-tested in tests/unit/utils/ai-referrer.test.ts.
 */
export interface AiReferral {
  /** Stable source key for filtering (chatgpt | perplexity | gemini | claude | copilot). */
  source: string;
  /** The normalized referrer hostname (www. stripped). */
  host: string;
}

const AI_REFERRERS: { source: string; hosts: string[] }[] = [
  { source: 'chatgpt', hosts: ['chatgpt.com', 'chat.openai.com'] },
  { source: 'perplexity', hosts: ['perplexity.ai'] },
  { source: 'gemini', hosts: ['gemini.google.com', 'bard.google.com'] },
  { source: 'claude', hosts: ['claude.ai'] },
  { source: 'copilot', hosts: ['copilot.microsoft.com'] },
];

export function classifyAiReferrer(referrer: string | null | undefined): AiReferral | null {
  if (!referrer) return null;

  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  if (!host) return null;

  for (const entry of AI_REFERRERS) {
    if (entry.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { source: entry.source, host };
    }
  }
  return null;
}

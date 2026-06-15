/**
 * schema.org FAQPage builder. Returns a plain JSON-LD node (not a nuxt-schema-org
 * `define*` helper) so callers can drop it straight into a page's existing
 * `useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(...) }] })`
 * block — the convention the technical pages already use.
 *
 * GEO note: FAQPage / QAPage markup still measurably boosts how often a page is
 * pulled into AI answer summaries, even though Google retired the classic FAQ
 * rich-result UI. The VISIBLE counterpart (app/components/geo/QuickAnswer.vue) must
 * render the same questions/answers — Google requires FAQ markup to match on-page
 * content — so both are fed from the same {q,a}[] (see app/utils/geo/generateFaqs.ts).
 */

export interface Faq {
  /** The question, phrased the way a person would ask it. */
  q: string;
  /** A self-contained, answer-first response in plain text (no HTML). */
  a: string;
}

export interface FaqPageNode {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: { '@type': 'Answer'; text: string };
  }>;
}

/**
 * Build a FAQPage node from a list of Q&As. Empty/whitespace entries are dropped.
 * Returns `null` when there are no valid entries so callers can conditionally emit.
 */
export function buildFaqPage(faqs: Faq[]): FaqPageNode | null {
  const mainEntity = faqs
    .filter((f) => f && f.q?.trim() && f.a?.trim())
    .map((f) => ({
      '@type': 'Question' as const,
      name: f.q.trim(),
      acceptedAnswer: { '@type': 'Answer' as const, text: f.a.trim() },
    }));

  if (!mainEntity.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
}

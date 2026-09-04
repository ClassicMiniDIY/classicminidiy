/**
 * Types for the Classic Mini history corpus (`data/miniHistory.json`).
 *
 * The corpus exists because the assistant refused history outright — its prompt
 * said "Do not answer general trivia", so "what year was the Mini disqualified
 * from Monte Carlo?" got "that's outside what I cover" from a site whose whole
 * subject is the car. See
 * `docs/plans/2026-09-04-chat-agent-knowledge-expansion.md`.
 *
 * It is a CORPUS, not a database: hand-written entries covering the questions
 * people actually ask, searched in-process and fed to the model as source
 * material. The long tail is covered by allowlisted web search
 * (`data/trustedSources.ts`), which is why this file does not try to be
 * exhaustive and should not grow into a general encyclopaedia.
 *
 * Every entry is published on a site people trust for accuracy. Treat a change
 * here the way you would treat a change to a torque figure.
 */

export type HistoryCategory =
  /** Origins, the brief, and the engineering decisions behind the car. */
  | 'origins'
  /** Mark-by-mark model history and the dated changes between them. */
  | 'models'
  /** Cooper, Cooper S, and the performance line. */
  | 'cooper'
  /** Rallying and motorsport. */
  | 'competition'
  /** Badge-engineered siblings, bodystyles, and overseas assembly. */
  | 'variants'
  /** Production numbers, milestones, factories and company ownership. */
  | 'production'
  /** People, and the car's place in culture. */
  | 'culture';

export interface MiniHistoryEntry {
  /** Stable slug. Used in tests and cross-references, never shown to a reader. */
  id: string;
  title: string;
  category: HistoryCategory;
  /**
   * Human-readable period, e.g. "1959–1967" or "October 2000". Free text
   * because eras here are genuinely ragged — some entries are a single day,
   * some span two decades, and forcing them into numeric bounds invents
   * precision the history does not have.
   */
  period: string;
  /** One or two sentences. This is what a short answer quotes. */
  summary: string;
  /** The full entry. Prose, no markdown structure — the model formats it. */
  detail: string;
  /** Search synonyms and alternative names. Matched, never displayed. */
  tags: string[];
}

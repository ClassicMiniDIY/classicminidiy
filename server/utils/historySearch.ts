import Fuse from 'fuse.js';
import { rankByWord } from './fuzzyRank';
import historyCorpus from '../../data/miniHistory.json';
import type { MiniHistoryEntry } from '../../data/models/history';

/**
 * Search the Classic Mini history corpus.
 *
 * Static JSON, matched in process. No database, no network, no cache — the
 * corpus is a couple of dozen entries and lives in the bundle, so a lookup is
 * cheaper than the branch that would decide whether to cache it.
 *
 * The corpus exists because the assistant's prompt said "Do not answer general
 * trivia" and it therefore refused "what year was the Mini disqualified from
 * Monte Carlo?" outright. See
 * `docs/plans/2026-09-04-chat-agent-knowledge-expansion.md`.
 */

export const HISTORY_ENTRIES = historyCorpus as MiniHistoryEntry[];

export interface HistoryHit extends MiniHistoryEntry {
  /** 0-1, higher is better. Inverted from Fuse's distance, exactly once. */
  score: number;
}

/**
 * One Fuse index, built at module scope.
 *
 * The corpus is a frozen import, so rebuilding the index per call would be pure
 * waste — and on Workers a module-scope index is built once per isolate and
 * reused across every request that isolate serves.
 *
 * `tags` outweighs `title` deliberately. Titles are editorial ("The 1966 Monte
 * Carlo disqualification"); tags are the words people actually type
 * ("disqualified", "headlamps", "1966"), and they exist for no other purpose.
 * `detail` is included but weighted low: it is long, so without a low weight a
 * passing mention in one entry's prose outranks another entry that is entirely
 * about the subject.
 */
const fuse = new Fuse(HISTORY_ENTRIES, {
  keys: [
    { name: 'tags', weight: 0.4 },
    { name: 'title', weight: 0.3 },
    { name: 'summary', weight: 0.2 },
    { name: 'detail', weight: 0.1 },
  ],
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.4,
  minMatchCharLength: 3,
});

/**
 * Ranked WORD BY WORD via `rankByWord`, not as one fuzzy phrase.
 *
 * The phrase form was measurably wrong here: "when did production end" returned
 * the 1990 Cooper revival first, because its detail says the model went "back
 * into production" — over the entry that is entirely about the end of
 * production. Questions to this corpus are whole sentences far more often than
 * questions to the specification tools are, which makes it the worst place in
 * the codebase for phrase matching. See `server/utils/fuzzyRank.ts`.
 */
export function searchHistory(query: string, limit: number): HistoryHit[] {
  return rankByWord(fuse, query)
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item, score }));
}

/** Every entry in one category, for a broad question like "tell me about the Coopers". */
export function historyByCategory(category: string): MiniHistoryEntry[] {
  return HISTORY_ENTRIES.filter((entry) => entry.category === category);
}

/** The categories that actually appear in the corpus, for the tool's enum. */
export const HISTORY_CATEGORIES = [...new Set(HISTORY_ENTRIES.map((entry) => entry.category))].sort();

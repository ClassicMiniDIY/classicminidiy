import type Fuse from 'fuse.js';

/**
 * Rank a Fuse index against a query one WORD at a time, not as one phrase.
 *
 * This exists because the same bug appeared twice within an hour of each other,
 * in `youtubeCatalog.ts` and `historySearch.ts`, and would have appeared again
 * in the next thing to fuzzy-match a natural-language query.
 *
 * Fuse matches a multi-word query as a single fuzzy pattern per key. That means
 * one strongly-matching word can carry an entire phrase past a far better
 * result:
 *
 *   * "windscreen replacement" ranked a GEARBOX REBUILD first, because its
 *     description says "Synchro replacement".
 *   * "when did production end" ranked the COOPER REVIVAL first, because its
 *     detail says the model went "back into production".
 *
 * Both are the same failure. A query is a bag of words, and a result should
 * have to match more of them to win — so each word is searched separately and
 * the per-word scores are summed. A result matching two of three words beats
 * one matching a single word very well, and Fuse's own key weights still decide
 * which FIELD a word counts for, so a title hit outranks a description hit.
 *
 * The total is divided by the word count. Callers sort and threshold on this
 * value, and an unbounded sum would make a four-word query's third-best result
 * outrank a one-word query's best.
 */
export interface RankedHit<T> {
  item: T;
  /** 0-1, higher is better. Inverted from Fuse's distance exactly once, here. */
  score: number;
}

/**
 * Words shorter than this fuzzy-match nearly everything and flatten the
 * ranking. Fuse's own `minMatchCharLength` does not help: it governs the length
 * of a MATCH inside a value, not the length of the pattern.
 */
const MIN_WORD_LENGTH = 3;

/**
 * A result must match at least ONE word this well to be returned at all.
 *
 * Fuse's `threshold` does not do this job, which is easy to assume and wrong:
 * it gates the per-key match, while the score a caller sees is combined across
 * weighted keys and routinely exceeds it. Measured on the history corpus,
 * "sourdough starter hydration" returned four entries at distances of 0.57 to
 * 0.99 — noise by any reading — and lowering `threshold` from 0.4 to 0.2 did
 * not remove them.
 *
 * 0.5 keeps anything with one genuinely strong word and drops the rest. It is
 * applied to the BEST single word rather than to the average, because a long
 * question dilutes the average: "what year was the mini disqualified from monte
 * carlo" is nine searchable words, of which three match hard, and averaging
 * alone would push a correct answer under any floor worth having.
 */
const MIN_BEST_SCORE = 0.5;

/**
 * Words are weighted by how RARE they are in the corpus, not counted equally.
 *
 * Measured live, twice, and neither failure was hypothetical.
 *
 * First: asked how to fit a windscreen, the video rail put "Classic Mini DIY -
 * Headlight Replacement" first. Every title on the channel begins "Classic
 * Mini", so those two words matched hundreds of videos and every one banked a
 * full word's score.
 *
 * Second, after a flat cutoff was added for that: the query "windshield
 * replacement" produced scores of 0.442 for the headlight video and 0.440 for
 * the windscreen one. A genuine tie — each matched exactly one of the two words
 * about equally well. But "windshield" identifies one video on the channel and
 * "replacement" identifies dozens, and counting them equally is what made those
 * two numbers land a thousandth apart.
 *
 * Inverse document frequency is the standard answer and it subsumes the cutoff
 * it replaced: a word matching the whole corpus gets a weight near zero without
 * anyone choosing a percentage, and a word matching one document dominates. It
 * degrades gracefully on a small corpus too, which the cutoff did not — on the
 * 23-entry history corpus a 40% rule discarded "production" from "when did
 * production end" and returned nothing at all, where a weight merely makes it
 * count for less than "end".
 *
 * `log(1 + N/df)`: a word in every document scores log(2) ≈ 0.69 rather than
 * zero, so a query made entirely of boilerplate still ranks by something
 * instead of collapsing to an empty result.
 *
 * The document frequencies are free. Each word was already being searched
 * separately; `results.length` IS its document frequency.
 */
function inverseDocumentFrequency(corpusSize: number, documentFrequency: number): number {
  return Math.log(1 + corpusSize / documentFrequency);
}

export function rankByWord<T>(fuse: Fuse<T>, query: string): RankedHit<T>[] {
  const words = query.split(/\s+/).filter((word) => word.length >= MIN_WORD_LENGTH);
  // A query made ENTIRELY of short words ("mk1", "su", "a35") must still search
  // something rather than searching nothing.
  const patterns = words.length ? words : [query.trim()];
  if (!patterns[0]) return [];

  // Fuse keeps the indexed collection on `_docs`. Falling back to the largest
  // result set keeps the weighting sane if that internal ever moves: every
  // frequency is then measured against the same denominator, so the RELATIVE
  // weights — which are all that ordering depends on — still hold.
  const perWord = patterns.map((pattern) => fuse.search(pattern)).filter((results) => results.length > 0);
  if (!perWord.length) return [];

  const corpusSize =
    (fuse as unknown as { _docs?: unknown[] })._docs?.length ?? Math.max(...perWord.map((r) => r.length));

  // Keyed by object identity. Fuse returns references into the collection it
  // was built from, so the same item found by two different words is the same
  // object — no id accessor needed, and no way for a caller to pass the wrong one.
  const hits = new Map<T, { weighted: number; best: number }>();
  let totalWeight = 0;

  for (const results of perWord) {
    const weight = inverseDocumentFrequency(corpusSize, results.length);
    totalWeight += weight;

    for (const { item, score } of results) {
      const value = 1 - (score ?? 0);
      const existing = hits.get(item);
      if (existing) {
        existing.weighted += value * weight;
        // `best` is the UNWEIGHTED match quality, and must stay that way: it
        // gates whether a result is returned at all, and a rare word would
        // otherwise let a poor match through on weight alone.
        existing.best = Math.max(existing.best, value);
      } else {
        hits.set(item, { weighted: value * weight, best: value });
      }
    }
  }

  return (
    [...hits.entries()]
      .filter(([, { best }]) => best >= MIN_BEST_SCORE)
      // Normalised by the total weight of the words that matched anything, so the
      // result stays a 0-1 figure comparable between a one-word query and a
      // sentence. Words that matched nothing are excluded from both sides.
      .map(([item, { weighted }]) => ({ item, score: Number((weighted / totalWeight).toFixed(3)) }))
      .sort((a, b) => b.score - a.score)
  );
}

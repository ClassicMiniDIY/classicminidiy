// @vitest-environment node
import { describe, it, expect } from 'vitest';
import Fuse from 'fuse.js';
import { rankByWord } from '~~/server/utils/fuzzyRank';

/**
 * The shared word-by-word ranker.
 *
 * It exists because the same bug landed twice in one sitting — a multi-word
 * query matched as one fuzzy phrase let a single strong word carry a wrong
 * result to the top, in `youtubeCatalog` and again in `historySearch`. These
 * tests hold the two properties that fix it, so the third caller inherits them.
 */
interface Row {
  title: string;
  body: string;
}

const rows: Row[] = [
  { title: 'Replacing a windscreen', body: 'Removing the old glass and fitting new rubber.' },
  { title: 'Rebuilding a gearbox', body: 'Synchro replacement and selector fork inspection.' },
  { title: 'Fitting a new clutch', body: 'Clutch and release bearing on an A-series.' },
];

function index() {
  return new Fuse(rows, {
    keys: [
      { name: 'title', weight: 0.75 },
      { name: 'body', weight: 0.25 },
    ],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.4,
    minMatchCharLength: 3,
  });
}

describe('rankByWord', () => {
  it('does not let one shared word carry a phrase to the top', () => {
    // The original failure. As a single phrase, "windscreen replacement" ranked
    // the gearbox first because its body says "Synchro replacement".
    const [hit] = rankByWord(index(), 'windscreen replacement');
    expect(hit!.item.title).toBe('Replacing a windscreen');
  });

  it('rewards matching more of the query', () => {
    const ranked = rankByWord(index(), 'gearbox synchro');
    // Matches both words; the clutch row matches neither.
    expect(ranked[0]!.item.title).toBe('Rebuilding a gearbox');
    expect(ranked.map((hit) => hit.item.title)).not.toContain('Fitting a new clutch');
  });

  it('returns nothing for a query about something else entirely', () => {
    // Fuse's own `threshold` does NOT do this — it gates the per-key match while
    // the combined weighted score routinely exceeds it. Measured on the history
    // corpus, this query returned four entries at distances of 0.57 to 0.99, and
    // lowering the threshold to 0.2 did not remove them. The floor on the best
    // single-word match is what does.
    expect(rankByWord(index(), 'sourdough starter hydration')).toEqual([]);
  });

  it('still searches a query made entirely of short words', () => {
    // Words under three characters are dropped as too fuzzy, but dropping ALL of
    // them would mean searching nothing. "su" and "mk1" are real queries here.
    const fuse = new Fuse([{ title: 'SU carburettor', body: 'needles' }], {
      keys: ['title', 'body'],
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4,
    });
    expect(rankByWord(fuse, 'su').length).toBe(1);
  });

  it('scores higher-is-better, bounded at one', () => {
    const [hit] = rankByWord(index(), 'gearbox');
    expect(hit!.score).toBeGreaterThan(0.5);
    expect(hit!.score).toBeLessThanOrEqual(1);
  });

  it('stays a bounded 0-1 score however long the query is', () => {
    // Callers sort and threshold on this number, so an unbounded sum would make
    // a long query's third-best result outrank a short query's best.
    for (const query of ['gearbox', 'how do i rebuild a gearbox on a classic mini at home']) {
      const [hit] = rankByWord(index(), query);
      expect(hit!.score, query).toBeGreaterThan(0);
      expect(hit!.score, query).toBeLessThanOrEqual(1);
    }
  });

  it('is not diluted by filler words that match nothing', () => {
    // Words matching no document are excluded from BOTH sides of the average,
    // so padding a question with "how do i" costs a result nothing. Under the
    // earlier plain word-count divisor it cost it three quarters of its score.
    const bare = rankByWord(index(), 'gearbox')[0]!.score;
    const padded = rankByWord(index(), 'how do i sort out my gearbox')[0]!.score;
    expect(padded).toBeCloseTo(bare, 1);
  });

  it('ignores a word that matches most of a large corpus', () => {
    // MEASURED LIVE. Asked how to fit a windscreen, the video rail put
    // "Classic Mini DIY - Headlight Replacement" first: every title on the
    // channel begins "Classic Mini", so both those words matched hundreds of
    // videos and every one banked a full word's score, drowning the one video
    // that actually matched "windscreen".
    const boilerplate = Array.from({ length: 120 }, (_, i) => ({
      title: `Classic Mini DIY - Video ${i}`,
      body: 'general content',
    }));
    const target = { title: 'Classic Mini DIY - Windscreen Replacement', body: 'fitting the glass' };
    const fuse = new Fuse([...boilerplate, target], {
      keys: [
        { name: 'title', weight: 0.75 },
        { name: 'body', weight: 0.25 },
      ],
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4,
      minMatchCharLength: 3,
    });

    const ranked = rankByWord(fuse, 'classic mini windscreen');
    expect(ranked[0]!.item.title).toBe(target.title);
  });

  it('does not apply the share rule to a small corpus', () => {
    // "Matches 40% of the corpus" is a claim about a population and stops being
    // one on a handful of documents. Applied to the 23-entry history corpus it
    // dropped the most important word in "when did production end" and returned
    // nothing — worse than the ranking it was added to fix.
    const small = [
      { title: 'End of production', body: 'The last car left the line in 2000.' },
      { title: 'Cooper returns to production', body: 'Back in the catalogue from 1990.' },
    ];
    const fuse = new Fuse(small, {
      keys: ['title', 'body'],
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4,
      minMatchCharLength: 3,
    });
    // "production" matches both — 100% of this corpus — and must still count.
    expect(rankByWord(fuse, 'when did production end')[0]!.item.title).toBe('End of production');
  });

  it('returns an empty list for an empty query rather than throwing', () => {
    expect(rankByWord(index(), '')).toEqual([]);
    expect(rankByWord(index(), '   ')).toEqual([]);
  });
});

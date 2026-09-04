// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { HISTORY_ENTRIES, HISTORY_CATEGORIES, historyByCategory, searchHistory } from '~~/server/utils/historySearch';

/**
 * The history corpus, and the search over it.
 *
 * The corpus exists because the assistant's prompt said "Do not answer general
 * trivia" and it duly refused "what year was the Mini disqualified from Monte
 * Carlo?" — from a site whose entire subject is the car. The first test below
 * is that exact question.
 */
describe('the history corpus', () => {
  it('is well formed', () => {
    expect(HISTORY_ENTRIES.length).toBeGreaterThan(10);
    expect(new Set(HISTORY_ENTRIES.map((e) => e.id)).size).toBe(HISTORY_ENTRIES.length);

    for (const entry of HISTORY_ENTRIES) {
      expect(entry.id, 'ids are kebab-case slugs').toMatch(/^[a-z0-9-]+$/);
      // "Mk1" is a legitimate three-character title.
      expect(entry.title.length).toBeGreaterThanOrEqual(3);
      expect(entry.period.length).toBeGreaterThan(3);
      // The summary is what a short answer quotes and the detail is what a long
      // one draws on. An entry with a thin detail is a stub pretending to be a
      // source, which is worse than not having the entry.
      expect(entry.summary.length, `${entry.id} has no usable summary`).toBeGreaterThan(40);
      expect(entry.detail.length, `${entry.id} has no usable detail`).toBeGreaterThan(150);
      expect(entry.tags.length, `${entry.id} has no search tags`).toBeGreaterThan(1);
    }
  });

  it('covers the categories the tool advertises', () => {
    // HISTORY_CATEGORIES is interpolated into the tool's input schema, so a
    // category listed there with no entries is a documented dead end.
    for (const category of HISTORY_CATEGORIES) {
      expect(historyByCategory(category).length, `no entries in "${category}"`).toBeGreaterThan(0);
    }
  });
});

describe('searchHistory', () => {
  it('answers the question that started all this', () => {
    const [hit] = searchHistory('what year was the mini disqualified from monte carlo', 3);
    expect(hit!.id).toBe('monte-carlo-1966-disqualification');
    expect(hit!.detail).toContain('1966');
  });

  it('finds an entry by a word only its tags carry', () => {
    // Tags outweigh titles for exactly this reason: titles are editorial, tags
    // are what people type. "headlamps" appears in no title.
    const [hit] = searchHistory('headlamps', 3);
    expect(hit!.id).toBe('monte-carlo-1966-disqualification');
  });

  it('separates the wins from the disqualification', () => {
    // Two entries about the same rally in adjacent years. Asking about the wins
    // must not return the year they were taken away, and vice versa.
    const [hit] = searchHistory('who won the monte carlo rally', 3);
    expect(hit!.id).toBe('monte-carlo-wins');
  });

  it('finds production numbers and the end of production', () => {
    expect(searchHistory('how many minis were made', 2)[0]!.id).toBe('production-and-final-car');
    expect(searchHistory('when did production end', 2)[0]!.id).toBe('production-and-final-car');
  });

  it('reports score as higher-is-better', () => {
    const [hit] = searchHistory('issigonis', 3);
    expect(hit!.score).toBeGreaterThan(0.5);
    expect(hit!.score).toBeLessThanOrEqual(1);
  });

  it('honours the limit and returns nothing for an unrelated query', () => {
    expect(searchHistory('mini', 2).length).toBeLessThanOrEqual(2);
    expect(searchHistory('sourdough starter hydration', 3)).toEqual([]);
  });
});

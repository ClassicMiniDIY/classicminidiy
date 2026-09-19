import { describe, expect, it } from 'vitest';
import { cardExcerpt } from '~/utils/cardExcerpt';

describe('cardExcerpt', () => {
  it('returns empty for nothing', () => {
    expect(cardExcerpt(null, 50)).toBe('');
    expect(cardExcerpt('   ', 50)).toBe('');
  });

  it('collapses whitespace and leaves short text alone', () => {
    expect(cardExcerpt('Idler  gear\n1st motion', 50)).toBe('Idler gear 1st motion');
  });

  it('cuts at a word boundary with an ellipsis', () => {
    const out = cardExcerpt('Idler gear to first motion shaft bearing housing', 20);
    expect(out).toBe('Idler gear to first…');
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it('cuts mid-word when the only space is too early', () => {
    expect(cardExcerpt('A verylongunbrokentokenwithoutspaces', 12)).toBe('A verylongu…');
  });
});

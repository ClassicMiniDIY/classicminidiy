import { describe, it, expect } from 'vitest';
import { buildItemList } from '~/app/utils/schema/itemList';

const opts = { name: 'Classic Mini Listings', url: 'https://www.classicminidiy.com/exchange/listings' };

describe('buildItemList', () => {
  it('builds a positioned ItemList from entries', () => {
    const node = buildItemList(
      [
        { name: '1991 Mini Cooper', url: 'https://www.classicminidiy.com/exchange/listings/a' },
        { name: 'Gearbox Casing', url: 'https://www.classicminidiy.com/exchange/listings/b' },
      ],
      opts
    );

    expect(node).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Classic Mini Listings',
      numberOfItems: 2,
    });
    expect(node!.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(node!.itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      name: '1991 Mini Cooper',
      url: 'https://www.classicminidiy.com/exchange/listings/a',
    });
  });

  it('omits optional image and description rather than emitting empty keys', () => {
    const node = buildItemList([{ name: 'A', url: 'https://x.test/a', image: null, description: null }], opts);
    expect(node!.itemListElement[0]).not.toHaveProperty('image');
    expect(node!.itemListElement[0]).not.toHaveProperty('description');
  });

  it('includes image and description when present', () => {
    const node = buildItemList(
      [{ name: 'A', url: 'https://x.test/a', image: 'https://x.test/a.jpg', description: '  hi  ' }],
      opts
    );
    expect(node!.itemListElement[0]).toMatchObject({ image: 'https://x.test/a.jpg', description: 'hi' });
  });

  it('drops entries missing a name or url', () => {
    const node = buildItemList(
      [
        { name: '', url: 'https://x.test/a' },
        { name: 'B', url: '   ' },
        { name: 'C', url: 'https://x.test/c' },
      ],
      opts
    );
    expect(node!.numberOfItems).toBe(1);
    expect(node!.itemListElement[0]!.name).toBe('C');
  });

  it('renumbers positions contiguously after dropping invalid entries', () => {
    const node = buildItemList(
      [
        { name: 'A', url: 'https://x.test/a' },
        { name: '', url: 'https://x.test/bad' },
        { name: 'C', url: 'https://x.test/c' },
      ],
      opts
    );
    expect(node!.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });

  it('respects the limit and reports numberOfItems as the emitted count', () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({ name: `Item ${i}`, url: `https://x.test/${i}` }));
    const node = buildItemList(entries, { ...opts, limit: 10 });
    expect(node!.numberOfItems).toBe(10);
    expect(node!.itemListElement).toHaveLength(10);
  });

  it('returns null when nothing valid remains', () => {
    expect(buildItemList([], opts)).toBeNull();
    expect(buildItemList([{ name: '  ', url: '  ' }], opts)).toBeNull();
  });
});

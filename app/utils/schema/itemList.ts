/**
 * schema.org ItemList builder.
 *
 * Same convention as `faqPage.ts`: returns a plain JSON-LD node rather than a
 * nuxt-schema-org `define*` helper, so callers drop it into the `useHead({ script:
 * [{ type: 'application/ld+json', … }] })` block the pages already use.
 *
 * GEO note: the marketplace browse pages fetch their results client-side (the
 * results region is inside `<ClientOnly>`), so a crawler — and the AI answer bots
 * we allow in robots.txt, most of which don't execute JavaScript — sees an empty
 * list. An ItemList emitted during SSR is what tells those engines what the page
 * actually contains and gives them named, linkable entries to cite. Lists and
 * tables are extracted preferentially by LLMs, which is why this is worth having
 * even where the visible list is client-rendered.
 */

export interface ItemListEntry {
  /** Human-readable name of the item. */
  name: string;
  /** Absolute URL of the item's detail page. */
  url: string;
  /** Optional absolute image URL. */
  image?: string | null;
  /** Optional short description. */
  description?: string | null;
}

export interface ItemListNode {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  name: string;
  url: string;
  numberOfItems: number;
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    url: string;
    name: string;
    image?: string;
    description?: string;
  }>;
}

export interface BuildItemListOptions {
  /** Name of the collection, e.g. "Classic Mini Listings". */
  name: string;
  /** Absolute URL of the list page itself. */
  url: string;
  /** Cap on emitted entries. Keeps the payload sane on large collections. */
  limit?: number;
}

/**
 * Build an ItemList node. Entries missing a name or url are dropped; returns
 * `null` when nothing valid remains so callers can conditionally emit.
 */
export function buildItemList(entries: ItemListEntry[], options: BuildItemListOptions): ItemListNode | null {
  const { name, url, limit = 30 } = options;

  const itemListElement = entries
    .filter((e) => e && e.name?.trim() && e.url?.trim())
    .slice(0, limit)
    .map((e, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      url: e.url.trim(),
      name: e.name.trim(),
      ...(e.image ? { image: e.image } : {}),
      ...(e.description ? { description: e.description.trim() } : {}),
    }));

  if (!itemListElement.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: itemListElement.length,
    itemListElement,
  };
}

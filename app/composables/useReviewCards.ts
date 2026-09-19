/**
 * The TypeSafe review cards for one admin surface: a map id → card, filled
 * from `/api/admin/review/fill` (which computes any that are missing, five
 * per call). A hint beside each item; the item's own buttons still decide.
 */
export interface ReviewCard {
  hint: Record<string, unknown> | null;
  decision: string | null;
}

export function useReviewCards(surface: 'listings' | 'finds' | 'wanted' | 'archive' | 'models') {
  const cards = ref<Record<string, ReviewCard>>({});

  async function fill(ids: string[]) {
    const wanted = ids.filter((id) => !cards.value[id]);
    if (!wanted.length) return;
    try {
      const res = await $adminFetch<{ cards: Record<string, ReviewCard> }>('/api/admin/review/fill', {
        method: 'POST',
        body: { surface, ids: wanted },
      });
      cards.value = { ...cards.value, ...res.cards };
    } catch {
      // A card is a hint; the page works without it.
    }
  }

  return { cards, fill };
}

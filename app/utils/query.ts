/**
 * Apply consistent photo ordering to a Supabase query that includes listing_photos.
 * Orders by is_primary (true first) then by display_order (ascending).
 */
export function applyPhotoOrdering<T extends { order: (...args: any[]) => T }>(query: T): T {
  return query
    .order('is_primary', { referencedTable: 'listing_photos', ascending: false })
    .order('display_order', { referencedTable: 'listing_photos', ascending: true });
}

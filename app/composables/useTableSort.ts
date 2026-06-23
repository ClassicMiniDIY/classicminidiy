/**
 * Reusable table sorting composable for admin pages.
 * Provides sort state, toggle handler, icon helper, and a comparator function.
 */
export function useTableSort(defaultColumn: string = 'created_at', defaultDirection: 'asc' | 'desc' = 'desc') {
  const sortColumn = ref(defaultColumn);
  const sortDirection = ref<'asc' | 'desc'>(defaultDirection);

  /** Toggle sort on a column. Clicking the active column flips direction; clicking a new column defaults to desc. */
  const toggleSort = (column: string) => {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn.value = column;
      sortDirection.value = 'desc';
    }
  };

  /** Returns Font Awesome 6 classes for a column header (CMDIY uses inline
   *  <i class="fas ..."> — not the <Icon> component). Bind directly: <i :class="getSortIcon('col')">. */
  const getSortIcon = (column: string): string => {
    if (sortColumn.value !== column) return 'fas fa-sort';
    return sortDirection.value === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  };

  /** Check if a column is the current sort column. */
  const isSortedBy = (column: string): boolean => {
    return sortColumn.value === column;
  };

  /** Comparator function for Array.sort(). Supports dot-notation for nested properties. */
  const sortFn = (a: Record<string, any>, b: Record<string, any>): number => {
    const col = sortColumn.value;

    const getValue = (obj: Record<string, any>, path: string) => {
      return path.split('.').reduce((o, k) => o?.[k], obj);
    };

    let aVal = getValue(a, col);
    let bVal = getValue(b, col);

    // Nulls sort to the end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Case-insensitive string comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    const direction = sortDirection.value === 'asc' ? 1 : -1;
    if (aVal < bVal) return -1 * direction;
    if (aVal > bVal) return 1 * direction;
    return 0;
  };

  return {
    sortColumn,
    sortDirection,
    toggleSort,
    getSortIcon,
    isSortedBy,
    sortFn,
  };
}

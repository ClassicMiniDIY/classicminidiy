import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupGlobalMocks, cleanupGlobalMocks, createMockUser } from '../../../setup/testHelpers';

// useTableSort is a PURE UI composable: it manages local sort state (sortColumn,
// sortDirection refs) and exposes pure helpers (toggleSort, getSortIcon,
// isSortedBy, sortFn). It has NO Supabase / auth / $fetch / toast dependency.
// We still follow the canonical setupGlobalMocks/cleanupGlobalMocks lifecycle
// (per the test-suite convention) and import the composable via the same
// dynamic-import-after-resetModules pattern as useProfile.test.ts so module
// state never leaks between tests.
const getUseTableSort = async () => {
  vi.resetModules();
  const mod = await import('~/composables/useTableSort');
  return mod.useTableSort;
};

beforeEach(() => {
  setupGlobalMocks({ user: createMockUser() });
});

afterEach(() => {
  cleanupGlobalMocks();
});

describe('useTableSort', () => {
  // ---------------------------------------------------------------------------
  // Initialization / default args
  // ---------------------------------------------------------------------------
  describe('initialization', () => {
    it("defaults to created_at column and desc direction when called with no args", async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection } = useTableSort();

      expect(sortColumn.value).toBe('created_at');
      expect(sortDirection.value).toBe('desc');
    });

    it('honors an explicit initial sort column', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection } = useTableSort('name');

      expect(sortColumn.value).toBe('name');
      // direction still defaults to desc when only the column is provided
      expect(sortDirection.value).toBe('desc');
    });

    it('honors an explicit initial sort column AND direction', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection } = useTableSort('price', 'asc');

      expect(sortColumn.value).toBe('price');
      expect(sortDirection.value).toBe('asc');
    });

    it('exposes sortColumn and sortDirection as reactive refs', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection } = useTableSort();

      // refs have a mutable .value
      expect(sortColumn).toHaveProperty('value');
      expect(sortDirection).toHaveProperty('value');
      sortColumn.value = 'manual';
      expect(sortColumn.value).toBe('manual');
    });

    it('returns the full public API surface', async () => {
      const useTableSort = await getUseTableSort();
      const api = useTableSort();

      expect(Object.keys(api).sort()).toEqual(
        ['getSortIcon', 'isSortedBy', 'sortColumn', 'sortDirection', 'sortFn', 'toggleSort'].sort()
      );
    });

    it('returns independent state per invocation (no shared module singleton)', async () => {
      const useTableSort = await getUseTableSort();
      const a = useTableSort('name', 'asc');
      const b = useTableSort('price', 'desc');

      a.toggleSort('name'); // flips a -> desc
      expect(a.sortDirection.value).toBe('desc');
      // b is untouched
      expect(b.sortColumn.value).toBe('price');
      expect(b.sortDirection.value).toBe('desc');
    });
  });

  // ---------------------------------------------------------------------------
  // toggleSort()
  // ---------------------------------------------------------------------------
  describe('toggleSort()', () => {
    it('flips the active column from asc -> desc', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection, toggleSort } = useTableSort('name', 'asc');

      toggleSort('name');

      expect(sortColumn.value).toBe('name');
      expect(sortDirection.value).toBe('desc');
    });

    it('flips the active column from desc -> asc', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection, toggleSort } = useTableSort('name', 'desc');

      toggleSort('name');

      expect(sortColumn.value).toBe('name');
      expect(sortDirection.value).toBe('asc');
    });

    it('round-trips asc -> desc -> asc on repeated toggles of the same column', async () => {
      const useTableSort = await getUseTableSort();
      const { sortDirection, toggleSort } = useTableSort('name', 'asc');

      toggleSort('name');
      expect(sortDirection.value).toBe('desc');
      toggleSort('name');
      expect(sortDirection.value).toBe('asc');
      toggleSort('name');
      expect(sortDirection.value).toBe('desc');
    });

    it('switching to a NEW column resets direction to desc (regardless of prior direction)', async () => {
      const useTableSort = await getUseTableSort();
      // start asc on a different column to prove the reset is unconditional
      const { sortColumn, sortDirection, toggleSort } = useTableSort('created_at', 'asc');

      toggleSort('price');

      expect(sortColumn.value).toBe('price');
      expect(sortDirection.value).toBe('desc');
    });

    it('switching from a desc column to a new column stays desc (new column default)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection, toggleSort } = useTableSort('created_at', 'desc');

      toggleSort('name');

      expect(sortColumn.value).toBe('name');
      expect(sortDirection.value).toBe('desc');
    });

    it('switch-then-toggle: new column lands desc, toggling it flips to asc', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection, toggleSort } = useTableSort('name', 'asc');

      toggleSort('price'); // new column -> desc
      expect(sortColumn.value).toBe('price');
      expect(sortDirection.value).toBe('desc');

      toggleSort('price'); // same column -> asc
      expect(sortDirection.value).toBe('asc');
    });

    it('toggling back to the original column after switching treats it as a NEW column (desc), not a resume', async () => {
      const useTableSort = await getUseTableSort();
      const { sortColumn, sortDirection, toggleSort } = useTableSort('name', 'asc');

      toggleSort('price'); // -> price desc
      toggleSort('name'); // back to name: it is no longer the active column, so resets to desc

      expect(sortColumn.value).toBe('name');
      expect(sortDirection.value).toBe('desc');
    });
  });

  // ---------------------------------------------------------------------------
  // getSortIcon()
  // ---------------------------------------------------------------------------
  describe('getSortIcon()', () => {
    it('returns the neutral fa-sort icon for a non-active column', async () => {
      const useTableSort = await getUseTableSort();
      const { getSortIcon } = useTableSort('name', 'asc');

      expect(getSortIcon('price')).toBe('fas fa-sort');
    });

    it('returns fa-sort-up for the active column when sorted asc', async () => {
      const useTableSort = await getUseTableSort();
      const { getSortIcon } = useTableSort('name', 'asc');

      expect(getSortIcon('name')).toBe('fas fa-sort-up');
    });

    it('returns fa-sort-down for the active column when sorted desc', async () => {
      const useTableSort = await getUseTableSort();
      const { getSortIcon } = useTableSort('name', 'desc');

      expect(getSortIcon('name')).toBe('fas fa-sort-down');
    });

    it('reacts to toggleSort: neutral -> down (new col defaults desc) -> up', async () => {
      const useTableSort = await getUseTableSort();
      const { getSortIcon, toggleSort } = useTableSort('created_at', 'desc');

      expect(getSortIcon('name')).toBe('fas fa-sort'); // not active yet
      toggleSort('name'); // becomes active, desc
      expect(getSortIcon('name')).toBe('fas fa-sort-down');
      toggleSort('name'); // flips to asc
      expect(getSortIcon('name')).toBe('fas fa-sort-up');
    });

    it('uses Font Awesome 6 solid (fas) classes only — never an Icon-component name', async () => {
      const useTableSort = await getUseTableSort();
      const { getSortIcon } = useTableSort('name', 'asc');

      for (const icon of [getSortIcon('name'), getSortIcon('other')]) {
        expect(icon.startsWith('fas ')).toBe(true);
        expect(icon).not.toMatch(/i-fa6|heroicons|lucide/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // isSortedBy()
  // ---------------------------------------------------------------------------
  describe('isSortedBy()', () => {
    it('returns true for the active column', async () => {
      const useTableSort = await getUseTableSort();
      const { isSortedBy } = useTableSort('name', 'asc');

      expect(isSortedBy('name')).toBe(true);
    });

    it('returns false for a non-active column', async () => {
      const useTableSort = await getUseTableSort();
      const { isSortedBy } = useTableSort('name', 'asc');

      expect(isSortedBy('price')).toBe(false);
    });

    it('is direction-agnostic (true for active column regardless of asc/desc)', async () => {
      const useTableSort = await getUseTableSort();
      const { isSortedBy, toggleSort } = useTableSort('name', 'asc');

      expect(isSortedBy('name')).toBe(true);
      toggleSort('name'); // flip to desc
      expect(isSortedBy('name')).toBe(true);
    });

    it('tracks the active column after switching columns', async () => {
      const useTableSort = await getUseTableSort();
      const { isSortedBy, toggleSort } = useTableSort('name', 'asc');

      toggleSort('price');
      expect(isSortedBy('price')).toBe(true);
      expect(isSortedBy('name')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sortFn() — comparator for Array.prototype.sort
  // ---------------------------------------------------------------------------
  describe('sortFn() — strings', () => {
    it('sorts strings ascending, case-insensitively', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      const rows = [{ name: 'banana' }, { name: 'Apple' }, { name: 'cherry' }];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.name)).toEqual(['Apple', 'banana', 'cherry']);
    });

    it('sorts strings descending, case-insensitively', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'desc');

      const rows = [{ name: 'banana' }, { name: 'Apple' }, { name: 'cherry' }];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.name)).toEqual(['cherry', 'banana', 'Apple']);
    });

    it('treats equal strings (differing only in case) as a tie -> returns 0', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      expect(sortFn({ name: 'Mini' }, { name: 'mini' })).toBe(0);
    });

    it('reflects the live direction ref when comparing (asc result is the inverse sign of desc)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn, toggleSort } = useTableSort('name', 'asc');

      const a = { name: 'apple' };
      const b = { name: 'banana' };
      expect(sortFn(a, b)).toBe(-1); // asc: apple before banana
      toggleSort('name'); // -> desc
      expect(sortFn(a, b)).toBe(1); // desc: apple after banana
    });
  });

  describe('sortFn() — numbers', () => {
    it('sorts numbers ascending using numeric (not lexicographic) ordering', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('price', 'asc');

      const rows = [{ price: 100 }, { price: 9 }, { price: 25 }];
      const sorted = [...rows].sort(sortFn);

      // numeric ordering: 9 < 25 < 100 (lexicographic would give 100, 25, 9)
      expect(sorted.map((r) => r.price)).toEqual([9, 25, 100]);
    });

    it('sorts numbers descending', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('price', 'desc');

      const rows = [{ price: 100 }, { price: 9 }, { price: 25 }];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.price)).toEqual([100, 25, 9]);
    });

    it('handles negative numbers and zero correctly', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('balance', 'asc');

      const rows = [{ balance: 0 }, { balance: -50 }, { balance: 10 }, { balance: -1 }];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.balance)).toEqual([-50, -1, 0, 10]);
    });

    it('returns 0 for equal numbers', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('price', 'asc');

      expect(sortFn({ price: 42 }, { price: 42 })).toBe(0);
    });
  });

  describe('sortFn() — dates', () => {
    it('sorts ISO date strings ascending (lexicographic ISO order == chronological)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('created_at', 'asc');

      const rows = [
        { created_at: '2026-03-01T00:00:00Z' },
        { created_at: '2024-12-31T00:00:00Z' },
        { created_at: '2025-06-15T00:00:00Z' },
      ];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.created_at)).toEqual([
        '2024-12-31T00:00:00Z',
        '2025-06-15T00:00:00Z',
        '2026-03-01T00:00:00Z',
      ]);
    });

    it('sorts ISO date strings descending (newest first — the admin default)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('created_at', 'desc');

      const rows = [
        { created_at: '2026-03-01T00:00:00Z' },
        { created_at: '2024-12-31T00:00:00Z' },
        { created_at: '2025-06-15T00:00:00Z' },
      ];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.created_at)).toEqual([
        '2026-03-01T00:00:00Z',
        '2025-06-15T00:00:00Z',
        '2024-12-31T00:00:00Z',
      ]);
    });

    it('sorts Date objects via relational operators (valueOf comparison)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('when', 'asc');

      const early = new Date('2024-01-01');
      const mid = new Date('2025-01-01');
      const late = new Date('2026-01-01');
      const rows = [{ when: late }, { when: early }, { when: mid }];
      const sorted = [...rows].sort(sortFn);

      // assert on epoch millis (timezone-agnostic) rather than getFullYear()
      expect(sorted.map((r) => r.when.getTime())).toEqual([
        early.getTime(),
        mid.getTime(),
        late.getTime(),
      ]);
    });
  });

  describe('sortFn() — nulls / undefined ordering', () => {
    it('sorts null/undefined to the END in ascending order', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      const rows = [{ name: 'b' }, { name: null }, { name: 'a' }, { name: undefined }];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.name)).toEqual(['a', 'b', null, undefined]);
    });

    it('keeps null/undefined at the END even in descending order (direction does NOT flip nulls)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'desc');

      const rows = [{ name: 'b' }, { name: null }, { name: 'a' }, { name: undefined }];
      const sorted = [...rows].sort(sortFn);

      // The null/undefined short-circuit returns ±1 BEFORE the direction
      // multiplier is applied, so nulls always sink to the bottom regardless
      // of asc/desc. Real (non-null) values are still desc-ordered.
      expect(sorted.map((r) => r.name)).toEqual(['b', 'a', null, undefined]);
    });

    it('returns 0 when both values are null', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      expect(sortFn({ name: null }, { name: null })).toBe(0);
    });

    it('returns 0 when both values are undefined', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      expect(sortFn({ name: undefined }, { name: undefined })).toBe(0);
    });

    it('treats null and undefined as equivalent (both nullish, == null) -> 0', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      // `aVal == null` is true for both null and undefined, so the "both null"
      // branch returns 0.
      expect(sortFn({ name: null }, { name: undefined })).toBe(0);
    });

    it('null sorts after a present value (a=null -> +1) irrespective of direction', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      expect(sortFn({ name: null }, { name: 'a' })).toBe(1); // null goes last
      expect(sortFn({ name: 'a' }, { name: null })).toBe(-1); // present goes first
    });

    it('treats a missing property as nullish and sinks it to the end', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      // getValue returns undefined for an absent key
      const rows = [{ other: 1 } as Record<string, any>, { name: 'a' }, { name: 'b' }];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.name)).toEqual(['a', 'b', undefined]);
    });
  });

  describe('sortFn() — dot-notation nested paths', () => {
    it('reads a nested property via dot-notation column', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('seller.name', 'asc');

      const rows = [
        { seller: { name: 'Charlie' } },
        { seller: { name: 'Alice' } },
        { seller: { name: 'Bob' } },
      ];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.seller.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('handles a missing intermediate object via optional chaining -> treated as null (sorts to end)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('seller.name', 'asc');

      const rows = [
        { seller: { name: 'Bob' } },
        {} as Record<string, any>, // seller is undefined -> seller?.name is undefined
        { seller: { name: 'Alice' } },
      ];
      const sorted = [...rows].sort(sortFn);

      const names = sorted.map((r) => r.seller?.name);
      expect(names[0]).toBe('Alice');
      expect(names[1]).toBe('Bob');
      expect(names[2]).toBeUndefined();
    });

    it('sorts nested numeric values numerically', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('stats.views', 'desc');

      const rows = [
        { stats: { views: 5 } },
        { stats: { views: 100 } },
        { stats: { views: 30 } },
      ];
      const sorted = [...rows].sort(sortFn);

      expect(sorted.map((r) => r.stats.views)).toEqual([100, 30, 5]);
    });
  });

  describe('sortFn() — integration with toggleSort and full table re-sort', () => {
    it('re-sorts an array when the column is switched via toggleSort', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn, toggleSort } = useTableSort('name', 'asc');

      const rows = [
        { name: 'Zed', price: 10 },
        { name: 'Abe', price: 99 },
        { name: 'Mae', price: 50 },
      ];

      // initial: by name asc
      expect([...rows].sort(sortFn).map((r) => r.name)).toEqual(['Abe', 'Mae', 'Zed']);

      // switch to price (new column -> desc)
      toggleSort('price');
      expect([...rows].sort(sortFn).map((r) => r.price)).toEqual([99, 50, 10]);

      // flip price to asc
      toggleSort('price');
      expect([...rows].sort(sortFn).map((r) => r.price)).toEqual([10, 50, 99]);
    });

    it('is a stable, side-effect-free comparator (does not mutate input rows)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      const a = { name: 'b' };
      const b = { name: 'a' };
      const aSnapshot = { ...a };
      const bSnapshot = { ...b };
      sortFn(a, b);
      expect(a).toEqual(aSnapshot);
      expect(b).toEqual(bSnapshot);
    });

    it('sorts an empty array to an empty array (no comparator invocation)', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      expect([].sort(sortFn)).toEqual([]);
    });

    it('leaves a single-element array unchanged', async () => {
      const useTableSort = await getUseTableSort();
      const { sortFn } = useTableSort('name', 'asc');

      const rows = [{ name: 'only' }];
      expect([...rows].sort(sortFn)).toEqual(rows);
    });
  });
});

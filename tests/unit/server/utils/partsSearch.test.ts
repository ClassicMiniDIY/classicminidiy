/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadVisiblePartSources,
  visibleSourceFilter,
  searchVisibleParts,
  findVisiblePart,
} from '~~/server/utils/partsSearch';

// ---------------------------------------------------------------------------
// The parts kill switch, now in one place.
//
// Three service-role consumers (the /archive/parts route, the parts-lookup MCP
// tool, omnisearch) bypass the RLS that hides a `declined` source from anon.
// Each used to carry its own copy of the guard; this helper is the single
// copy, and the load-bearing assertions are that a declined source never
// appears and that an unreadable source list returns NOTHING, not everything.
// ---------------------------------------------------------------------------

let tables: Record<string, { data: unknown; error: unknown }> = {};
let partsFilters: Array<[string, unknown]> = [];

function builderFor(table: string) {
  const filters: Array<[string, unknown]> = [];
  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push(['eq', `${column}=${value}`]);
      return builder;
    },
    or: (expression: string) => {
      filters.push(['or', expression]);
      return builder;
    },
    order: () => builder,
    limit: () => {
      if (table === 'parts') partsFilters = filters;
      return Promise.resolve(tables[table] ?? { data: [], error: null });
    },
    then: (ok: any, err?: any) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(ok, err),
  };
  return builder;
}

const db = { from: (table: string) => builderFor(table) } as any;

const LIVE = { id: 'src-live', name: 'Mini Spares', domain: 'minispares.com', licence_status: 'none' };
const DECLINED = { id: 'src-declined', name: 'Declined Co', domain: 'declined.example', licence_status: 'declined' };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  partsFilters = [];
  tables = {
    part_sources: { data: [LIVE, DECLINED], error: null },
    parts: {
      data: [
        {
          part_number_display: '12G940',
          part_number_norm: '12G940',
          description: 'Cylinder head',
          kind: null,
          system: 'Engine',
          source_id: LIVE.id,
        },
      ],
      error: null,
    },
  };
});

describe('loadVisiblePartSources', () => {
  it('drops a declined source and keeps the rest', async () => {
    const sources = await loadVisiblePartSources(db);
    expect(sources?.visibleIds).toEqual([LIVE.id]);
    expect(sources?.sourceById.has(DECLINED.id)).toBe(false);
  });

  it('fails closed: an unreadable source list is null, never an empty allow-all', async () => {
    tables.part_sources = { data: null, error: { message: 'permission denied' } };
    expect(await loadVisiblePartSources(db)).toBeNull();
  });
});

describe('visibleSourceFilter', () => {
  it('keeps our own sourceless parts visible alongside the allowed sources', () => {
    expect(visibleSourceFilter(['a', 'b'])).toBe('source_id.is.null,source_id.in.(a,b)');
  });
});

describe('searchVisibleParts', () => {
  it('constrains the parts query to published rows inside the visible sources', async () => {
    const hits = await searchVisibleParts(db, '12g940', 10);
    expect(hits).toEqual([
      {
        partNumber: '12G940',
        slug: '12G940',
        description: 'Cylinder head',
        kind: null,
        system: 'Engine',
        sourceName: 'Mini Spares',
      },
    ]);
    expect(partsFilters).toContainEqual(['eq', 'status=published']);
    expect(partsFilters).toContainEqual(['or', `source_id.is.null,source_id.in.(${LIVE.id})`]);
  });

  it('returns nothing when the source list cannot be read', async () => {
    tables.part_sources = { data: null, error: { message: 'permission denied' } };
    expect(await searchVisibleParts(db, '12g940', 10)).toEqual([]);
  });

  it('returns nothing when every source is declined', async () => {
    tables.part_sources = { data: [DECLINED], error: null };
    expect(await searchVisibleParts(db, '12g940', 10)).toEqual([]);
    expect(partsFilters).toEqual([]);
  });

  it('returns nothing for input the filter builder rejects, rather than an unfiltered query', async () => {
    expect(await searchVisibleParts(db, '%%', 10)).toEqual([]);
    expect(partsFilters).toEqual([]);
  });

  it('uses a preloaded source list without reading part_sources again', async () => {
    const preloaded = { visible: [LIVE], visibleIds: [LIVE.id], sourceById: new Map([[LIVE.id, LIVE]]) };
    tables.part_sources = { data: null, error: { message: 'must not be read' } };
    const hits = await searchVisibleParts(db, '12g940', 10, preloaded);
    expect(hits).toHaveLength(1);
  });
});

describe('findVisiblePart', () => {
  it('matches the normalised number by equality inside the kill switch', async () => {
    const hit = await findVisiblePart(db, '12g-940');
    expect(hit?.slug).toBe('12G940');
    expect(partsFilters).toContainEqual(['eq', 'status=published']);
    expect(partsFilters).toContainEqual(['or', `source_id.is.null,source_id.in.(${LIVE.id})`]);
    expect(partsFilters).toContainEqual(['eq', 'part_number_norm=12G940']);
  });

  it('is null when the sources cannot be read, when none are visible, or when preloaded null', async () => {
    tables.part_sources = { data: null, error: { message: 'boom' } };
    expect(await findVisiblePart(db, '12G940')).toBeNull();
    tables.part_sources = { data: [DECLINED], error: null };
    expect(await findVisiblePart(db, '12G940')).toBeNull();
    expect(await findVisiblePart(db, '12G940', null)).toBeNull();
  });

  it('is null for a number that reduces to nothing', async () => {
    expect(await findVisiblePart(db, '-')).toBeNull();
    expect(partsFilters).toEqual([]);
  });
});

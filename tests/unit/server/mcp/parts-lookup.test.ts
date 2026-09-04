/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// parts-lookup MCP tool.
//
// The load-bearing test here is the kill switch. Every other consumer of parts
// data is protected by RLS; this tool runs on the service role, which BYPASSES
// RLS, so a source set to `declined` on /admin/parts stays exposed through the
// public API unless the tool filters it out itself. That is the entire point of
// the switch, so it gets asserted rather than assumed.
// ---------------------------------------------------------------------------

let tables: Record<string, { data: unknown; error: unknown }> = {};
let lastPartsFilters: Array<[string, unknown]> = [];

function builderFor(table: string) {
  const filters: Array<[string, unknown]> = [];
  const builder: any = {
    select: () => builder,
    eq: (c: string, v: unknown) => {
      filters.push(['eq', `${c}=${v}`]);
      return builder;
    },
    or: (expr: string) => {
      filters.push(['or', expr]);
      return builder;
    },
    in: (c: string, v: unknown) => {
      filters.push(['in', c]);
      return builder;
    },
    order: () => builder,
    limit: () => {
      if (table === 'parts') lastPartsFilters = filters;
      return Promise.resolve(tables[table] ?? { data: [], error: null });
    },
    then: (ok: any, err?: any) => {
      if (table === 'parts') lastPartsFilters = filters;
      return Promise.resolve(tables[table] ?? { data: [], error: null }).then(ok, err);
    },
  };
  return builder;
}

vi.stubGlobal('defineMcpTool', (def: any) => def);
vi.stubGlobal('jsonResult', (payload: any) => ({ kind: 'json', payload }));
vi.stubGlobal('errorResult', (message: string) => ({ kind: 'error', message }));
vi.mock('~/server/utils/supabase', () => ({
  getServiceClient: () => ({ from: (t: string) => builderFor(t) }),
}));

const tool = (await import('~~/server/mcp/tools/parts-lookup')).default as any;

const SOMERFORD = {
  id: 'src-somerford',
  name: 'Somerford Mini',
  domain: 'somerfordmini.co.uk',
  licence_status: 'none',
};
const DECLINED = { id: 'src-declined', name: 'Declined Co', domain: 'declined.example', licence_status: 'declined' };

const PART = {
  id: 'part-1',
  part_number_norm: '12G2994',
  part_number_display: '12G2994',
  description: 'Idler gear bearing',
  kind: null,
  system: null,
  category: null,
  source_id: SOMERFORD.id,
};

beforeEach(() => {
  vi.clearAllMocks();
  lastPartsFilters = [];
  tables = {
    part_sources: { data: [SOMERFORD, DECLINED], error: null },
    parts: { data: [PART], error: null },
    part_supersessions: { data: [], error: null },
    part_applicability: { data: [], error: null },
    part_diagram_callouts: { data: [], error: null },
  };
});

describe('parts-lookup', () => {
  it('needs either a partNumber or a query', async () => {
    const res = await tool.handler({ includeSupersessions: true, limit: 10 });
    expect(res.kind).toBe('error');
  });

  it('EXCLUDES a declined source from the query it sends', async () => {
    // The tool bypasses RLS, so if this filter regresses a source that asked us
    // to stop stays served through the public API.
    await tool.handler({ partNumber: '12G2994', includeSupersessions: true, limit: 10 });
    const orClause = lastPartsFilters.find(([kind]) => kind === 'or')?.[1] as string;
    expect(orClause).toContain(SOMERFORD.id);
    expect(orClause).not.toContain(DECLINED.id);
  });

  it('returns nothing at all when the source list cannot be read (fails closed)', async () => {
    tables.part_sources = { data: null, error: { message: 'boom' } };
    const res = await tool.handler({ partNumber: '12G2994', includeSupersessions: true, limit: 10 });
    expect(res.kind).toBe('error');
  });

  it('only ever asks for published parts', async () => {
    await tool.handler({ partNumber: '12G2994', includeSupersessions: true, limit: 10 });
    expect(lastPartsFilters).toContainEqual(['eq', 'status=published']);
  });

  it('normalises case, hyphens and dots on an exact number', async () => {
    await tool.handler({ partNumber: '12g-29.94', includeSupersessions: true, limit: 10 });
    expect(lastPartsFilters).toContainEqual(['eq', 'part_number_norm=12G2994']);
  });

  it('puts the supersession in formattedText, not just the payload', async () => {
    // A superseded number quoted without its replacement is a confidently wrong
    // answer, and formattedText is what the chat agent actually reads back.
    tables.part_supersessions = {
      data: [
        {
          predecessor_id: 'part-1',
          successor_id: 'part-2',
          relation: 'supersedes',
          successor: { part_number_display: '12G2994SS' },
          predecessor: { part_number_display: '12G2994' },
        },
      ],
      error: null,
    };
    const res = await tool.handler({ partNumber: '12G2994', includeSupersessions: true, limit: 10 });
    expect(res.payload.matches[0].replacedBy[0].partNumber).toBe('12G2994SS');
    expect(res.payload.formattedText).toContain('SUPERSEDED BY 12G2994SS');
  });

  it('gives an actionable miss rather than an error', async () => {
    tables.parts = { data: [], error: null };
    const res = await tool.handler({ partNumber: 'NOSUCHPART', includeSupersessions: true, limit: 10 });
    expect(res.kind).toBe('json');
    expect(res.payload.totalMatches).toBe(0);
    expect(res.payload.hint).toBeTruthy();
  });

  it('credits the source on every match', async () => {
    // Attribution is mitigation 1 of the design, not decoration.
    const res = await tool.handler({ partNumber: '12G2994', includeSupersessions: true, limit: 10 });
    expect(res.payload.matches[0].source).toMatchObject({ name: 'Somerford Mini' });
  });
});

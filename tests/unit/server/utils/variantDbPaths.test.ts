/**
 * The database paths of the Model Variants read side and approvals, against a
 * small in-memory stand-in for the PostgREST query builder. The real schema
 * behaviour (CHECKs, upsert on the PK, unique primary photo) was exercised
 * against a local Supabase stack when this landed; these tests pin the call
 * sequence and the payloads.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

/** A chainable fake over named in-memory tables. Supports what the code under test calls. */
function fakeDb(tables: Record<string, Row[]>, opts: { failInsertOnce?: { table: string; code: string } } = {}) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  let failOnce = opts.failInsertOnce;
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op = 'select';
    let payload: any;
    let single = false;
    let maybe = false;
    let head = false;
    let range: [number, number] | null = null;
    const b: any = {
      select: (_cols?: string, o?: { head?: boolean }) => {
        head = Boolean(o?.head);
        return b;
      },
      eq: (col: string, val: unknown) => {
        if (!col.includes('.')) filters.push((r) => r[col] === val);
        return b;
      },
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), b),
      not: (col: string, op: string, val: unknown) => (
        filters.push((r) => (op === 'is' && val === null ? r[col] !== null && r[col] !== undefined : r[col] !== val)),
        b
      ),
      like: (col: string, pat: string) => (filters.push((r) => String(r[col]).startsWith(pat.replace('%', ''))), b),
      order: () => b,
      limit: () => b,
      range: (a: number, z: number) => ((range = [a, z]), b),
      single: () => ((single = true), b),
      maybeSingle: () => ((maybe = true), b),
      insert: (p: unknown) => ((op = 'insert'), (payload = p), b),
      upsert: (p: unknown) => ((op = 'upsert'), (payload = p), b),
      update: (p: unknown) => ((op = 'update'), (payload = p), b),
      delete: () => ((op = 'delete'), b),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    const run = () => {
      calls.push({ table, op, payload });
      const rows = (tables[table] ??= []);
      const match = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'insert') {
        if (failOnce && failOnce.table === table) {
          const code = failOnce.code;
          failOnce = undefined;
          return { data: null, error: { code, message: `fake ${code}` } };
        }
        const list = (Array.isArray(payload) ? payload : [payload]).map((p: Row) => ({
          id: `id-${rows.length + 1}`,
          ...p,
        }));
        rows.push(...list);
        return { data: single ? list[0] : list, error: null };
      }
      if (op === 'upsert') {
        for (const p of payload as Row[]) {
          const i = rows.findIndex((r) => r.variant_id === p.variant_id && r.color_name === p.color_name);
          if (i >= 0) rows[i] = { ...rows[i], ...p };
          else rows.push({ ...p });
        }
        return { data: null, error: null };
      }
      if (op === 'update') {
        match.forEach((r) => Object.assign(r, payload));
        return { data: null, error: null };
      }
      if (op === 'delete') {
        tables[table] = rows.filter((r) => !match.includes(r));
        return { data: null, error: null };
      }
      if (head) return { count: match.length, data: null, error: null };
      const page = range ? match.slice(range[0], range[1] + 1) : match;
      if (single) return match[0] ? { data: match[0], error: null } : { data: null, error: { message: 'no rows' } };
      if (maybe) return { data: match[0] ?? null, error: null };
      return { data: page, error: null };
    };
    return b;
  };
  return { from, calls, tables };
}

let current: ReturnType<typeof fakeDb>;
vi.mock('../../../../server/utils/supabase', () => ({ getServiceClient: () => current }));

const SOURCE = { type: 'brochure', title: 'Factory sales brochure 2224/B' };
const SUB = 'sub-1';
const OWN = `https://auth.test/storage/v1/object/public/archive-variants/uploads/${SUB}/a.jpg`;

vi.mock('../../../../server/utils/archiveApprovals', () => ({
  isOwnUploadUrl: (url: string, id: string) => url.includes(`/uploads/${id}/`),
}));

describe('variant approvals against the query builder', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('inserts a new variant with its slug, colours (linked case-insensitively) and a primary photo', async () => {
    current = fakeDb({
      model_variants: [],
      colors: [{ id: 'c-red', name: 'Tartan Red', status: 'approved', created_at: '2020' }],
    });
    const { insertApprovedVariant } = await import('../../../../server/utils/variantApprovals');
    const err = await insertApprovedVariant(
      current,
      {
        variant: {
          name: 'Mini Test',
          marque: 'mini',
          family: 'special',
          body_style: 'saloon',
          year_start: '1990',
          mark: '5',
          engine_cc: '998',
        },
        colours: 'tartan red, Flame Red',
        source: SOURCE,
        uploadedFiles: [{ url: OWN }, { url: 'https://evil.example/x.jpg' }],
        photo_kind: 'owner',
        photo_credit: 'Me',
      },
      'user-1',
      SUB
    );
    expect(err).toBeNull();
    const v = current.tables.model_variants![0]!;
    expect(v).toMatchObject({
      slug: 'mini-test-mk5',
      status: 'approved',
      submitted_by: 'user-1',
      mark: 5,
      engine_cc: 998,
    });
    expect(v.sources[0]).toMatchObject({ type: 'brochure', title: SOURCE.title });
    expect(current.tables.model_variant_colors).toEqual([
      expect.objectContaining({ color_name: 'tartan red', color_id: 'c-red', sort_order: 0 }),
      expect.objectContaining({ color_name: 'Flame Red', color_id: null, sort_order: 1 }),
    ]);
    expect(current.tables.model_variant_photos).toEqual([
      expect.objectContaining({ url: OWN, is_primary: true, submitted_by: 'user-1', credit: 'Me' }),
    ]);
  });

  it('suffixes a taken slug', async () => {
    current = fakeDb({
      model_variants: [{ id: 'x', slug: 'mini-test-mk5', marque: 'mini', name: 'Other', year_start: 1990 }],
    });
    const { insertApprovedVariant } = await import('../../../../server/utils/variantApprovals');
    const err = await insertApprovedVariant(
      current,
      {
        variant: {
          name: 'Mini Test',
          marque: 'mini',
          family: 'special',
          body_style: 'saloon',
          year_start: '1991',
          mark: '5',
        },
        source: SOURCE,
      },
      null,
      SUB
    );
    expect(err).toBeNull();
    expect(current.tables.model_variants!.map((r) => r.slug)).toContain('mini-test-mk5-2');
  });

  it('applies a spec fix, appends the source, and replaces colours without emptying them', async () => {
    current = fakeDb({
      model_variants: [
        {
          id: 'v1',
          power_bhp: 75,
          year_start: 1964,
          year_end: 1967,
          sources: [{ type: 'web_archive', title: 'seed' }],
        },
      ],
      model_variant_colors: [
        { variant_id: 'v1', color_name: 'Old One', sort_order: 0 },
        { variant_id: 'v1', color_name: 'Keep Me', sort_order: 1 },
      ],
      colors: [],
    });
    const { applyVariantEdit } = await import('../../../../server/utils/variantApprovals');
    expect(
      await applyVariantEdit(
        current,
        'v1',
        { changes: { power_bhp: { from: '75', to: '76' } }, source: SOURCE },
        'u',
        SUB
      )
    ).toBeNull();
    expect(current.tables.model_variants![0]).toMatchObject({ power_bhp: 76 });
    expect(current.tables.model_variants![0]!.sources).toHaveLength(2);

    expect(
      await applyVariantEdit(
        current,
        'v1',
        { changes: { colours: { to: 'Keep Me, New One' } }, source: SOURCE },
        'u',
        SUB
      )
    ).toBeNull();
    expect(current.tables.model_variant_colors!.map((c) => c.color_name).sort()).toEqual(['Keep Me', 'New One']);
    // Upsert happened before the prune: never a moment with zero colours.
    const colourOps = current.calls.filter((c) => c.table === 'model_variant_colors').map((c) => c.op);
    expect(colourOps.indexOf('upsert')).toBeLessThan(colourOps.indexOf('delete'));
  });

  it('refuses a year edit that would put the end before the start', async () => {
    current = fakeDb({ model_variants: [{ id: 'v1', year_start: 1964, year_end: 1967, sources: [] }] });
    const { applyVariantEdit } = await import('../../../../server/utils/variantApprovals');
    expect(
      await applyVariantEdit(current, 'v1', { changes: { year_start: { to: '1970' } }, source: SOURCE }, 'u', SUB)
    ).toMatch(/cannot be before/);
  });

  it('adds photos as non-primary when one exists, and retries non-primary on a race', async () => {
    current = fakeDb({ model_variant_photos: [{ variant_id: 'v1', url: 'old', is_primary: true, sort_order: 3 }] });
    const { applyVariantEdit } = await import('../../../../server/utils/variantApprovals');
    expect(await applyVariantEdit(current, 'v1', { uploadedFiles: [OWN] }, 'u', SUB)).toBeNull();
    expect(current.tables.model_variant_photos![1]).toMatchObject({ url: OWN, is_primary: false, sort_order: 4 });

    current = fakeDb(
      { model_variant_photos: [] },
      { failInsertOnce: { table: 'model_variant_photos', code: '23505' } }
    );
    const again = await import('../../../../server/utils/variantApprovals');
    expect(await again.applyVariantEdit(current, 'v2', { uploadedFiles: [OWN] }, 'u', SUB)).toBeNull();
    expect(current.tables.model_variant_photos![0]).toMatchObject({ is_primary: false });
  });
});

describe('modelVariants loader', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const row = (slug: string, extra: Row = {}) => ({
    id: `id-${slug}`,
    slug,
    name: slug,
    marque: 'mini',
    family: 'saloon',
    body_style: 'saloon',
    mark: 3,
    market: 'uk',
    year_start: 1970,
    status: 'approved',
    updated_at: '2026-09-22',
    model_variant_colors: [{ color_name: 'Red', color_id: 'c1', sort_order: 0 }],
    model_variant_photos: [],
    ...extra,
  });

  it('loads approved rows once, serves lookups, filters by colour, and relates siblings', async () => {
    current = fakeDb({ model_variants: [row('a'), row('b'), row('c', { status: 'pending' })] });
    const mv = await import('../../../../server/utils/modelVariants');
    expect((await mv.loadModelVariants()).map((v) => v.slug)).toEqual(['a', 'b']);
    expect((await mv.getModelVariant('b'))?.id).toBe('id-b');
    expect((await mv.getModelVariantById('id-a'))?.slug).toBe('a');
    expect(await mv.getModelVariant('c')).toBeNull();
    expect((await mv.listModelVariants({ colorId: 'c1' })).length).toBe(2);
    expect((await mv.getModelVariantFacets()).total).toBe(2);
    expect((await mv.relatedModelVariantsFor((await mv.getModelVariant('a'))!)).map((r) => r.slug)).toEqual(['b']);
    const reads = current.calls.filter((c) => c.table === 'model_variants').length;
    await mv.loadModelVariants();
    expect(current.calls.filter((c) => c.table === 'model_variants').length).toBe(reads);
  });

  it('refetches after an invalidate and serves the stale snapshot if the refetch fails', async () => {
    current = fakeDb({ model_variants: [row('a')] });
    const mv = await import('../../../../server/utils/modelVariants');
    await mv.loadModelVariants();
    current.tables.model_variants!.push(row('b'));
    mv.invalidateModelVariants();
    expect((await mv.loadModelVariants()).map((v) => v.slug)).toEqual(['a', 'b']);

    mv.invalidateModelVariants();
    const broken = current.from;
    (current as any).from = () => {
      const b: any = {};
      for (const k of ['select', 'eq', 'order', 'range']) b[k] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: null, error: { message: 'down' } });
      return b;
    };
    expect((await mv.loadModelVariants()).map((v) => v.slug)).toEqual(['a', 'b']);
    (current as any).from = broken;
  });

  it('throws when the first load fails with nothing cached', async () => {
    current = fakeDb({});
    (current as any).from = () => {
      const b: any = {};
      for (const k of ['select', 'eq', 'order', 'range']) b[k] = () => b;
      b.then = (res: (v: unknown) => unknown) => res({ data: null, error: { message: 'down' } });
      return b;
    };
    const mv = await import('../../../../server/utils/modelVariants');
    await expect(mv.loadModelVariants()).rejects.toThrow(/down/);
  });
});

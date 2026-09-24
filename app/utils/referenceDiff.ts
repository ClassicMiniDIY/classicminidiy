/**
 * Row-level diff of a reference-data draft against the current version, for
 * /admin/reference. Arrays of records with a `name` (needles) diff by name;
 * other arrays by position; objects by top-level key, one level down into
 * `items` arrays when both sides have them (torque, clearances, suggested
 * needles). Purely for display: the publish rules run in the Edge Function.
 */
export interface ReferenceDiffLine {
  kind: 'added' | 'removed' | 'changed';
  path: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diffArray(before: unknown[], after: unknown[], at: string, out: ReferenceDiffLine[]) {
  const named = (arr: unknown[]) => arr.every((r) => isRecord(r) && typeof r.name === 'string');
  if (named(before) && named(after)) {
    const b = new Map(before.map((r) => [(r as { name: string }).name, r]));
    const a = new Map(after.map((r) => [(r as { name: string }).name, r]));
    for (const [name, row] of a) {
      if (!b.has(name)) out.push({ kind: 'added', path: `${at}${name}` });
      else if (!same(b.get(name), row)) out.push({ kind: 'changed', path: `${at}${name}` });
    }
    for (const name of b.keys()) if (!a.has(name)) out.push({ kind: 'removed', path: `${at}${name}` });
    return;
  }
  const n = Math.max(before.length, after.length);
  for (let i = 0; i < n; i++) {
    if (i >= before.length) out.push({ kind: 'added', path: `${at}#${i + 1}` });
    else if (i >= after.length) out.push({ kind: 'removed', path: `${at}#${i + 1}` });
    else if (!same(before[i], after[i])) out.push({ kind: 'changed', path: `${at}#${i + 1}` });
  }
}

export function diffReferencePayload(before: unknown, after: unknown): ReferenceDiffLine[] {
  const out: ReferenceDiffLine[] = [];
  if (Array.isArray(before) && Array.isArray(after)) {
    diffArray(before, after, '', out);
  } else if (isRecord(before) && isRecord(after)) {
    for (const key of Object.keys(after)) {
      if (!(key in before)) {
        out.push({ kind: 'added', path: key });
      } else if (!same(before[key], after[key])) {
        const b = before[key];
        const a = after[key];
        if (
          isRecord(b) &&
          isRecord(a) &&
          Array.isArray(b.items) &&
          Array.isArray(a.items) &&
          same({ ...b, items: 0 }, { ...a, items: 0 })
        ) {
          diffArray(b.items, a.items, `${key} › `, out);
        } else {
          out.push({ kind: 'changed', path: key });
        }
      }
    }
    for (const key of Object.keys(before)) if (!(key in after)) out.push({ kind: 'removed', path: key });
  } else if (!same(before, after)) {
    out.push({ kind: 'changed', path: '(root)' });
  }
  return out;
}

/**
 * Approving Model Variants contributions (target_type = 'variant').
 *
 * Imported by `server/api/admin/queue/approve.post.ts`; never copied into a
 * second approval surface (the same rule as `archiveApprovals.ts`).
 *
 * Every value here arrives in `submission_queue.data`, which the BROWSER writes
 * — so it is attacker-controlled until validated: enums against the closed
 * vocabularies, numbers parsed, text capped, columns allowlisted
 * (`VARIANT_EDITABLE_COLUMNS`), photo URLs pinned to this submission's own
 * upload prefix (`isOwnUploadUrl`). A reclassification (marque / family / mark
 * / market) is never applied from a suggestion; an admin edits it directly.
 *
 * Trust is fed by the database trigger on `submission_queue` when the route
 * flips the row to approved; this module only has to write `submitted_by` on
 * the rows it creates (new variants, photos).
 *
 * Payload shapes written by `ContributeWizard.vue` (`kind: 'variant'`):
 *   new variant   { variant: {...}, colours: string[], source }
 *   spec fix      { changes: { <column>: { from, to } }, source, reason? }
 *   colour fix    { changes: { colours: { from, to: 'A, B, C' } }, source }
 *   photos        { photo_kind, photo_caption?, photo_credit? } + uploadedFiles
 */
import { isOwnUploadUrl } from './archiveApprovals';
import { invalidateModelVariants } from './modelVariants';
import {
  MARK_RANGES,
  VARIANT_BODIES,
  VARIANT_EDITABLE_COLUMNS,
  VARIANT_FAMILIES,
  VARIANT_FUEL_SYSTEMS,
  VARIANT_MARKETS,
  VARIANT_MARQUES,
  VARIANT_NUMERIC_COLUMNS,
  VARIANT_PHOTO_KINDS,
  VARIANT_SOURCE_TYPES,
} from '../../data/models/variants';

type Db = any;

const EDITABLE: ReadonlySet<string> = new Set(VARIANT_EDITABLE_COLUMNS);
const MAX_COLOURS = 60;

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

/** '' / null clears; anything else must be a finite number. */
export function parseVariantNumber(v: unknown): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return { ok: true, value: null };
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

export interface VariantSourceInput {
  type: (typeof VARIANT_SOURCE_TYPES)[number];
  title: string;
  url?: string;
  accessed: string;
}

/** A contributor's citation, or null when it is missing or malformed. */
export function parseVariantSource(raw: unknown): VariantSourceInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = oneOf(VARIANT_SOURCE_TYPES, r.type);
  const title = text(r.title, 300);
  if (!type || !title || title.length < 3) return null;
  const url = text(r.url, 500);
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return null;
  return { type, title, ...(url ? { url } : {}), accessed: new Date().toISOString().slice(0, 10) };
}

/** Comma/newline-separated colour names, trimmed, de-duplicated case-insensitively. */
export function parseColourList(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\n;]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const name = text(p, 120);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length >= MAX_COLOURS) break;
  }
  return out;
}

export function slugifyVariant(name: string, mark: number | null): string {
  const base = `${name}${mark && !/\bmk\s?\d\b/i.test(name) ? ` mk${mark}` : ''}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return base || 'variant';
}

async function uniqueSlug(db: Db, base: string): Promise<string> {
  const { data } = await db.from('model_variants').select('slug').like('slug', `${base}%`);
  const taken = new Set<string>((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Colour names → approved colours-archive ids, oldest row per name (the archive has same-name duplicates). */
async function resolveColourIds(db: Db, names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!names.length) return out;
  const { data } = await db
    .from('colors')
    .select('id, name, created_at')
    .eq('status', 'approved')
    .in('name', names)
    .order('created_at', { ascending: true });
  for (const c of data ?? []) {
    const key = String(c.name).trim().toLowerCase();
    if (!out.has(key)) out.set(key, c.id);
  }
  return out;
}

async function replaceColours(db: Db, variantId: string, names: string[]): Promise<string | null> {
  const ids = await resolveColourIds(db, names);
  const { error: delError } = await db.from('model_variant_colors').delete().eq('variant_id', variantId);
  if (delError) return delError.message;
  if (!names.length) return null;
  const { error } = await db.from('model_variant_colors').insert(
    names.map((name, i) => ({
      variant_id: variantId,
      color_name: name,
      color_id: ids.get(name.toLowerCase()) ?? null,
      sort_order: i,
    }))
  );
  return error?.message ?? null;
}

function ownPhotoUrls(data: Record<string, unknown>, submissionId: string): string[] {
  const uploaded = Array.isArray(data.uploadedFiles) ? data.uploadedFiles : [];
  return [
    ...new Set(
      uploaded
        .map((f: any) => (typeof f === 'string' ? f : f?.url))
        .filter((u: unknown): u is string => typeof u === 'string')
        .filter((u) => isOwnUploadUrl(u, submissionId))
    ),
  ];
}

async function insertPhotos(
  db: Db,
  variantId: string,
  urls: string[],
  data: Record<string, unknown>,
  submittedBy: string | null
): Promise<string | null> {
  if (!urls.length) return null;
  const { count } = await db
    .from('model_variant_photos')
    .select('id', { count: 'exact', head: true })
    .eq('variant_id', variantId)
    .eq('is_primary', true);
  const { data: last } = await db
    .from('model_variant_photos')
    .select('sort_order')
    .eq('variant_id', variantId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const start = (last?.[0]?.sort_order ?? -1) + 1;
  const kind = oneOf(VARIANT_PHOTO_KINDS, data.photo_kind) ?? 'owner';
  const { error } = await db.from('model_variant_photos').insert(
    urls.map((url, i) => ({
      variant_id: variantId,
      url,
      kind,
      caption: text(data.photo_caption, 200),
      credit: text(data.photo_credit, 120),
      is_primary: !count && i === 0,
      sort_order: start + i,
      status: 'approved',
      submitted_by: submittedBy,
    }))
  );
  return error?.message ?? null;
}

/** New variant (`new_item`). Returns an error message or null. */
export async function insertApprovedVariant(
  db: Db,
  data: Record<string, any>,
  submittedBy: string | null,
  submissionId: string
): Promise<string | null> {
  const v = (data.variant ?? {}) as Record<string, unknown>;
  const name = text(v.name, 160);
  const marque = oneOf(VARIANT_MARQUES, v.marque);
  const family = oneOf(VARIANT_FAMILIES, v.family);
  const body = oneOf(VARIANT_BODIES, v.body_style);
  const market = oneOf(VARIANT_MARKETS, v.market) ?? 'uk';
  if (!name || !marque || !family || !body) return 'A new variant needs a name, marque, family and body style';

  const source = parseVariantSource(data.source);
  if (!source) return 'A new variant needs a source (type and citation)';

  const markRaw = parseVariantNumber(v.mark);
  const mark = markRaw.ok && markRaw.value !== null && MARK_RANGES[markRaw.value] ? markRaw.value : null;

  const row: Record<string, unknown> = {
    name,
    marque,
    family,
    body_style: body,
    market,
    mark,
    is_limited_edition: family === 'limited_edition' || v.is_limited_edition === true,
    fuel_system: oneOf(VARIANT_FUEL_SYSTEMS, v.fuel_system),
    sources: [source],
    status: 'approved',
    submitted_by: submittedBy,
    reviewed_at: new Date().toISOString(),
  };
  for (const col of VARIANT_EDITABLE_COLUMNS) {
    if (col === 'name' || !(col in v)) continue;
    if (VARIANT_NUMERIC_COLUMNS.has(col)) {
      const parsed = parseVariantNumber(v[col]);
      if (!parsed.ok) return `"${col}" must be a number`;
      row[col] = parsed.value;
    } else {
      row[col] = text(v[col], 2000);
    }
  }
  if (row.year_start === undefined || row.year_start === null) return 'A new variant needs a start year';

  row.slug = await uniqueSlug(db, slugifyVariant(name, mark));
  const { data: created, error } = await db.from('model_variants').insert(row).select('id').single();
  if (error) return error.message;

  const colourError = await replaceColours(db, created.id, parseColourList(data.colours));
  if (colourError) return colourError;
  const photoError = await insertPhotos(db, created.id, ownPhotoUrls(data, submissionId), data, submittedBy);
  if (photoError) return photoError;

  invalidateModelVariants();
  return null;
}

/** Spec fix, colour fix or photo addition (`edit_suggestion`). Returns an error message or null. */
export async function applyVariantEdit(
  db: Db,
  variantId: string,
  data: Record<string, any>,
  submittedBy: string | null,
  submissionId: string
): Promise<string | null> {
  const changes = data.changes && typeof data.changes === 'object' ? (data.changes as Record<string, any>) : null;

  if (!changes) {
    const urls = ownPhotoUrls(data, submissionId);
    if (!urls.length) return 'No changes provided';
    const err = await insertPhotos(db, variantId, urls, data, submittedBy);
    if (!err) invalidateModelVariants();
    return err;
  }

  const source = parseVariantSource(data.source);
  if (!source) return 'A spec correction needs a source (type and citation)';

  const updates: Record<string, unknown> = {};
  let colours: string[] | null = null;
  for (const [field, diff] of Object.entries(changes)) {
    if (!diff || typeof diff !== 'object' || !('to' in diff)) continue;
    const to = (diff as { to: unknown }).to;
    if (field === 'colours') {
      colours = parseColourList(to);
      continue;
    }
    if (!EDITABLE.has(field)) return `Suggestion targets a field that is not user-editable on a variant: ${field}`;
    if (VARIANT_NUMERIC_COLUMNS.has(field)) {
      const parsed = parseVariantNumber(to);
      if (!parsed.ok) return `"${field}" must be a number`;
      updates[field] = parsed.value;
    } else {
      updates[field] = text(to, 2000);
    }
  }
  if (!Object.keys(updates).length && colours === null) return 'No changes provided';
  if (updates.name === null) return 'A variant name cannot be cleared';

  const { data: current, error: readError } = await db
    .from('model_variants')
    .select('sources')
    .eq('id', variantId)
    .single();
  if (readError) return readError.message;
  updates.sources = [...(Array.isArray(current?.sources) ? current.sources : []), source];

  const { error } = await db.from('model_variants').update(updates).eq('id', variantId);
  if (error) return error.message;
  if (colours !== null) {
    const colourError = await replaceColours(db, variantId, colours);
    if (colourError) return colourError;
  }
  invalidateModelVariants();
  return null;
}

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
import { invalidateModelVariants, loadModelVariants, toModelVariantCard } from './modelVariants';
import { matchRegistryToVariant } from '../../shared/utils/variantMatch';
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
  VARIANT_TEXT_MAX,
  variantNumberProblem,
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

/** A number for `column`, range-checked against the table's CHECK constraints. */
export function numberFor(
  column: string,
  raw: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseVariantNumber(raw);
  if (!parsed.ok) return { ok: false, error: `"${column}" must be a number` };
  if (parsed.value === null) return parsed;
  const problem = variantNumberProblem(column, parsed.value);
  return problem ? { ok: false, error: problem } : parsed;
}

export const textFor = (column: string, raw: unknown) => text(raw, VARIANT_TEXT_MAX[column] ?? 2000);

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
    .replace(/[\u0300-\u036f]/g, '')
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

/**
 * Colour names → approved colours-archive ids, matched on lower(trim(name))
 * exactly as migration 20260922000004 linked the seed, oldest row per name
 * (the archive has same-name duplicates). Reads the approved names once per
 * call; the colours archive is a few hundred rows.
 */
async function resolveColourIds(db: Db, names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!names.length) return out;
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('colors')
      .select('id, name, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) break; // Unlinked names still render; linking is best-effort.
    for (const c of data ?? []) {
      const key = String(c.name ?? '')
        .trim()
        .toLowerCase();
      if (wanted.has(key) && !out.has(key)) out.set(key, c.id);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Make the variant's colour set exactly `names`, without a window in which it
 * is empty: upsert the new list on the (variant_id, color_name) key first,
 * then delete only the names that dropped out. A failure part-way leaves the
 * old and new names together, never none.
 */
export async function replaceColours(db: Db, variantId: string, names: string[]): Promise<string | null> {
  const ids = await resolveColourIds(db, names);
  if (names.length) {
    const { error } = await db.from('model_variant_colors').upsert(
      names.map((name, i) => ({
        variant_id: variantId,
        color_name: name,
        color_id: ids.get(name.trim().toLowerCase()) ?? null,
        sort_order: i,
      })),
      { onConflict: 'variant_id,color_name' }
    );
    if (error) return error.message;
  }
  const { data: existing, error: readError } = await db
    .from('model_variant_colors')
    .select('color_name')
    .eq('variant_id', variantId);
  if (readError) return readError.message;
  const keep = new Set(names);
  const drop = (existing ?? []).map((r: { color_name: string }) => r.color_name).filter((n: string) => !keep.has(n));
  if (!drop.length) return null;
  const { error } = await db.from('model_variant_colors').delete().eq('variant_id', variantId).in('color_name', drop);
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
  const { data: existing, error: readError } = await db
    .from('model_variant_photos')
    .select('sort_order, is_primary')
    .eq('variant_id', variantId);
  if (readError) return readError.message;
  const start = Math.max(-1, ...(existing ?? []).map((p: { sort_order: number }) => p.sort_order ?? 0)) + 1;
  const hasPrimary = (existing ?? []).some((p: { is_primary: boolean }) => p.is_primary);
  const kind = oneOf(VARIANT_PHOTO_KINDS, data.photo_kind) ?? 'owner';
  const rows = (primary: boolean) =>
    urls.map((url, i) => ({
      variant_id: variantId,
      url,
      kind,
      caption: text(data.photo_caption, 200),
      credit: text(data.photo_credit, 120),
      is_primary: primary && i === 0,
      sort_order: start + i,
      status: 'approved',
      submitted_by: submittedBy,
    }));
  let { error } = await db.from('model_variant_photos').insert(rows(!hasPrimary));
  // Another approval took the primary slot between our read and write
  // (model_variant_photos_one_primary): the photos still belong, just not first.
  if (error?.code === '23505' && !hasPrimary) ({ error } = await db.from('model_variant_photos').insert(rows(false)));
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

  const parsedMark = parseVariantNumber(v.mark);
  const mark = parsedMark.ok && parsedMark.value !== null && MARK_RANGES[parsedMark.value] ? parsedMark.value : null;

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
      const parsed = numberFor(col, v[col]);
      if (!parsed.ok) return parsed.error;
      row[col] = parsed.value;
    } else {
      row[col] = textFor(col, v[col]);
    }
  }
  if (row.year_start === undefined || row.year_start === null) return 'A new variant needs a start year';
  if (typeof row.year_end === 'number' && row.year_end < (row.year_start as number))
    return 'The last year cannot be before the first year';

  // The table is unique on (marque, name, year_start); say so readably
  // instead of letting the insert fail with a constraint name.
  const { data: twin } = await db
    .from('model_variants')
    .select('slug')
    .eq('marque', marque)
    .eq('name', name)
    .eq('year_start', row.year_start)
    .maybeSingle();
  if (twin?.slug) return `This variant already exists as /archive/variants/${twin.slug}`;

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
      const parsed = numberFor(field, to);
      if (!parsed.ok) return parsed.error;
      updates[field] = parsed.value;
    } else {
      updates[field] = textFor(field, to);
    }
  }
  if (!Object.keys(updates).length && colours === null) return 'No changes provided';
  if (updates.name === null) return 'A variant name cannot be cleared';
  if ('year_start' in updates && updates.year_start === null) return 'The first year cannot be cleared';

  const { data: current, error: readError } = await db
    .from('model_variants')
    .select('sources, year_start, year_end')
    .eq('id', variantId)
    .single();
  if (readError) return readError.message;
  const start = ('year_start' in updates ? updates.year_start : current?.year_start) as number | null;
  const end = ('year_end' in updates ? updates.year_end : current?.year_end) as number | null;
  if (start !== null && end !== null && end < start) return 'The last year cannot be before the first year';
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

/**
 * The Model Variant a newly approved REGISTRY car links to.
 *
 * The owner's pick (`data.variantSlug`, from the wizard) wins when it names an
 * approved variant; otherwise the shared matcher links only a confident match
 * (`auto`). Anything else stays unlinked for a human. Never throws: a registry
 * approval must not fail because the variants archive is unreachable.
 */
export async function resolveRegistryVariant(
  data: Record<string, any>
): Promise<{ variant_id: string; variant_match: 'owner' | 'auto' } | Record<string, never>> {
  let rows;
  try {
    rows = await loadModelVariants();
  } catch {
    return {};
  }
  const slug = typeof data.variantSlug === 'string' ? data.variantSlug : null;
  const picked = slug ? rows.find((v) => v.slug === slug) : undefined;
  if (picked) return { variant_id: picked.id, variant_match: 'owner' };

  const year = Number(data.year);
  const { best, confident } = matchRegistryToVariant(
    {
      year: Number.isFinite(year) && year > 0 ? year : null,
      model: typeof data.model === 'string' ? data.model : null,
      trim: typeof data.trim === 'string' ? data.trim : null,
      engine_size: Number(data.engineSize ?? data.engine_size) || null,
      body_type: typeof (data.bodyType ?? data.body_type) === 'string' ? (data.bodyType ?? data.body_type) : null,
    },
    rows.map(toModelVariantCard)
  );
  if (!confident || !best) return {};
  const match = rows.find((v) => v.slug === best.slug);
  return match ? { variant_id: match.id, variant_match: 'auto' } : {};
}

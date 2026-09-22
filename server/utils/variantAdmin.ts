/**
 * Admin management of the Model Variants archive (`/admin/variants`).
 *
 * The admin routes under `server/api/admin/variants/` are thin; the rules live
 * here so they are testable and cannot drift between routes:
 *
 *   * `ADMIN_VARIANT_COLUMNS` is the allowlist for an admin CONTENT edit. It is
 *     the contributor allowlist (`VARIANT_EDITABLE_COLUMNS`) plus the
 *     classification a reclassification needs (marque, family, body, mark,
 *     market, limited-edition flag, fuel system) and the alias list. It never
 *     holds `status` (its own route, with a reason), `slug` (URLs), `sources`
 *     (citations are appended by approvals, not hand-edited), or provenance
 *     (`submitted_by`, `legacy_submitted_by`, `reviewed_*`, `specs_source`).
 *   * Every write records an `admin_audit_log` row; a failed audit write is
 *     reported, not swallowed (the parts licence route's reasoning).
 *   * Every write expires the cached archive (`invalidateModelVariants`).
 */
import { invalidateModelVariants } from './modelVariants';
import { numberFor, textFor } from './variantApprovals';
import {
  VARIANT_BODIES,
  VARIANT_EDITABLE_COLUMNS,
  VARIANT_FAMILIES,
  VARIANT_FUEL_SYSTEMS,
  VARIANT_MARKETS,
  VARIANT_MARQUES,
  VARIANT_NUMERIC_COLUMNS,
} from '../../data/models/variants';

type Db = any;

const ENUM_COLUMNS: Record<string, readonly string[]> = {
  marque: VARIANT_MARQUES,
  family: VARIANT_FAMILIES,
  body_style: VARIANT_BODIES,
  market: VARIANT_MARKETS,
};

export const ADMIN_VARIANT_COLUMNS: ReadonlySet<string> = new Set([
  ...VARIANT_EDITABLE_COLUMNS,
  'marque',
  'family',
  'body_style',
  'mark',
  'market',
  'is_limited_edition',
  'fuel_system',
  'power_standard',
  'engine_note',
  'distinguishing',
]);

/** Browser-sent `changes` → a validated update, or the first reason it is refused. */
export function validateAdminVariantChanges(
  changes: unknown
): { ok: true; updates: Record<string, unknown> } | { ok: false; error: string } {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { ok: false, error: 'No changes' };
  const updates: Record<string, unknown> = {};
  for (const [column, raw] of Object.entries(changes as Record<string, unknown>)) {
    if (!ADMIN_VARIANT_COLUMNS.has(column)) return { ok: false, error: `"${column}" is not editable here` };
    if (column in ENUM_COLUMNS) {
      if (typeof raw !== 'string' || !ENUM_COLUMNS[column]!.includes(raw))
        return { ok: false, error: `"${column}" must be one of: ${ENUM_COLUMNS[column]!.join(', ')}` };
      updates[column] = raw;
    } else if (column === 'fuel_system') {
      if (raw !== null && raw !== '' && !(VARIANT_FUEL_SYSTEMS as readonly unknown[]).includes(raw))
        return { ok: false, error: `"fuel_system" must be one of: ${VARIANT_FUEL_SYSTEMS.join(', ')}` };
      updates[column] = raw || null;
    } else if (column === 'power_standard') {
      if (raw !== null && raw !== '' && raw !== 'SAE' && raw !== 'DIN')
        return { ok: false, error: '"power_standard" must be SAE, DIN or empty' };
      updates[column] = raw || null;
    } else if (column === 'is_limited_edition') {
      if (typeof raw !== 'boolean') return { ok: false, error: '"is_limited_edition" must be true or false' };
      updates[column] = raw;
    } else if (column === 'distinguishing') {
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('\n') : null;
      if (!list) return { ok: false, error: '"distinguishing" must be a list of lines' };
      updates[column] = list
        .map((line) => (typeof line === 'string' ? line.trim().slice(0, 200) : ''))
        .filter(Boolean)
        .slice(0, 20);
    } else if (column === 'mark' || VARIANT_NUMERIC_COLUMNS.has(column)) {
      const parsed = numberFor(column, raw);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      updates[column] = parsed.value;
    } else {
      updates[column] = textFor(column, raw);
    }
  }
  if (!Object.keys(updates).length) return { ok: false, error: 'No changes' };
  if ('name' in updates && !updates.name) return { ok: false, error: 'A variant needs a name' };
  if ('year_start' in updates && updates.year_start === null)
    return { ok: false, error: 'A variant needs a first year' };
  return { ok: true, updates };
}

/** One audited admin action. Returns an error message when the audit row could not be written. */
export async function auditVariantAction(
  db: Db,
  adminId: string,
  action: string,
  targetType: 'variant' | 'variant_photo' | 'variant_colour' | 'registry',
  targetId: string | null,
  details: Record<string, unknown>
): Promise<string | null> {
  const { error } = await db.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
  invalidateModelVariants();
  return error ? `Saved, but the audit record failed: ${error.message}` : null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

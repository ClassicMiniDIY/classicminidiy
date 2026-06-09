/**
 * Coerce a possibly-malformed value into a Postgres-safe `date` value or null.
 *
 * Registry submissions historically defaulted `buildDate` to `[]` (an empty
 * array — see RegistrySubmission.vue). `[]` is truthy in JS, so `value || null`
 * let it slip through into the `registry_entries.build_date` date column as the
 * string "[]", producing `invalid input syntax for type date: "[]"` and breaking
 * every registry approval (including already-queued submissions).
 *
 * Treat arrays/objects and empty / "[]" / "{}" strings as null; pass real date
 * strings through for Postgres to validate.
 */
export function toDateOrNull(value: unknown): string | null {
  if (value == null) return null;
  // typeof null === 'object' is handled above; this catches arrays ([]) + objects.
  if (typeof value === 'object') return null;
  const s = String(value).trim();
  if (!s || s === '[]' || s === '{}') return null;
  return s;
}

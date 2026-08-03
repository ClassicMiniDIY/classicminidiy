/**
 * The parts of colour approval that BOTH approval routes have to agree on.
 *
 * Two surfaces approve colour submissions and write to the same `colors` table:
 *
 *  - `server/api/admin/queue/approve.post.ts` — the unified admin inbox, the
 *    one contributors' submissions actually flow through today.
 *  - `server/api/colors/queue/save.ts` — the older `/admin/colors/review` page.
 *    It is not linked from any nav but is reachable by URL, and
 *    `/api/colors/queue/list` spreads `...item.data`, so the same submissions
 *    are approvable from it.
 *
 * They drifted, and the drift was invisible until it had already written to a
 * public row: only one of them honoured `originalColorId`, so approving the
 * same submission from the other door minted a duplicate colour. Anything both
 * routes must decide the same way lives here rather than being copied.
 */

/** Buckets `server/api/archive/upload.ts` is allowed to write to. */
export const UPLOAD_BUCKETS = ['archive-documents', 'archive-thumbnails', 'archive-colors', 'archive-wheels'] as const;

/**
 * True only for URLs this app minted for THIS submission.
 *
 * The upload route writes files to
 * `<supabaseUrl>/storage/v1/object/public/<bucket>/uploads/<submissionId>/<name>`,
 * so pinning the whole prefix — origin, storage path, bucket allowlist and the
 * submission id — means a payload cannot smuggle in an external URL, another
 * bucket, or a file uploaded against somebody else's submission.
 *
 * This matters because `submission_queue.data` is written by the BROWSER and the
 * INSERT policy only checks `auth.uid() = submitted_by`, never the payload — so
 * every asset URL in it is attacker-controlled until checked here.
 *
 * `supabaseUrl` comes from runtimeConfig rather than a literal because Storage
 * is served from the custom domain (auth.classicminidiy.com); hardcoding the
 * project-ref host would reject every real upload.
 */
export function isOwnUploadUrl(url: unknown, submissionId: string): boolean {
  if (typeof url !== 'string') return false;
  const base = (useRuntimeConfig().public.supabaseUrl as string)?.replace(/\/$/, '');
  if (!base) return false;

  return UPLOAD_BUCKETS.some((bucket) =>
    url.startsWith(`${base}/storage/v1/object/public/${bucket}/uploads/${submissionId}/`)
  );
}

/**
 * `/contribute/color` is the one archive form that is not the wizard (its
 * swatch-versus-contributor-photo split does not fit the shared step 2), so an
 * "add photos to this colour" submission arrives as a `new_item` carrying the
 * chosen colour's id in `data.originalColorId` rather than as an
 * `edit_suggestion` with a `target_id`.
 *
 * The id is client-written, and `colors.id` is a uuid — an unparseable value
 * reaching `.eq('id', …)` is a Postgres 22P02 surfacing as an opaque 500 on
 * approval, so anything that is not a uuid is treated as absent.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function asColorId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export interface ContributorImage {
  url: string;
  contributor?: string | null;
}

/**
 * Sorts a colour submission's own uploads into the swatch slot and the
 * contributor gallery, dropping anything that did not come from this
 * submission's uploads.
 *
 * `category` is stamped by `/contribute/color` at upload time
 * (`?category=swatch` vs `?category=car-photos`); a bare string or a missing
 * category is treated as a gallery photo, which is what the pre-wizard payloads
 * look like.
 */
export function collectColorAssets(
  data: any,
  submissionId: string
): { swatchPath: string | null; contributorImages: ContributorImage[] } {
  const contributor = data?.submittedBy || data?.legacy_submitted_by || null;

  const ownUrls = (values: unknown): string[] =>
    (Array.isArray(values) ? values : [])
      .map((v: any) => (typeof v === 'string' ? v : (v?.url ?? v?.src)))
      .filter((url: unknown): url is string => typeof url === 'string')
      .filter((url) => isOwnUploadUrl(url, submissionId));

  let swatchPath = ownUrls([data?.imageSwatch ?? data?.swatch_path])[0] ?? null;
  const contributorImages: ContributorImage[] = ownUrls(data?.images || data?.contributor_images).map((url) => ({
    url,
    contributor,
  }));

  const uploadedFiles = Array.isArray(data?.uploadedFiles) ? data.uploadedFiles : [];
  for (const file of uploadedFiles) {
    const fileObj = typeof file === 'string' ? { url: file, category: 'general' } : file;
    if (!isOwnUploadUrl(fileObj?.url, submissionId)) continue;
    if (fileObj.category === 'swatch' && !swatchPath) {
      swatchPath = fileObj.url;
    } else if (fileObj.category === 'car-photos' || fileObj.category === 'general') {
      contributorImages.push({ url: fileObj.url, contributor });
    }
  }

  return { swatchPath, contributorImages };
}

/**
 * Appends to a colour's contributor gallery, deduped by url.
 *
 * Append rather than replace: the gallery accumulates across contributors, so
 * writing a single submission's photos over it drops everyone else's. Dedupe by
 * url so re-approving a submission is not additive.
 */
export function mergeContributorImages(existing: unknown, incoming: ContributorImage[]): ContributorImage[] {
  const merged = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(merged.map((image: any) => (typeof image === 'string' ? image : image?.url)));

  for (const image of incoming) {
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    merged.push(image);
  }

  return merged;
}

export interface ExistingColor {
  id: string;
  contributor_images: unknown;
  submitted_by: string | null;
  swatch_path: string | null;
}

/**
 * Merges an approved colour contribution into the colour it was submitted
 * against, instead of creating a second row for it.
 *
 * Ignoring `originalColorId` INSERTed a photo-only stub — same name, no
 * hex_value, no swatch, empty paint codes — so `/archive/colors` listed the
 * colour twice. The blast radius went past the listing: a stub shares its real
 * colour's `name+code+short_code`, the exact tuple
 * `20260727000001_restore_wheel_colour_legacy_ids.sql` matches on, so a legacy
 * DynamoDB id was restored onto a stub and that colour's legacy deep link
 * started resolving to a row with no colour data in it. Two instances reached
 * production; supabase PR #77 cleaned the rows up.
 *
 * Three things are deliberately conservative here, because the target is an
 * existing public row rather than one this submission is creating:
 *
 *  - `submitted_by` is only written when the row does not have one. The archive
 *    import left it NULL, which is the case this fills; overwriting a real value
 *    would move another contributor's credit — and, through the trust
 *    pipeline's `contributor_archive_items` view, their counters — onto this
 *    photo.
 *  - `swatch_path` is only written when the row has none. A colour that already
 *    has a swatch has a curated one; a submitted duplicate is not an upgrade,
 *    and it is not a car photo either, so it does not become one.
 *  - No other field is touched. Correcting `hex_value` or a paint code on an
 *    existing colour is an edit suggestion, which goes through the approve
 *    route's `EDIT_TARGETS` allowlist.
 */
export async function attachToExistingColor(
  supabase: any,
  existing: ExistingColor,
  contributorImages: ContributorImage[],
  swatchPath: string | null,
  submittedBy: string | null
): Promise<string | null> {
  const updates: Record<string, any> = {
    contributor_images: mergeContributorImages(existing.contributor_images, contributorImages),
  };

  if (!existing.submitted_by && submittedBy) updates.submitted_by = submittedBy;
  if (!existing.swatch_path && swatchPath) {
    updates.swatch_path = swatchPath;
    updates.has_swatch = true;
  }

  const { error } = await supabase.from('colors').update(updates).eq('id', existing.id);
  return error?.message || null;
}

/** The columns `attachToExistingColor` needs in order to decide what to write. */
export const EXISTING_COLOR_COLUMNS = 'id, submitted_by, swatch_path, contributor_images';

/**
 * Resolves `data.originalColorId` to the row it names, or null when the
 * submission is not an "add to an existing colour" one.
 *
 * A stale or deleted id resolves to null so the caller falls through to its
 * INSERT rather than dropping the contribution on the floor.
 */
export async function resolveColorTarget(
  supabase: any,
  originalColorId: unknown
): Promise<{ existing: ExistingColor | null; error: string | null }> {
  const id = asColorId(originalColorId);
  if (!id) return { existing: null, error: null };

  const { data, error } = await supabase.from('colors').select(EXISTING_COLOR_COLUMNS).eq('id', id).maybeSingle();

  if (error) return { existing: null, error: error.message };
  return { existing: (data as ExistingColor) || null, error: null };
}

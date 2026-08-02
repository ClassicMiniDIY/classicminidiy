import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { toDateOrNull } from '../../../utils/sanitize';

/**
 * Where each submission target_type writes, and which of that table's columns a
 * user-submitted edit suggestion is allowed to touch.
 *
 * `columns` is a security boundary, not a convenience: applyEditSuggestion() maps
 * `data.changes` keys directly onto column names, and `data` is written to
 * submission_queue by the browser (useSubmissions.submitEditSuggestion), so
 * anything omitted here is a column a crafted suggestion cannot reach.
 *
 * Rules for editing these lists:
 *  - Only descriptive/bibliographic columns belong here.
 *  - NEVER add ownership, moderation or audit columns: id, status, submitted_by,
 *    reviewed_by, reviewed_at, created_at, updated_at, legacy_id,
 *    legacy_submitted_by, legacy_submitted_by_email.
 *  - Asset paths (photos, swatch_path, file_path, thumbnail_path,
 *    contributor_images) are owned by the upload flows, not by suggestions.
 *  - Every name must be a real column on the mapped table. There is no
 *    camelCase-to-snake_case translation anywhere in this path, so the client's
 *    field keys must be snake_case column names too (this is what the wheels
 *    `offset` vs `offset_value` bug got wrong).
 */
const EDIT_TARGETS: Record<string, { table: string; columns: string[] }> = {
  color: {
    table: 'colors',
    columns: ['name', 'code', 'short_code', 'ditzler_ppg_code', 'dulux_code', 'year_start', 'year_end', 'hex_value'],
  },
  wheel: {
    table: 'wheels',
    columns: [
      'name',
      'wheel_type',
      'size',
      'width',
      'offset_value',
      'bolt_pattern',
      'center_bore',
      'manufacturer',
      'weight',
      'notes',
    ],
  },
  registry: {
    table: 'registry_entries',
    columns: [
      'year',
      'model',
      'body_number',
      'engine_number',
      'engine_size',
      'body_type',
      'color',
      'trim',
      'build_date',
      'owner',
      'location',
      'notes',
    ],
  },
  document: {
    table: 'archive_documents',
    columns: [
      'title',
      'description',
      'code',
      'author',
      'year',
      'collection_id',
      'publisher',
      'edition',
      'page_count',
      'language',
      'applicable_models',
      'vehicle_year_start',
      'vehicle_year_end',
    ],
  },
};

/**
 * Which targets accept a photo-only addition, and the table whose `photos`
 * text[] column receives it. Colours store images in `contributor_images`
 * (jsonb, different shape) and documents have a single `file_path`, so neither
 * is a straight append — they are deliberately absent rather than special-cased.
 */
const PHOTO_APPEND_TARGETS: Record<string, string> = {
  wheel: 'wheels',
  registry: 'registry_entries',
};

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { id, reviewerNotes, editedData } = body;

  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing submission id' });
  }

  // Fetch the submission
  const { data: submission, error: fetchError } = await supabase
    .from('submission_queue')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !submission) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' });
  }

  const itemData = editedData || submission.data;

  // For new_item submissions, insert into the appropriate table
  if (submission.type === 'new_item') {
    const insertError = await insertApprovedItem(
      supabase,
      submission.target_type,
      itemData,
      submission.submitted_by
    );
    if (insertError) {
      throw createError({ statusCode: 500, statusMessage: insertError });
    }
  }

  // For edit_suggestion submissions, apply the changes to the target
  if (submission.type === 'edit_suggestion' && submission.target_id) {
    const applyError = await applyEditSuggestion(supabase, submission.target_type, submission.target_id, itemData);
    if (applyError) {
      throw createError({ statusCode: 500, statusMessage: applyError });
    }
  }

  // Update submission status
  const { error: updateError } = await supabase
    .from('submission_queue')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: reviewerNotes || null,
      data: editedData || submission.data,
    })
    .eq('id', id);

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message });
  }

  return { success: true };
});

/**
 * `submittedBy` is the credit. Before the UX cohesion pass these inserts only
 * carried `legacy_submitted_by` (a free-text name), so an approved contribution
 * was never linked back to the account that made it — which meant no profile
 * stats, no badges, and no leaderboard entry. Every archive table already has a
 * `submitted_by` FK; it just was not being written.
 */
async function insertApprovedItem(
  supabase: any,
  targetType: string,
  data: any,
  submittedBy: string | null
): Promise<string | null> {
  let error;

  switch (targetType) {
    case 'color': {
      // Map uploaded files to swatch_path and contributor_images based on category
      let swatchPath = data.imageSwatch || data.swatch_path || null;
      const contributorImages: { url: string; contributor?: string }[] = data.images || data.contributor_images || [];
      const uploadedFiles = data.uploadedFiles || [];

      for (const file of uploadedFiles) {
        const fileObj = typeof file === 'string' ? { url: file, category: 'general' } : file;
        if (fileObj.category === 'swatch' && !swatchPath) {
          swatchPath = fileObj.url;
        } else if (fileObj.category === 'car-photos' || fileObj.category === 'general') {
          contributorImages.push({
            url: fileObj.url,
            contributor: data.submittedBy || data.legacy_submitted_by || null,
          });
        }
      }

      ({ error } = await supabase.from('colors').insert({
        name: data.name,
        code: data.code || '',
        short_code: data.shortCode || data.short_code || '',
        ditzler_ppg_code: data.ditzlerPpgCode || data.ditzler_ppg_code || '',
        dulux_code: data.duluxCode || data.dulux_code || '',
        hex_value: data.primaryColor || data.hex_value || data.hexValue || '',
        has_swatch: !!swatchPath || data.hasSwatch || data.has_swatch || false,
        swatch_path: swatchPath,
        contributor_images: contributorImages,
        status: 'approved',
        submitted_by: submittedBy,
        legacy_submitted_by: data.submittedBy || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.submittedByEmail || data.legacy_submitted_by_email || null,
      }));
      break;
    }

    case 'wheel':
      ({ error } = await supabase.from('wheels').insert({
        name: data.name || '',
        wheel_type: data.type || data.wheel_type || '',
        size: parseInt(data.size) || 10,
        width: data.width || '',
        offset_value: data.offset || data.offset_value || '',
        bolt_pattern: data.boltPattern || data.bolt_pattern || null,
        center_bore: data.centerBore || data.center_bore || null,
        manufacturer: data.manufacturer || null,
        weight: data.weight || null,
        notes: data.notes || null,
        photos: data.photos || (data.images || []).map((img: any) => img.src || img),
        status: 'approved',
        submitted_by: submittedBy,
        legacy_submitted_by: data.userName || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.emailAddress || data.legacy_submitted_by_email || null,
      }));
      break;

    case 'registry':
      ({ error } = await supabase.from('registry_entries').insert({
        year: data.year || 0,
        model: data.model || '',
        body_number: data.bodyNum || data.body_number || '',
        engine_number: data.engineNum || data.engine_number || '',
        engine_size: data.engineSize || data.engine_size || null,
        body_type: data.bodyType || data.body_type || null,
        color: data.color || null,
        trim: data.trim || null,
        build_date: toDateOrNull(data.buildDate) ?? toDateOrNull(data.build_date),
        owner: data.owner || null,
        location: data.location || null,
        notes: data.notes || null,
        status: 'approved',
        submitted_by: submittedBy,
        legacy_submitted_by: data.submittedBy || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.submittedByEmail || data.legacy_submitted_by_email || null,
      }));
      break;

    case 'document':
      ({ error } = await supabase.from('archive_documents').insert({
        slug: (data.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        type: data.type || 'manual',
        title: data.title || '',
        description: data.description || null,
        code: data.code || null,
        author: data.author || null,
        year: data.year || null,
        file_path: data.filePath || data.file_path || null,
        thumbnail_path: data.thumbnailPath || data.thumbnail_path || null,
        status: 'approved',
        submitted_by: submittedBy,
      }));
      break;

    default:
      return `Unsupported target type: ${targetType}`;
  }

  return error?.message || null;
}

async function applyEditSuggestion(
  supabase: any,
  targetType: string,
  targetId: string,
  data: any
): Promise<string | null> {
  const changes = data.changes;

  // Photo-only addition: the contribute wizard's "add yours" / "I have this"
  // path fills a gap on an existing entry with images and no field edits.
  // Safe to append without an allowlist check because the URLs come from our own
  // storage upload route (server/api/archive/upload.ts), never from the client —
  // the client only ever chose which bytes to send.
  if (!changes || typeof changes !== 'object') {
    const uploaded: { url: string }[] = Array.isArray(data.uploadedFiles) ? data.uploadedFiles : [];
    const urls = uploaded.map((file: any) => (typeof file === 'string' ? file : file?.url)).filter(Boolean);

    if (urls.length === 0) return 'No changes provided';

    const photoTable = PHOTO_APPEND_TARGETS[targetType];
    if (!photoTable) return `Cannot attach photos to a ${targetType} entry`;

    const { data: current, error: readError } = await supabase
      .from(photoTable)
      .select('photos')
      .eq('id', targetId)
      .single();
    if (readError) return readError.message;

    const merged = [...((current?.photos as string[]) || []), ...urls];
    const { error: photoError } = await supabase.from(photoTable).update({ photos: merged }).eq('id', targetId);
    return photoError?.message || null;
  }

  const updates: Record<string, any> = {};
  for (const [field, diff] of Object.entries(changes)) {
    if (diff && typeof diff === 'object' && 'to' in (diff as any)) {
      const value = (diff as any).to;
      // The modal submits every input as a string, so a cleared field arrives as
      // ''. Postgres rejects that for integer/date columns (22P02), which used to
      // surface as an opaque 500 on approval; NULL is what "cleared" means here.
      updates[field] = value === '' ? null : value;
    }
  }

  // Handle new collection creation before stripping meta fields
  if (updates.collection_id === '__new__') {
    const newTitle = updates._new_collection_title;
    const newDescription = updates._new_collection_description;

    if (newTitle) {
      // Determine collection type from the target document
      const { data: targetDoc } = await supabase.from('archive_documents').select('type').eq('id', targetId).single();

      const slug = String(newTitle)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: newCollection, error: collError } = await supabase
        .from('document_collections')
        .insert({
          slug,
          type: targetDoc?.type || 'manual',
          title: newTitle,
          description: newDescription || null,
          status: 'approved',
        })
        .select('id')
        .single();

      if (collError) return `Failed to create collection: ${collError.message}`;

      // Replace sentinel with actual new collection ID
      updates.collection_id = newCollection.id;
    } else {
      delete updates.collection_id;
    }
  }

  // Strip meta-only fields (prefixed with _) that are not actual DB columns
  for (const key of Object.keys(updates)) {
    if (key.startsWith('_')) delete updates[key];
  }

  if (Object.keys(updates).length === 0) return null;

  const target = EDIT_TARGETS[targetType];
  if (!target) return `Unsupported target type: ${targetType}`;

  // `data.changes` is written client-side straight into submission_queue, so its
  // keys are attacker-controlled. Without this check they land verbatim in the
  // UPDATE under the service role, letting a crafted suggestion rewrite status,
  // submitted_by, reviewed_by, legacy_id or legacy_submitted_by_email on any
  // archive row the moment an admin approves it. It also turns a field key that
  // isn't a column (the `offset` vs `offset_value` bug) into a named 400 instead
  // of an opaque 500.
  const rejected = Object.keys(updates).filter((key) => !target.columns.includes(key));
  if (rejected.length > 0) {
    return `Suggestion targets fields that are not user-editable on ${targetType}: ${rejected.join(', ')}`;
  }

  const { error } = await supabase.from(target.table).update(updates).eq('id', targetId);
  return error?.message || null;
}

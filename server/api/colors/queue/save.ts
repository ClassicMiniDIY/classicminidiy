import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';
import { attachToExistingColor, collectColorAssets, resolveColorTarget } from '../../../utils/archiveApprovals';
import type { Json } from '~~/types/database';

/**
 * The older colour approval surface, behind `/admin/colors/review`.
 *
 * That page is not linked from any nav — the unified admin inbox
 * (`/admin/inbox` → `server/api/admin/queue/approve.post.ts`) replaced it — but
 * it is reachable by URL and `/api/colors/queue/list` spreads `...item.data`,
 * so the very same submissions can be approved from here. It therefore has to
 * make the same decisions as the inbox, and until 2026-08 it made four
 * different ones: it ignored `originalColorId` (minting the duplicate colours
 * supabase PR #77 had to fold), it REPLACED `contributor_images` on the edit
 * path instead of appending, it never validated that an asset URL came from
 * this submission's own uploads, and it never wrote `submitted_by` — so an
 * approval here credited nobody and moved no trust counter.
 *
 * The shared decisions now live in `server/utils/archiveApprovals.ts` so the
 * two routes cannot drift again.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAdminAuth(event);
  const body = await readBody(event);
  const supabase = getServiceClient();

  const { uuid, details } = body;

  if (!uuid || typeof uuid !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or missing uuid' });
  }

  if (!details || !details.name) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or missing color details' });
  }

  // Fetch the original submission to determine type and target
  const { data: submission, error: fetchError } = await supabase
    .from('submission_queue')
    .select('type, target_id, data, submitted_by')
    .eq('id', uuid)
    .single();

  if (fetchError || !submission) {
    throw createError({ statusCode: 404, statusMessage: 'Submission not found' });
  }

  // `details` is the admin-reviewed copy of the submission's `data`, posted back
  // by the browser, so its asset URLs are no more trustworthy than the original
  // payload's — collectColorAssets pins every one of them to this submission's
  // own uploads. `uploadedFiles` falls back to the stored row because the review
  // table only round-trips the fields it renders.
  const { swatchPath, contributorImages } = collectColorAssets(
    { ...details, uploadedFiles: details.uploadedFiles || (submission.data as any)?.uploadedFiles },
    uuid
  );

  const colorData = {
    name: details.name,
    code: details.code || '',
    short_code: details.shortCode || details.short_code || '',
    ditzler_ppg_code: details.ditzlerPpgCode || details.ditzler_ppg_code || '',
    dulux_code: details.duluxCode || details.dulux_code || '',
    hex_value: details.primaryColor || details.hex_value || details.hexValue || '',
  };

  // "Add photos to a colour that already exists" arrives two ways: as a
  // new_item stamped with data.originalColorId (the /contribute/color form), or
  // as an edit_suggestion carrying target_id. Both mean "merge into that row",
  // and neither may create a second colour.
  const attachTo = submission.type === 'edit_suggestion' ? submission.target_id : details.originalColorId;
  const { existing, error: readError } = await resolveColorTarget(supabase, attachTo);
  if (readError) {
    throw createError({ statusCode: 500, statusMessage: readError });
  }

  if (existing) {
    // An edit_suggestion is a review of the fields too, so those are applied on
    // top of the photo merge. A new_item never rewrites an existing colour's
    // fields -- see attachToExistingColor.
    const attachError = await attachToExistingColor(
      supabase,
      existing,
      contributorImages,
      swatchPath,
      submission.submitted_by
    );
    if (attachError) {
      throw createError({ statusCode: 500, statusMessage: attachError });
    }

    if (submission.type === 'edit_suggestion') {
      const { error: fieldError } = await supabase.from('colors').update(colorData).eq('id', existing.id);
      if (fieldError) {
        throw createError({ statusCode: 500, statusMessage: fieldError.message });
      }
    }
  } else {
    // INSERT a new color for new_item submissions (and for an edit_suggestion
    // whose target has since been deleted, which would otherwise write nothing).
    const { error: colorError } = await supabase.from('colors').insert({
      ...colorData,
      has_swatch: !!swatchPath || details.hasSwatch || details.has_swatch || false,
      swatch_path: swatchPath,
      // `contributor_images` is a jsonb column, typed as `Json` by the generated
      // client; the array of {url, contributor} satisfies it structurally.
      contributor_images: contributorImages as unknown as Json,
      status: 'approved',
      submitted_by: submission.submitted_by,
      legacy_submitted_by: details.submittedBy || details.legacy_submitted_by || null,
      legacy_submitted_by_email: details.submittedByEmail || details.legacy_submitted_by_email || null,
    });

    if (colorError) {
      throw createError({ statusCode: 500, statusMessage: colorError.message });
    }
  }

  // Update submission queue status to approved
  const { error: queueError } = await supabase
    .from('submission_queue')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      data: details,
    })
    .eq('id', uuid);

  if (queueError) {
    console.error('Queue update failed after color approval:', queueError);
  }

  return { success: true, message: 'Color has been approved', colorId: uuid };
});

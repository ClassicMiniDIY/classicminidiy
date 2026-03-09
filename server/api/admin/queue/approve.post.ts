import { getServiceClient } from '../../../utils/supabase';
import { requireAdminAuth } from '../../../utils/adminAuth';

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
    const insertError = await insertApprovedItem(supabase, submission.target_type, itemData);
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

async function insertApprovedItem(supabase: any, targetType: string, data: any): Promise<string | null> {
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
          contributorImages.push({ url: fileObj.url, contributor: data.submittedBy || data.legacy_submitted_by || null });
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
        build_date: data.buildDate || data.build_date || null,
        owner: data.owner || null,
        location: data.location || null,
        notes: data.notes || null,
        status: 'approved',
        legacy_submitted_by: data.submittedBy || data.legacy_submitted_by || null,
        legacy_submitted_by_email: data.submittedByEmail || data.legacy_submitted_by_email || null,
      }));
      break;

    case 'document':
      ({ error } = await supabase.from('archive_documents').insert({
        slug: (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        type: data.type || 'manual',
        title: data.title || '',
        description: data.description || null,
        code: data.code || null,
        author: data.author || null,
        year: data.year || null,
        file_path: data.filePath || data.file_path || null,
        thumbnail_path: data.thumbnailPath || data.thumbnail_path || null,
        status: 'approved',
      }));
      break;

    default:
      return `Unsupported target type: ${targetType}`;
  }

  return error?.message || null;
}

async function applyEditSuggestion(supabase: any, targetType: string, targetId: string, data: any): Promise<string | null> {
  const changes = data.changes;
  if (!changes || typeof changes !== 'object') return 'No changes provided';

  const updates: Record<string, any> = {};
  for (const [field, diff] of Object.entries(changes)) {
    if (diff && typeof diff === 'object' && 'to' in (diff as any)) {
      updates[field] = (diff as any).to;
    }
  }

  // Handle new collection creation before stripping meta fields
  if (updates.collection_id === '__new__') {
    const newTitle = updates._new_collection_title;
    const newDescription = updates._new_collection_description;

    if (newTitle) {
      // Determine collection type from the target document
      const { data: targetDoc } = await supabase
        .from('archive_documents')
        .select('type')
        .eq('id', targetId)
        .single();

      const slug = String(newTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

  const tableMap: Record<string, string> = {
    color: 'colors',
    wheel: 'wheels',
    registry: 'registry_entries',
    document: 'archive_documents',
  };

  const table = tableMap[targetType];
  if (!table) return `Unsupported target type: ${targetType}`;

  const { error } = await supabase.from(table).update(updates).eq('id', targetId);
  return error?.message || null;
}
